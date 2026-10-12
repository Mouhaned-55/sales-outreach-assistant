import { useEffect, useState } from "react";
import {
  request,
  type Delimiter,
  type StagedUpload,
  type UploadDetail,
  type UploadPreview,
  type UploadSettings,
} from "./api";
import { EmptyState, Icon, Notice } from "./components";
import { CatalogPreview, delimiterLabel } from "./CatalogPreview";
import { encodeUploadFile, type UploadSource } from "./uploadFile";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
};

export function CatalogUploads({ open, onOpenChange, busy, setBusy }: Props) {
  const [settings, setSettings] = useState<UploadSettings | null>(null);
  const [uploads, setUploads] = useState<StagedUpload[]>([]);
  const [source, setSource] = useState<UploadSource | null>(null);
  const [delimiter, setDelimiter] = useState<Delimiter>("auto");
  const [hasHeaders, setHasHeaders] = useState(true);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [selected, setSelected] = useState<UploadDetail | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [operation, setOperation] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.all([
      request<UploadSettings>("/uploads/settings"),
      request<StagedUpload[]>("/uploads"),
    ])
      .then(([configuration, saved]) => {
        if (active) {
          setSettings(configuration);
          setUploads(saved);
        }
      })
      .catch((err: Error) => {
        if (active) setLoadError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  function begin(message: string) {
    setBusy(true);
    setOperation(message);
    setError("");
    setSuccess("");
  }
  function finish() {
    setBusy(false);
    setOperation("");
  }
  function invalidatePreview() {
    setPreview(null);
    setError("");
    setSuccess("");
  }

  async function chooseFile(file?: File) {
    setSource(null);
    setPreview(null);
    setError("");
    setSuccess("");
    if (!file || !settings) return;
    begin("Reading file…");
    try {
      setSource(await encodeUploadFile(file, settings.max_file_bytes));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      finish();
    }
  }

  async function buildPreview() {
    if (!source || busy) return;
    begin("Checking the complete file and preparing a preview…");
    setPreview(null);
    try {
      setPreview(
        await request<UploadPreview>("/uploads/preview", "POST", {
          ...source,
          delimiter,
          has_headers: hasHeaders,
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      finish();
    }
  }

  async function stage() {
    if (!source || !preview || busy) return;
    begin("Saving the source for later review…");
    try {
      const saved = await request<UploadDetail>("/uploads", "POST", {
        ...source,
        delimiter,
        has_headers: hasHeaders,
      });
      setUploads((current) => [saved, ...current]);
      setSelected(saved);
      setSource(null);
      setPreview(null);
      onOpenChange(false);
      setSuccess("Upload saved — awaiting review. No offerings were created.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      finish();
    }
  }

  async function reopen(upload: StagedUpload) {
    if (busy) return;
    begin("Opening saved upload…");
    setSelected(null);
    try {
      setSelected(
        await request<UploadDetail>(
          `/uploads/${encodeURIComponent(upload.id)}`,
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      finish();
    }
  }

  async function remove(upload: StagedUpload) {
    if (
      busy ||
      !window.confirm(
        `Delete the staged upload “${upload.filename}” and its original source? Your saved offerings will not change. This cannot be undone.`,
      )
    )
      return;
    begin("Deleting upload…");
    try {
      await request(`/uploads/${encodeURIComponent(upload.id)}`, "DELETE");
      setUploads((current) => current.filter((item) => item.id !== upload.id));
      if (selected?.id === upload.id) setSelected(null);
      setSuccess("Staged upload deleted. Saved offerings are unchanged.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      finish();
    }
  }

  return (
    <section
      className="uploads-workspace"
      aria-label="Catalog uploads for review"
    >
      <Notice error={loadError || error} success={success} />
      {loadError && (
        <button
          className="button secondary retry"
          disabled={busy || loading}
          onClick={() => setReload((value) => value + 1)}
        >
          Reload uploads
        </button>
      )}
      {operation && (
        <p className="upload-status" role="status">
          {operation}
        </p>
      )}
      {open && (
        <section className="panel import-panel">
          <div className="panel-heading">
            <div>
              <h2>Upload for review</h2>
              <p>Save your catalog source without changing your offerings.</p>
            </div>
            <Icon name="upload" />
          </div>
          <p className="upload-explanation">
            CSV files may have any column names, duplicate or empty labels, or
            no header row. AI review and mapping are planned, not implemented.
          </p>
          <div className="import-instructions">
            <p>
              UTF-8 CSV only, with comma, semicolon, or tab separators. Excel
              and PDF are not supported.
              {settings && (
                <>
                  {" "}
                  Limit: {settings.max_file_bytes.toLocaleString()} bytes per
                  file; preview up to {settings.preview_row_limit} data rows.
                </>
              )}
            </p>
            <a href="/api/offerings/example.csv" download="catalog-example.csv">
              Download example CSV ↗
            </a>
          </div>
          <fieldset disabled={busy || loading || !settings || !!loadError}>
            <label className="file-label" htmlFor="catalog-file">
              Choose a CSV file
            </label>
            <input
              id="catalog-file"
              className="file-input"
              type="file"
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              onChange={(event) => {
                void chooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            {source && (
              <p className="selected-filename">
                Selected: <strong>{source.filename}</strong>
              </p>
            )}
            <div className="upload-options">
              <div className="field">
                <label htmlFor="catalog-delimiter">Column separator</label>
                <select
                  id="catalog-delimiter"
                  value={delimiter}
                  onChange={(event) => {
                    setDelimiter(event.target.value as Delimiter);
                    invalidatePreview();
                  }}
                >
                  <option value="auto">Auto-detect</option>
                  <option value=",">Comma (,)</option>
                  <option value=";">Semicolon (;)</option>
                  <option value={"\t"}>Tab</option>
                </select>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={hasHeaders}
                  onChange={(event) => {
                    setHasHeaders(event.target.checked);
                    invalidatePreview();
                  }}
                />
                First row contains headers
              </label>
            </div>
            <p className="preview-caption">
              If columns look wrong or detection fails, choose a separator and
              preview again. Uncheck headers to keep the first row as data.
            </p>
            <div className="button-group">
              <button
                className="button secondary"
                disabled={!source}
                onClick={() => void buildPreview()}
              >
                Preview CSV
              </button>
              <button
                className="text-button"
                onClick={() => {
                  onOpenChange(false);
                  setSource(null);
                  setPreview(null);
                }}
              >
                Cancel upload
              </button>
            </div>
          </fieldset>
          {preview && (
            <>
              <CatalogPreview preview={preview} />
              <div className="button-group">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void stage()}
                >
                  Save upload for review
                </button>
                <span className="preview-caption">
                  Saves the complete source. Does not add to the offering count.
                </span>
              </div>
            </>
          )}
        </section>
      )}

      <section className="panel staged-list">
        <div className="panel-heading padded">
          <div>
            <h2>Uploads awaiting review</h2>
            <p>
              Saved sources, separate from your offering catalog. AI review and
              mapping are not available yet.
            </p>
          </div>
          <span className="count-label">
            {loading || loadError ? "—" : uploads.length} uploads
          </span>
        </div>
        {loading ? (
          <p className="upload-status" role="status">
            Loading saved uploads…
          </p>
        ) : loadError ? (
          <p className="upload-status">
            Your saved uploads could not be loaded. Use Reload uploads to try
            again.
          </p>
        ) : uploads.length === 0 ? (
          <EmptyState icon="upload" title="Keep your catalog ready for review">
            Choose Upload for review to preview and save a CSV. Add offerings
            manually to use them in your catalog today.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Parsing settings</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((upload) => (
                  <tr key={upload.id}>
                    <td>
                      <strong>{upload.filename}</strong>
                      <small className="table-secondary">
                        <time dateTime={upload.uploaded_at}>
                          {new Date(upload.uploaded_at).toLocaleString()}
                        </time>
                        <br />
                        {upload.row_count} rows · {upload.column_count} columns
                        · {upload.size_bytes.toLocaleString()} bytes
                      </small>
                    </td>
                    <td>
                      {delimiterLabel(upload.delimiter)}
                      {upload.requested_delimiter === "auto"
                        ? " (auto-detected)"
                        : " (selected)"}
                      <small className="table-secondary">
                        {upload.has_headers
                          ? "First row is headers"
                          : "No header row"}
                      </small>
                    </td>
                    <td>
                      <span className="pill">{upload.status}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          disabled={busy}
                          onClick={() => void reopen(upload)}
                          aria-label={`Open ${upload.filename}`}
                        >
                          Open
                        </button>
                        <button
                          disabled={busy}
                          className="danger-text"
                          onClick={() => void remove(upload)}
                          aria-label={`Delete upload ${upload.filename}`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {selected && (
        <section className="panel import-panel saved-upload">
          <div className="panel-heading">
            <div>
              <h2>{selected.filename}</h2>
              <p>
                <time dateTime={selected.uploaded_at}>
                  {new Date(selected.uploaded_at).toLocaleString()}
                </time>{" "}
                · {selected.status}
              </p>
            </div>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setSelected(null)}
            >
              Close preview
            </button>
          </div>
          <p className="upload-explanation">
            Reopened with the saved parsing settings. The original source is
            stored separately; AI review and mapping are planned.
          </p>
          <CatalogPreview preview={selected.preview} saved />
        </section>
      )}
    </section>
  );
}
