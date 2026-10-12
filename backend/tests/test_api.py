from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest


class ApiTests(unittest.TestCase):
    def setUp(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.db_path = Path(self.directory.name) / 'data' / 'test.sqlite3'
        self.client = TestClient(create_app(self.db_path))
        self.addCleanup(self.client.close)

    def assert_error(self, response, status):
        self.assertEqual(response.status_code, status, response.text)
        error = response.json()['error']
        self.assertIsInstance(error['message'], str)
        self.assertTrue(error['message'])
        self.assertIsInstance(error['details'], list)
        self.assertTrue(all(isinstance(detail, str) for detail in error['details']))

    def test_health_empty_profile_and_dashboard(self):
        self.assertEqual(self.client.get('/api/health').json(), {'status': 'ok'})
        self.assertEqual(self.client.get('/api/seller').json(), {'business_name': '', 'description': '', 'offerings': []})
        self.assertEqual(self.client.get('/api/dashboard').json(), {'seller_complete': False, 'offering_count': 0, 'prospect_count': 0})

    def test_seller_saved_updated_and_persisted_across_apps(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        data = {'business_name': ' Studio ', 'description': ' Useful services '}
        response = self.client.put('/api/seller', json=data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['business_name'], 'Studio')
        with TestClient(create_app(self.db_path)) as restarted:
            self.assertEqual(restarted.get('/api/seller').json()['description'], 'Useful services')
            self.assertTrue(restarted.get('/api/dashboard').json()['seller_complete'])
            restarted.put('/api/seller', json={'business_name': 'Changed', 'description': 'New description'})
        self.assertEqual(self.client.get('/api/seller').json()['business_name'], 'Changed')

    def test_offering_crud_and_profile_catalog(self):
        response = self.client.post('/api/offerings', json={'name': ' Website ', 'description': ' Build sites '})
        self.assertEqual(response.status_code, 201)
        offering = response.json()
        self.assertIsInstance(offering['id'], int)
        self.assertEqual(offering['name'], 'Website')
        self.assertEqual(self.client.get('/api/offerings').json(), [offering])
        self.assertEqual(self.client.get('/api/seller').json()['offerings'], [offering])
        path = f"/api/offerings/{offering['id']}"
        self.assertEqual(self.client.put(path, json={'name': 'Hosting', 'description': 'Keep sites online'}).json(), {'id': offering['id'], 'name': 'Hosting', 'description': 'Keep sites online'})
        self.assertEqual(self.client.get('/api/dashboard').json()['offering_count'], 1)
        deleted = self.client.delete(path)
        self.assertEqual(deleted.status_code, 204)
        self.assertEqual(deleted.content, b'')
        self.assertEqual(self.client.get('/api/offerings').json(), [])
        self.assertEqual(self.client.get('/api/dashboard').json()['offering_count'], 0)

    def test_prospect_crud_optional_fields_and_restart(self):
        from fastapi.testclient import TestClient
        from app.main import create_app
        data = {'business_name': 'Bakery', 'email': 'owner@example.com', 'description': 'Bread and cakes'}
        response = self.client.post('/api/prospects', json=data)
        self.assertEqual(response.status_code, 201)
        prospect = response.json()
        self.assertEqual(prospect['contact_name'], '')
        self.assertEqual(prospect['needs'], '')
        with TestClient(create_app(self.db_path)) as restarted:
            self.assertEqual(restarted.get('/api/prospects').json(), [prospect])
            self.assertEqual(restarted.get('/api/dashboard').json()['prospect_count'], 1)
        data.update(contact_name='Sam', needs='Online ordering', description='Fresh bread')
        path = f"/api/prospects/{prospect['id']}"
        self.assertEqual(self.client.put(path, json=data).json(), dict(data, id=prospect['id']))
        self.assertEqual(self.client.delete(path).status_code, 204)
        self.assertEqual(self.client.get('/api/prospects').json(), [])

    def test_invalid_requests_do_not_write_and_have_consistent_errors(self):
        invalid = [('/api/seller', 'put', {'business_name': ' ', 'description': 'ok'}),
                   ('/api/seller', 'put', {'business_name': 'A', 'description': 'B', 'offerings': []}),
                   ('/api/offerings', 'post', {'name': 'A', 'description': ''}),
                   ('/api/offerings', 'post', {'name': 3, 'description': 'B'}),
                   ('/api/prospects', 'post', {'business_name': 'A', 'email': 'invalid', 'description': 'B'}),
                   ('/api/prospects', 'post', {'business_name': 'A', 'email': 'a@example.com', 'description': ''}),
                   ('/api/uploads/preview', 'post', {'filename': 'a.csv', 'content_base64': 12, 'delimiter': 'auto', 'has_headers': True})]
        for path, method, payload in invalid:
            with self.subTest(payload=payload):
                self.assert_error(getattr(self.client, method)(path, json=payload), 422)
        self.assert_error(self.client.post('/api/offerings', content='{', headers={'Content-Type': 'application/json'}), 422)
        self.assertEqual(self.client.get('/api/offerings').json(), [])
        self.assertEqual(self.client.get('/api/prospects').json(), [])

    def test_not_found_and_invalid_identifier_errors(self):
        for path, data in [('/api/offerings/999', {'name': 'A', 'description': 'B'}), ('/api/prospects/999', {'business_name': 'A', 'email': 'a@example.com', 'description': 'B'})]:
            self.assert_error(self.client.put(path, json=data), 404)
            self.assert_error(self.client.delete(path), 404)
        self.assert_error(self.client.delete('/api/offerings/nope'), 422)
        self.assert_error(self.client.delete('/api/prospects/0'), 422)
        self.assert_error(self.client.get('/api/missing'), 404)

    def test_identifier_outside_sqlite_integer_range_is_validation_error(self):
        self.assert_error(self.client.delete('/api/offerings/9223372036854775808'), 422)
        self.assert_error(self.client.delete('/api/prospects/9223372036854775808'), 422)

    def test_storage_error_is_consistent_and_manual_write_rolls_back(self):
        with sqlite3.connect(self.db_path) as connection:
            connection.execute("CREATE TRIGGER reject_bad BEFORE INSERT ON offerings WHEN NEW.name = 'Rejected' BEGIN SELECT RAISE(ABORT, 'rejected for test'); END")
        with self.assertLogs('app.presentation.api.errors', level='ERROR'):
            response = self.client.post('/api/offerings', json={'name': 'Rejected', 'description': 'Manual'})
        self.assert_error(response, 500)
        self.assertNotIn('rejected for test', response.text)
        self.assertEqual(self.client.get('/api/offerings').json(), [])

    def test_example_csv_can_be_previewed(self):
        import base64
        response = self.client.get('/api/offerings/example.csv')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/csv', response.headers['content-type'])
        preview = self.client.post('/api/uploads/preview', json={'filename': 'example.csv', 'content_base64': base64.b64encode(response.content).decode('ascii'), 'delimiter': 'auto', 'has_headers': True})
        self.assertEqual(preview.status_code, 200)
        self.assertGreater(preview.json()['row_count'], 0)


class CliTests(unittest.TestCase):
    def test_cli_runs_without_loading_api_or_dependencies(self):
        backend = Path(__file__).resolve().parents[1]
        result = subprocess.run([sys.executable, '-m', 'app.main'], cwd=backend, capture_output=True, text=True, check=True)
        self.assertEqual(result.stdout, 'Welcome to Sales Outreach Assistant!\nCreate tailored sales emails for your business.\n')
        check = subprocess.run([sys.executable, '-c', 'import app.main, sys; assert "fastapi" not in sys.modules'], cwd=backend, capture_output=True, text=True)
        self.assertEqual(check.returncode, 0, check.stderr)

    def test_existing_domain_constructors_remain_compatible(self):
        from app.domain.entities import Offering, SellerProfile
        offering = Offering('Web', 'Sites')
        profile = SellerProfile('Studio', 'Creative', [offering])
        self.assertEqual(profile.offerings, [Offering(name='Web', description='Sites')])


if __name__ == '__main__':
    unittest.main()
