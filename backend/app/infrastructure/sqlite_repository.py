from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
import json
import sqlite3
from typing import Iterator

from app.application.errors import NotFoundError
from app.domain.entities import (
    Offering, OfferingRecord, Prospect, ProspectRecord, SellerProfile, SourceMetadata, StoredSource,
)


class SQLiteRepository:
    """One connection per operation; writes commit or roll back together."""

    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connection() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS uploads (
                    id TEXT PRIMARY KEY,
                    filename TEXT NOT NULL,
                    uploaded_at TEXT NOT NULL,
                    attributes_json TEXT NOT NULL,
                    source_bytes BLOB NOT NULL
                );
                CREATE INDEX IF NOT EXISTS uploads_newest ON uploads (uploaded_at DESC, id DESC);
                CREATE TABLE IF NOT EXISTS seller (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    business_name TEXT NOT NULL,
                    description TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS offerings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
                    description TEXT NOT NULL CHECK (length(trim(description)) > 0)
                );
                CREATE TABLE IF NOT EXISTS prospects (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    business_name TEXT NOT NULL CHECK (length(trim(business_name)) > 0),
                    email TEXT NOT NULL CHECK (length(trim(email)) > 0),
                    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
                    contact_name TEXT NOT NULL DEFAULT '',
                    needs TEXT NOT NULL DEFAULT ''
                );
            """)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def get_seller(self) -> SellerProfile:
        with self._connection() as connection:
            seller = connection.execute("SELECT business_name, description FROM seller WHERE id = 1").fetchone()
            offerings = self._offerings(connection)
            return SellerProfile(seller["business_name"] if seller else "", seller["description"] if seller else "", offerings)

    def save_seller(self, business_name: str, description: str) -> SellerProfile:
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO seller (id, business_name, description) VALUES (1, ?, ?) "
                "ON CONFLICT(id) DO UPDATE SET business_name = excluded.business_name, description = excluded.description",
                (business_name, description),
            )
            return SellerProfile(business_name, description, self._offerings(connection))

    @staticmethod
    def _offerings(connection: sqlite3.Connection) -> list[OfferingRecord]:
        return [OfferingRecord(**dict(row)) for row in connection.execute("SELECT id, name, description FROM offerings ORDER BY id")]

    def list_offerings(self) -> list[OfferingRecord]:
        with self._connection() as connection:
            return self._offerings(connection)

    def add_offering(self, offering: Offering) -> OfferingRecord:
        with self._connection() as connection:
            cursor = connection.execute("INSERT INTO offerings (name, description) VALUES (?, ?)", (offering.name, offering.description))
            return OfferingRecord(offering.name, offering.description, cursor.lastrowid)

    def update_offering(self, record_id: int, offering: Offering) -> OfferingRecord:
        with self._connection() as connection:
            cursor = connection.execute("UPDATE offerings SET name = ?, description = ? WHERE id = ?", (offering.name, offering.description, record_id))
            if not cursor.rowcount:
                raise NotFoundError("Offering not found.")
            return OfferingRecord(offering.name, offering.description, record_id)

    def delete_offering(self, record_id: int) -> None:
        with self._connection() as connection:
            cursor = connection.execute("DELETE FROM offerings WHERE id = ?", (record_id,))
            if not cursor.rowcount:
                raise NotFoundError("Offering not found.")

    def append_offerings(self, offerings: list[Offering]) -> int:
        with self._connection() as connection:
            connection.executemany("INSERT INTO offerings (name, description) VALUES (?, ?)", [(item.name, item.description) for item in offerings])
        return len(offerings)

    def list_prospects(self) -> list[ProspectRecord]:
        with self._connection() as connection:
            return [ProspectRecord(**dict(row)) for row in connection.execute("SELECT id, business_name, email, description, contact_name, needs FROM prospects ORDER BY id")]

    def add_prospect(self, prospect: Prospect) -> ProspectRecord:
        with self._connection() as connection:
            cursor = connection.execute(
                "INSERT INTO prospects (business_name, email, description, contact_name, needs) "
                "VALUES (:business_name, :email, :description, :contact_name, :needs)", asdict(prospect),
            )
            return ProspectRecord(**asdict(prospect), id=cursor.lastrowid)

    def update_prospect(self, record_id: int, prospect: Prospect) -> ProspectRecord:
        with self._connection() as connection:
            cursor = connection.execute(
                "UPDATE prospects SET business_name = :business_name, email = :email, "
                "description = :description, contact_name = :contact_name, needs = :needs WHERE id = :id",
                {**asdict(prospect), "id": record_id},
            )
            if not cursor.rowcount:
                raise NotFoundError("Prospect not found.")
            return ProspectRecord(**asdict(prospect), id=record_id)

    def delete_prospect(self, record_id: int) -> None:
        with self._connection() as connection:
            cursor = connection.execute("DELETE FROM prospects WHERE id = ?", (record_id,))
            if not cursor.rowcount:
                raise NotFoundError("Prospect not found.")

    def counts(self) -> tuple[int, int]:
        with self._connection() as connection:
            row = connection.execute("SELECT (SELECT count(*) FROM offerings), (SELECT count(*) FROM prospects)").fetchone()
            return row[0], row[1]

    def save_source(self, source: StoredSource) -> None:
        with self._connection() as connection:
            connection.execute(
                "INSERT INTO uploads (id, filename, uploaded_at, attributes_json, source_bytes) VALUES (?, ?, ?, ?, ?)",
                (source.id, source.filename, source.uploaded_at, json.dumps(source.attributes), source.content),
            )

    def list_sources(self) -> list[SourceMetadata]:
        with self._connection() as connection:
            rows = connection.execute("SELECT id, filename, uploaded_at, attributes_json FROM uploads ORDER BY uploaded_at DESC, id DESC")
            return [SourceMetadata(row["id"], row["filename"], row["uploaded_at"], json.loads(row["attributes_json"])) for row in rows]

    def get_source(self, source_id: str) -> StoredSource:
        with self._connection() as connection:
            row = connection.execute("SELECT id, filename, uploaded_at, attributes_json, source_bytes FROM uploads WHERE id = ?", (source_id,)).fetchone()
            if row is None:
                raise NotFoundError("Upload not found.")
            return StoredSource(row["id"], row["filename"], row["uploaded_at"], json.loads(row["attributes_json"]), bytes(row["source_bytes"]))

    def delete_source(self, source_id: str) -> None:
        with self._connection() as connection:
            cursor = connection.execute("DELETE FROM uploads WHERE id = ?", (source_id,))
            if not cursor.rowcount:
                raise NotFoundError("Upload not found.")
