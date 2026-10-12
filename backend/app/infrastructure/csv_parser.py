import csv
import io

from app.application.errors import ValidationError
from app.application.uploads import CsvOptions, CsvPreview

DELIMITERS = (",", ";", "\t")
# The configurable source cap is at most 64 MiB. Raising this once also allows
# reopening an older source after the current upload limit has been lowered.
csv.field_size_limit(max(csv.field_size_limit(), 64 * 1024 * 1024))


class CsvSourceParser:
    """Read positional cells without interpreting or converting catalog fields."""

    def parse(self, source: bytes, options: CsvOptions, preview_limit: int) -> CsvPreview:
        try:
            text = source.decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError("Unsupported text encoding.", [f"The file is not valid UTF-8 near byte {exc.start}. Export it as UTF-8 CSV or TSV."]) from exc
        if not text.strip():
            raise ValidationError("The file is empty.", ["Choose a CSV containing nonblank text."])
        if any((ord(char) < 32 and char not in "\t\r\n") or 127 <= ord(char) <= 159 for char in text):
            raise ValidationError("The file contains binary control characters.", ["NUL and binary controls are not supported. Export the original document as UTF-8 CSV or TSV."])

        warnings: list[str] = []
        if options.delimiter == "auto":
            detected, ambiguous = self._detect_delimiter(text)
            delimiter = options.resolved_delimiter or detected
            if ambiguous:
                warnings.append("Automatic delimiter detection is ambiguous. Check the preview and choose comma, semicolon, or tab explicitly if needed.")
        else:
            delimiter = options.resolved_delimiter or options.delimiter
        if delimiter not in DELIMITERS:
            raise ValidationError("Unsupported delimiter.", ["Choose automatic detection, comma, semicolon, or tab."])
        self._validate_quotes(text, delimiter)
        reader = csv.reader(io.StringIO(text, newline=""), delimiter=delimiter, strict=True)
        headers: list[str] | None = None
        rows: list[list[str]] = []
        row_count = 0
        column_count = 0
        widths: set[int] = set()
        has_text = False
        try:
            if options.has_headers:
                headers = next(reader, [])
                column_count = len(headers)
                widths.add(len(headers))
                has_text = any(value.strip() for value in headers)
                if any(not value.strip() for value in headers):
                    warnings.append("Some header labels are blank; their original positions are preserved.")
                if len(set(headers)) != len(headers):
                    warnings.append("Some header labels are repeated; columns remain separate by position.")
            for row in reader:
                row_count += 1
                column_count = max(column_count, len(row))
                widths.add(len(row))
                has_text = has_text or any(value.strip() for value in row)
                if len(rows) < preview_limit:
                    rows.append(row)
        except csv.Error as exc:
            raise ValidationError("Malformed CSV.", [f"CSV near line {reader.line_num}: {exc}. Check quoting and the selected delimiter."]) from exc
        if not has_text:
            raise ValidationError("The file has no readable cells.", ["Choose a CSV containing at least one nonblank cell."])
        if len(widths) > 1:
            warnings.append("Records have different column counts, including any blank records. All cells are preserved by position.")
        return CsvPreview(headers, rows, row_count, column_count, delimiter, options.delimiter, options.has_headers, row_count > len(rows), warnings)

    @staticmethod
    def _detect_delimiter(text: str) -> tuple[str, bool]:
        # Count supported separators only outside quoted fields. Ties use the
        # documented comma/semicolon/tab order and always produce a warning.
        counts = dict.fromkeys(DELIMITERS, 0)
        in_quotes = False
        index = 0
        while index < len(text):
            char = text[index]
            if char == '"':
                if in_quotes and index + 1 < len(text) and text[index + 1] == '"':
                    index += 2
                    continue
                in_quotes = not in_quotes
            elif not in_quotes and char in counts:
                counts[char] += 1
            index += 1
        detected = max(DELIMITERS, key=counts.get)
        ambiguous = sum(count > 0 for count in counts.values()) != 1
        return detected, ambiguous

    @staticmethod
    def _validate_quotes(text: str, delimiter: str) -> None:
        # csv.reader(strict=True) still accepts quotes embedded in an unquoted
        # field. Reject those and other malformed boundaries explicitly.
        state = "start"
        line = 1
        for index, char in enumerate(text):
            newline = char in "\r\n"
            if state == "quoted":
                if char == '"':
                    state = "after_quote"
            elif state == "after_quote":
                if char == '"':
                    state = "quoted"
                elif char == delimiter or newline:
                    state = "start"
                else:
                    raise ValidationError("Malformed CSV quoting.", [f"Unexpected text after a closing quote near line {line}. Check quoting or choose the correct delimiter."])
            elif char == '"':
                if state != "start":
                    raise ValidationError("Malformed CSV quoting.", [f"Unexpected quote in an unquoted cell near line {line}. Quote the complete cell or choose the correct delimiter."])
                state = "quoted"
            elif char == delimiter or newline:
                state = "start"
            else:
                state = "unquoted"
            if char == "\n" or (char == "\r" and (index + 1 == len(text) or text[index + 1] != "\n")):
                line += 1
        if state == "quoted":
            raise ValidationError("Malformed CSV quoting.", [f"A quoted cell is not closed near line {line}. Close the quote and try again."])
