import base64
import binascii
from datetime import datetime, timezone
from uuid import uuid4

from app.application.errors import ValidationError
from app.application.ports import CsvParser, SourceRepository
from app.application.uploads import CsvOptions, CsvPreview, UploadSettings
from app.domain.entities import SourceMetadata, StoredSource


class UploadUseCases:
    """Stage readable sources independently from the manually managed catalog."""

    def __init__(self, repository: SourceRepository, parser: CsvParser, settings: UploadSettings):
        self.repository = repository
        self.parser = parser
        self.settings = settings

    def _validated_source(self, filename: str, content_base64: str, options: CsvOptions) -> tuple[bytes, CsvPreview]:
        if not filename.strip():
            raise ValidationError("A filename is required.", ["Choose a CSV or TSV file."])
        if not filename.lower().endswith((".csv", ".tsv")):
            raise ValidationError("Unsupported file type.", ["Export the document as a UTF-8 CSV or TSV file. Excel and PDF uploads are not supported."])
        try:
            filename.encode("utf-8")
        except UnicodeEncodeError as exc:
            raise ValidationError("Invalid filename.", ["Use a filename containing valid Unicode text."]) from exc
        if len(content_base64) > ((self.settings.max_file_bytes + 2) // 3) * 4:
            raise self._size_error()
        try:
            source = base64.b64decode(content_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValidationError("Invalid uploaded source.", ["The file bytes must be valid base64. Select the file again."]) from exc
        if len(source) > self.settings.max_file_bytes:
            raise self._size_error()
        return source, self.parser.parse(source, options, self.settings.preview_row_limit)

    def _size_error(self) -> ValidationError:
        return ValidationError("File is too large.", [f"Choose a file no larger than {self.settings.max_file_bytes} bytes."])

    def preview(self, filename: str, content_base64: str, options: CsvOptions) -> CsvPreview:
        _, preview = self._validated_source(filename, content_base64, options)
        return preview

    def save(self, filename: str, content_base64: str, options: CsvOptions) -> dict:
        # Always validate the full submitted source, independently of any prior preview.
        source, preview = self._validated_source(filename, content_base64, options)
        record = StoredSource(
            id=str(uuid4()), filename=filename,
            uploaded_at=datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z"),
            attributes={
                "status": "Awaiting review", "delimiter": preview.delimiter,
                "requested_delimiter": options.delimiter, "has_headers": options.has_headers,
                "size_bytes": len(source), "row_count": preview.row_count,
                "column_count": preview.column_count,
            },
            content=source,
        )
        self.repository.save_source(record)
        return {**self._metadata(record), "preview": preview}

    @staticmethod
    def _metadata(record: SourceMetadata) -> dict:
        return {"id": record.id, "filename": record.filename, "uploaded_at": record.uploaded_at, **record.attributes}

    def list(self) -> list[dict]:
        return [self._metadata(record) for record in self.repository.list_sources()]

    def get(self, source_id: str) -> dict:
        record = self.repository.get_source(source_id)
        attributes = record.attributes
        options = CsvOptions(
            delimiter=str(attributes["requested_delimiter"]),
            has_headers=bool(attributes["has_headers"]),
            resolved_delimiter=str(attributes["delimiter"]),
        )
        # New upload size limits do not invalidate previously saved documents.
        preview = self.parser.parse(record.content, options, self.settings.preview_row_limit)
        return {**self._metadata(record), "preview": preview}

    def delete(self, source_id: str) -> None:
        self.repository.delete_source(source_id)
