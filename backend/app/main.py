from pathlib import Path
from typing import TYPE_CHECKING

from app.presentation.cli import run_cli

if TYPE_CHECKING:
    from fastapi import FastAPI


def create_app(database_path: str | Path | None = None) -> "FastAPI":
    """Composition root used by uvicorn with --factory or by isolated tests."""
    from fastapi import FastAPI

    from app.application.use_cases.sales import SalesUseCases
    from app.application.use_cases.uploads import UploadUseCases
    from app.infrastructure.config import database_path as configured_database_path, upload_settings
    from app.infrastructure.csv_parser import CsvSourceParser
    from app.infrastructure.sqlite_repository import SQLiteRepository
    from app.presentation.api.errors import register_error_handlers
    from app.presentation.api.routes import create_router

    settings = upload_settings()
    repository = SQLiteRepository(database_path if database_path is not None else configured_database_path())
    use_cases = SalesUseCases(repository)
    uploads = UploadUseCases(repository, CsvSourceParser(), settings)
    app = FastAPI(title="Sales Outreach Assistant", version="0.1.0")
    register_error_handlers(app)
    app.include_router(create_router(use_cases, uploads))
    return app


def main() -> None:
    run_cli()


if __name__ == "__main__":
    main()
