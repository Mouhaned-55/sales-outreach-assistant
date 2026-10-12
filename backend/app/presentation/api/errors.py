import logging
import sqlite3

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.application.errors import NotFoundError, ValidationError

logger = logging.getLogger(__name__)


def error_response(status: int, message: str, details: list[str] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"message": message, "details": details or []}})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def request_validation_error(request: Request, error: RequestValidationError):
        details = [f"{'.'.join(str(part) for part in item['loc'])}: {item['msg']}" for item in error.errors()]
        return error_response(422, "Please check the supplied information.", details)

    @app.exception_handler(ValidationError)
    async def workflow_validation_error(request: Request, error: ValidationError):
        return error_response(422, error.message, error.details)

    @app.exception_handler(NotFoundError)
    async def not_found_error(request: Request, error: NotFoundError):
        return error_response(404, str(error))

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        return error_response(error.status_code, str(error.detail))

    @app.exception_handler(sqlite3.Error)
    async def storage_error(request: Request, error: sqlite3.Error):
        logger.exception("SQLite operation failed", exc_info=error)
        return error_response(500, "Unable to save or load data. Please try again.")
