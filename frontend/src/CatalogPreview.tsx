import { useEffect, useState } from "react";
import type { UploadPreview } from "./api";

const COLUMNS_PER_PAGE = 25;

export function delimiterLabel(delimiter: string): string {
  return delimiter === "\t"
    ? "Tab"
    : delimiter === ";"
      ? "Semicolon"
      : delimiter === ","
        ? "Comma"
        : "Auto-detect";
}

export function CatalogPreview({
  preview,
  saved = false,
}: {
  preview: UploadPreview;
  saved?: boolean;
}) {
  const [columnPage, setColumnPage] = useState(0);
  useEffect(() => {
    setColumnPage(0);
  }, [preview]);
  const lastPage = Math.max(
    0,
    Math.ceil(preview.column_count / COLUMNS_PER_PAGE) - 1,
  );
  const page = Math.min(columnPage, lastPage);
  const startColumn = page * COLUMNS_PER_PAGE;
  const endColumn = Math.min(
    startColumn + COLUMNS_PER_PAGE,
    preview.column_count,
  );
  // These numbers describe positions; original headers never become object keys.
  // Limit mounted cells even when a later ragged record has thousands of columns.
  const columns = Array.from(
    { length: endColumn - startColumn },
    (_, index) => startColumn + index,
  );
  return (
    <div className="preview">
      <div className="preview-heading">
        <h3>
          {preview.row_count} data rows · {preview.column_count} columns
        </h3>
        <span className="pill">
          {delimiterLabel(preview.delimiter)} ·{" "}
          {preview.has_headers ? "First row is headers" : "No header row"}
        </span>
      </div>
      {preview.warnings.length > 0 && (
        <div className="notice warning" role="status">
          <ul>
            {preview.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="preview-caption">
        Showing {preview.rows.length} of {preview.row_count} data rows.{" "}
        {preview.truncated && "This row preview is limited. "}
        {saved
          ? "The complete source is saved."
          : "The complete source is retained when saved."}{" "}
        Column numbers show position, not replacement header names.
      </p>
      {lastPage > 0 && (
        <div
          className="button-group column-pagination"
          aria-label="Preview columns"
        >
          <button
            className="button secondary"
            disabled={page === 0}
            onClick={() => setColumnPage(page - 1)}
          >
            Previous columns
          </button>
          <span className="preview-caption" role="status">
            Columns {startColumn + 1}–{endColumn} of {preview.column_count}
          </span>
          <button
            className="button secondary"
            disabled={page === lastPage}
            onClick={() => setColumnPage(page + 1)}
          >
            Next columns
          </button>
        </div>
      )}
      <div
        className="table-scroll preview-table"
        tabIndex={0}
        role="region"
        aria-label="Catalog preview; scroll to view the current column page"
      >
        <table className="positional-table">
          <caption className="sr-only">
            Original column labels and positional cell values
          </caption>
          <thead>
            <tr>
              <th scope="col">Data row</th>
              {columns.map((index) => (
                <th scope="col" key={index}>
                  <span className="column-position">Column {index + 1}</span>
                  {preview.headers === null ? (
                    <span className="muted">No header row</span>
                  ) : index >= preview.headers.length ? (
                    <span className="muted">No header cell</span>
                  ) : preview.headers[index] === "" ? (
                    <span className="muted">Empty label</span>
                  ) : (
                    <span className="original-cell">
                      {preview.headers[index]}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">{rowIndex + 1}</th>
                {columns.map((columnIndex) => (
                  <td key={columnIndex}>
                    {columnIndex >= row.length ? (
                      <span className="cell-placeholder">No cell</span>
                    ) : row[columnIndex] === "" ? (
                      <span className="cell-placeholder">Empty value</span>
                    ) : (
                      <span className="original-cell">{row[columnIndex]}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {preview.rows.length === 0 && (
        <p className="below-note">This file has headers but no data rows.</p>
      )}
      <p className="preview-caption">
        “Empty label”, “Empty value”, and “No cell” are display hints, not
        stored replacements. Spaces and line breaks are preserved. Cell text is
        never executed.
      </p>
    </div>
  );
}
