from pathlib import Path
import sqlite3
import tempfile
import unittest


class RepositoryTests(unittest.TestCase):
    def setUp(self):
        from app.infrastructure.sqlite_repository import SQLiteRepository
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'data' / 'test.sqlite3'
        self.repo = SQLiteRepository(self.path)

    def test_catalog_persists_across_repositories(self):
        from app.domain.entities import Offering
        from app.infrastructure.sqlite_repository import SQLiteRepository
        record = self.repo.add_offering(Offering('Website', 'Create sites'))
        restarted = SQLiteRepository(self.path)
        self.assertEqual(restarted.list_offerings(), [record])
        self.assertIsInstance(record.id, int)

    def test_bulk_insert_rolls_back_when_database_rejects_later_row(self):
        from app.domain.entities import Offering
        self.repo.add_offering(Offering('Existing', 'Keep this'))
        with sqlite3.connect(self.path) as connection:
            connection.execute("CREATE TRIGGER reject_bad BEFORE INSERT ON offerings WHEN NEW.name = 'Rejected' BEGIN SELECT RAISE(ABORT, 'rejected for test'); END")
        with self.assertRaises(sqlite3.IntegrityError):
            self.repo.append_offerings([Offering('Valid', 'First'), Offering('Rejected', 'Second')])
        self.assertEqual([item.name for item in self.repo.list_offerings()], ['Existing'])

    def test_missing_updates_do_not_create_records(self):
        from app.application.errors import NotFoundError
        from app.domain.entities import Offering
        with self.assertRaises(NotFoundError):
            self.repo.update_offering(42, Offering('Missing', 'Missing'))
        self.assertEqual(self.repo.list_offerings(), [])
