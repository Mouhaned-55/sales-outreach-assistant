from dataclasses import dataclass


@dataclass(frozen=True)
class CsvOptions:
    delimiter: str = "auto"
    has_headers: bool = True
    resolved_delimiter: str | None = None


@dataclass
class CsvPreview:
    headers: list[str] | None
    rows: list[list[str]]
    row_count: int
    column_count: int
    delimiter: str
    requested_delimiter: str
    has_headers: bool
    truncated: bool
    warnings: list[str]


@dataclass(frozen=True)
class UploadSettings:
    max_file_bytes: int = 1048576
    preview_row_limit: int = 50
