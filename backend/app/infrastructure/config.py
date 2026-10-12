import os
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATABASE_PATH = BACKEND_ROOT / "data" / "outreach.sqlite3"


def database_path() -> Path:
    """Resolve relative overrides under backend, independent of the shell cwd."""
    configured = os.environ.get("OUTREACH_DB_PATH", "").strip()
    if not configured:
        return DEFAULT_DATABASE_PATH
    path = Path(configured).expanduser()
    return path if path.is_absolute() else BACKEND_ROOT / path


def _positive_environment_int(name: str, default: int, cap: int) -> int:
    value = os.environ.get(name, str(default))
    try:
        result = int(value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive integer no larger than {cap}.") from exc
    if not 1 <= result <= cap:
        raise ValueError(f"{name} must be a positive integer no larger than {cap}.")
    return result


def upload_settings():
    from app.application.uploads import UploadSettings

    return UploadSettings(
        max_file_bytes=_positive_environment_int("OUTREACH_UPLOAD_MAX_BYTES", 1048576, 64 * 1024 * 1024),
        preview_row_limit=_positive_environment_int("OUTREACH_UPLOAD_PREVIEW_ROWS", 50, 1000),
    )
