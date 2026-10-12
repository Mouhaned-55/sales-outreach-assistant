import { useEffect, useState } from "react";
import type { UploadPreview } from "./api";
import { previewPage } from "./uploadView";

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
  const [rowPage, setRowPage] = useState(0);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    setColumnPage(0);
    setRowPage(0);
    setExpanded(false);
  }, [preview]);
  const rowWindow = previewPage(preview.rows.length, rowPage, expanded);
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
    <div className={`preview ${expanded ? "preview-expanded" : ""}`}>
      <div className="preview-heading">
        <h3>
          {preview.row_count} data rows · {preview.column_count} columns
        </h3>
        <span className="pill">
          {delimiterLabel(preview.delimiter)} ·{" "}
          {preview.has_headers ? "First row is headers" : "No header row"}
        </span>
      </div>
      <div className="preview-controls">
        <nav className="button-group" aria-label="Preview rows">
          <button
            className="button secondary"
            disabled={rowWindow.page === 0}
            onClick={() => setRowPage(rowWindow.page - 1)}
          >
            Previous rows
          </button>
          <span className="preview-caption" role="status">
            Page {rowWindow.page + 1} of {rowWindow.pages} · Rows{" "}
            {preview.rows.length ? rowWindow.start + 1 : 0}–{rowWindow.end} of{" "}
            {preview.rows.length} previewed
          </span>
          <button
            className="button secondary"
            disabled={rowWindow.page === rowWindow.pages - 1}
            onClick={() => setRowPage(rowWindow.page + 1)}
          >
            Next rows
          </button>
        </nav>
        <button
          className="button secondary"
          aria-expanded={expanded}
          onClick={() => {
            setExpanded(!expanded);
            setRowPage(0);
          }}
        >
          {expanded ? "Collapse preview" : "Expand preview"}
        </button>
      </div>
      <p className="preview-caption">
        {expanded
          ? "Expanded view · 25 rows per page"
          : "Compact view · 10 rows per page"}
        . Expanding does not load rows beyond the configured preview limit.
      </p>
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
            {preview.rows
              .slice(rowWindow.start, rowWindow.end)
              .map((row, rowIndex) => (
                <tr key={rowWindow.start + rowIndex}>
                  <th scope="row">{rowWindow.start + rowIndex + 1}</th>
                  {columns.map((columnIndex) => (
                    <td key={columnIndex}>
                      {columnIndex >= row.length ? (
                        <span className="cell-placeholder">No cell</span>
                      ) : row[columnIndex] === "" ? (
                        <span className="cell-placeholder">Empty value</span>
                      ) : (
                        <span className="original-cell">
                          {row[columnIndex]}
                        </span>
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
