import base64
from datetime import datetime
import os
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID


class UploadApiTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'test.sqlite3'
        self.client = TestClient(create_app(self.path))
        self.addCleanup(self.client.close)

    def payload(self, source=b'A,B\n1,2\n', filename='catalog.csv', delimiter='auto', has_headers=True):
        return {'filename': filename, 'content_base64': base64.b64encode(source).decode('ascii'), 'delimiter': delimiter, 'has_headers': has_headers}

    def assert_error(self, response, status=422):
        self.assertEqual(response.status_code, status, response.text)
        self.assertIsInstance(response.json()['error']['message'], str)
        self.assertIsInstance(response.json()['error']['details'], list)

    def test_settings_defaults_and_preview_is_read_only(self):
        self.assertEqual(self.client.get('/api/uploads/settings').json(), {'max_file_bytes': 1048576, 'preview_row_limit': 50})
        response = self.client.post('/api/uploads/preview', json=self.payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'headers': ['A', 'B'], 'rows': [['1', '2']], 'row_count': 1, 'column_count': 2, 'delimiter': ',', 'requested_delimiter': 'auto', 'has_headers': True, 'truncated': False, 'warnings': []})
        self.assertEqual(self.client.get('/api/uploads').json(), [])
        self.assertEqual(self.client.get('/api/offerings').json(), [])

    def test_save_preserves_exact_bom_bytes_and_original_metadata(self):
        from app.infrastructure.sqlite_repository import SQLiteRepository
        source = b'\xef\xbb\xbf Label ,Label,\r\n value ,2,\r\n\r\n'
        filename = '../../original Catalog.CSV'
        response = self.client.post('/api/uploads', json=self.payload(source, filename, ','))
        self.assertEqual(response.status_code, 201, response.text)
        detail = response.json()
        self.assertEqual(str(UUID(detail['id'])), detail['id'])
        self.assertEqual(detail['filename'], filename)
        self.assertEqual(detail['status'], 'Awaiting review')
        self.assertEqual(detail['size_bytes'], len(source))
        self.assertIsNotNone(datetime.fromisoformat(detail['uploaded_at']).tzinfo)
        self.assertEqual(detail['preview']['headers'], [' Label ', 'Label', ''])
        self.assertEqual(detail['preview']['rows'], [[' value ', '2', ''], []])
        self.assertEqual(SQLiteRepository(self.path).get_source(detail['id']).content, source)
        self.assertFalse((Path(self.temp.name) / 'original Catalog.CSV').exists())

    def test_list_reopen_delete_and_restart_leave_offerings_unchanged(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        offering = self.client.post('/api/offerings', json={'name': 'Manual', 'description': 'Preserve saved offering'}).json()
        first = self.client.post('/api/uploads', json=self.payload(filename='first.csv')).json()
        second = self.client.post('/api/uploads', json=self.payload(b'A;B\n3;4\n', 'second.tsv', ';', False)).json()
        listed = self.client.get('/api/uploads').json()
        self.assertEqual([item['id'] for item in listed], [second['id'], first['id']])
        self.assertNotIn('preview', listed[0])
        self.assertNotIn('content', listed[0])
        with TestClient(create_app(self.path)) as restarted:
            self.assertEqual(restarted.get('/api/uploads/' + second['id']).json(), second)
            self.assertEqual(restarted.get('/api/offerings').json(), [offering])
            self.assertEqual(restarted.get('/api/dashboard').json()['offering_count'], 1)
            deleted = restarted.delete('/api/uploads/' + first['id'])
            self.assertEqual((deleted.status_code, deleted.content), (204, b''))
        self.assert_error(self.client.get('/api/uploads/' + first['id']), 404)
        self.assert_error(self.client.delete('/api/uploads/' + first['id']), 404)
        self.assertEqual(self.client.get('/api/offerings').json(), [offering])
        with sqlite3.connect(self.path) as connection:
            self.assertEqual(connection.execute('SELECT count(*) FROM uploads WHERE id = ?', (first['id'],)).fetchone()[0], 0)

    def test_invalid_base64_encoding_source_and_filetypes_never_save(self):
        invalid = [dict(self.payload(), content_base64='%%%'), dict(self.payload(), content_base64='SGV sbG8='),
                   self.payload(b'\xff\xfe'), self.payload(b''), self.payload(b'A,B\n1,\x00\n'),
                   self.payload(b'A,B\n1,"unfinished'), self.payload(filename='report.pdf'), self.payload(filename='sheet.xlsx')]
        for payload in invalid:
            with self.subTest(filename=payload['filename'], content_base64=payload['content_base64'][:12]):
                for route in ['/api/uploads/preview', '/api/uploads']:
                    self.assert_error(self.client.post(route, json=payload))
        self.assertEqual(self.client.get('/api/uploads').json(), [])
        self.assertEqual(self.client.get('/api/offerings').json(), [])

    def test_request_fields_are_strict_and_unknown_ids_are_consistent(self):
        invalid = [dict(self.payload(), has_headers='true'), dict(self.payload(), delimiter='|'), dict(self.payload(), content_base64=12), dict(self.payload(), filename='  '), dict(self.payload(), extra=True)]
        for payload in invalid:
            with self.subTest(payload=payload):
                self.assert_error(self.client.post('/api/uploads/preview', json=payload))
        for value in ['missing', '../../outside', '00000000-0000-0000-0000-000000000000']:
            self.assert_error(self.client.get('/api/uploads/' + value), 404)

    def test_direct_offering_import_endpoints_removed(self):
        for route in ['/api/offerings/import/preview', '/api/offerings/import/confirm']:
            self.assert_error(self.client.post(route, json={'content': 'name,description\nA,B\n'}), 404)

    def test_save_revalidates_beyond_limited_preview_without_partial_staging(self):
        good = self.payload(b'A,B\n' + b'1,2\n' * 60)
        preview = self.client.post('/api/uploads/preview', json=good).json()
        self.assertEqual(preview['row_count'], 60)
        self.assertEqual(len(preview['rows']), 50)
        self.assertTrue(preview['truncated'])
        invalid = self.payload(b'A,B\n' + b'1,2\n' * 60 + b'3,"unfinished')
        self.assert_error(self.client.post('/api/uploads', json=invalid))
        self.assertEqual(self.client.get('/api/uploads').json(), [])
        saved = self.client.post('/api/uploads', json=good)
        self.assertEqual(saved.status_code, 201)
        self.assertEqual(self.client.get('/api/uploads/' + saved.json()['id']).json()['row_count'], 60)

    def test_configured_limits_and_old_upload_reopens_after_limit_is_lowered(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        source = b'A,B\n' + b'1,2\n' * 1001
        saved = self.client.post('/api/uploads', json=self.payload(source)).json()
        with patch.dict(os.environ, {'OUTREACH_UPLOAD_MAX_BYTES': '8', 'OUTREACH_UPLOAD_PREVIEW_ROWS': '2'}):
            with TestClient(create_app(self.path)) as limited:
                self.assertEqual(limited.get('/api/uploads/settings').json(), {'max_file_bytes': 8, 'preview_row_limit': 2})
                self.assert_error(limited.post('/api/uploads', json=self.payload(source)))
                detail = limited.get('/api/uploads/' + saved['id'])
                self.assertEqual(detail.status_code, 200, detail.text)
                self.assertEqual(detail.json()['row_count'], 1001)
                self.assertEqual(detail.json()['size_bytes'], len(source))
                self.assertEqual(len(detail.json()['preview']['rows']), 2)
                self.assertTrue(detail.json()['preview']['truncated'])
        self.assertEqual(self.client.get('/api/uploads').json()[0]['id'], saved['id'])

    def test_source_size_limit_counts_original_bytes_with_bom(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        with patch.dict(os.environ, {'OUTREACH_UPLOAD_MAX_BYTES': '4'}):
            with TestClient(create_app(self.path)) as limited:
                self.assertEqual(limited.post('/api/uploads', json=self.payload(b'A\n')).status_code, 201)
                self.assert_error(limited.post('/api/uploads', json=self.payload(b'\xef\xbb\xbfA\n')))

    def test_sqlite_failure_does_not_stage_metadata_or_bytes(self):
        with sqlite3.connect(self.path) as connection:
            connection.execute("CREATE TRIGGER reject_upload BEFORE INSERT ON uploads BEGIN SELECT RAISE(ABORT, 'staging failed'); END")
        with self.assertLogs('app.presentation.api.errors', level='ERROR'):
            response = self.client.post('/api/uploads', json=self.payload())
        self.assert_error(response, 500)
        self.assertEqual(self.client.get('/api/uploads').json(), [])
        self.assertEqual(self.client.get('/api/offerings').json(), [])


class UploadConfigTests(unittest.TestCase):
    def test_invalid_configuration_is_rejected_with_variable_name(self):
        from app.infrastructure.config import upload_settings
        for key, value in [('OUTREACH_UPLOAD_MAX_BYTES', '0'), ('OUTREACH_UPLOAD_MAX_BYTES', 'bad'), ('OUTREACH_UPLOAD_MAX_BYTES', '999999999'), ('OUTREACH_UPLOAD_PREVIEW_ROWS', '-1'), ('OUTREACH_UPLOAD_PREVIEW_ROWS', '100000')]:
            with self.subTest(key=key, value=value), patch.dict(os.environ, {key: value}):
                with self.assertRaises(ValueError) as caught:
                    upload_settings()
                self.assertIn(key, str(caught.exception))
