class ValidationError(Exception):
    """Invalid workflow input, independent of HTTP or parsing libraries."""

    def __init__(self, message: str, details: list[str] | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


class NotFoundError(Exception):
    """A requested saved record no longer exists."""
