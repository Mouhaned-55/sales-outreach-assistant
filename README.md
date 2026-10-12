# Sales Outreach Assistant

A local workspace for preparing thoughtful sales outreach for any business. Save your business profile, organize products and services, and keep prospect information together. The React dashboard reads and writes real data through a Python API.

This milestone is for **local, single-user use**. AI drafting, human approval, and real email delivery are planned; they are not connected or simulated.

## What works

- Save and edit a seller's business name and description.
- Add, edit, delete, and list offerings (products or services).
- Preview arbitrary-column CSV catalogs and save the complete source separately as **Awaiting review**. List, reopen, and delete staged uploads without changing offerings.
- Add, edit, delete, and list prospects, including optional contact names and needs notes.
- View saved counts and a setup checklist based on actual data.
- Keep saved data across backend restarts with SQLite.
- Use the original welcome-message CLI.

Planned: AI catalog review and column mapping, Excel import, AI email drafts, review and approval, and sending approved emails. CSV uploads do not perform AI review or create offerings. PDF upload is not supported. There is no authentication, scraping, background processing, or production deployment.

## Architecture

```text
backend/
  app/
    domain/entities.py             # Plain dataclasses: seller, offering, prospect
    application/
      ports.py                     # Persistence and source-parser protocols
      errors.py                    # Application errors without HTTP dependencies
      use_cases/sales.py           # Manual seller, offering, prospect workflows
      uploads.py                   # Parsing settings and positional preview DTOs
      use_cases/uploads.py         # Preview, stage, list, reopen, delete sources
    infrastructure/
      sqlite_repository.py         # CRUD and separate source BLOB/metadata storage
      csv_parser.py                # UTF-8, delimiters, positional CSV parsing
      config.py                    # Database path configuration
    presentation/
      api/schemas.py               # Pydantic request and response models
      api/routes.py                # HTTP endpoints that call use cases
      api/errors.py                # Consistent API errors
      cli.py                       # Original terminal welcome message
    main.py                        # Composition root and CLI entry point
  tests/                           # unittest persistence, CSV, API, and CLI tests
  examples/offerings.csv            # Fictional sample catalog
  data/outreach.sqlite3            # Created on first backend startup; Git-ignored
  requirements.txt
  .env.example
frontend/
  src/
    App.tsx                        # Navigation, workspace data, overview, outreach
    pages.tsx                      # Business, offering, and prospect forms/tables
    CatalogUploads.tsx             # Staging settings, upload list, reopen/delete
    CatalogPreview.tsx             # Original labels and positional cell preview
    uploadFile.ts                  # Byte-preserving base64 transport
    api.ts                         # Typed HTTP client and error handling
    components.tsx                 # Shared fields, notices, icons, empty states
    styles.css                     # Responsive layout and visual design
    main.tsx                       # React entry point
  vite.config.ts                   # Local /api proxy
  package.json
  package-lock.json
README.md
data/seller_profile.json            # Preserved original placeholder; not active storage
.venv/                              # Preserved original Python environment
```

Dependencies point inward: **presentation → application → domain** and **infrastructure → application/domain**. Domain models do not import FastAPI, Pydantic, SQLite, file paths, or AI SDKs. Application ports describe needed capabilities; infrastructure implements them. `app/main.py:create_app` constructs and connects these implementations.

Example request flow:

```text
React form → api.ts → Vite /api proxy → FastAPI route / Pydantic
           → SalesUseCases → SalesRepository port → SQLiteRepository
           → SQLite transaction → JSON response → refreshed dashboard
```

CSV source bytes are sent as base64 inside JSON, so the browser does not decode or replace characters. Infrastructure validates UTF-8 strictly and parses positional rows. Preview never writes. **Save upload for review** validates the complete source and stores its original bytes (including BOM), filename, UTC upload time, selected/detected delimiter, header choice, and status in a separate SQLite table. A generated UUID identifies the stored source; filenames are metadata, never filesystem paths. Staging has no dependency on offering creation and does not affect dashboard offering counts. AI review and mapping are a future milestone.

## Prerequisites

- Python 3.12 (the existing environment uses 3.12.12).
- Node.js 22.12+ (including TypeScript type stripping for the dependency-free frontend tests). Node.js 24 LTS is a suitable choice.
- npm, included with Node.js.

The commands below use macOS/Linux shell syntax and run from this repository. No API keys or external accounts are required.

## Install

Create a separate backend environment if it does not already exist. **Do not move or recreate the original root `.venv`.** This workspace already has `backend/.venv` prepared.

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant
# Run only if backend/.venv does not exist:
.venv/bin/python -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci
```

On a fresh clone without a root `.venv`, use `python3.12 -m venv backend/.venv` instead. `requirements.txt` includes the HTTP test client as well as runtime dependencies. Tests use standard-library `unittest`. The frontend uses React and plain CSS, with TypeScript and Vite as development tools.

## Run in two terminals

Terminal 1 — backend:

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant/backend
.venv/bin/python -m uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant/frontend
npm run dev
```

Open **http://127.0.0.1:5173**. API documentation is at **http://127.0.0.1:8000/docs**. Stop each server with `Ctrl+C`.

Vite serves port **5173** and proxies `/api` to `http://127.0.0.1:8000`. React uses relative `/api` URLs, so no broad CORS configuration is needed. Both servers bind to loopback. The frontend intentionally fails if port 5173 is occupied, rather than silently changing URLs.

Preserved CLI (from `backend/`):

```bash
.venv/bin/python -m app.main
```

It prints:

```text
Welcome to Sales Outreach Assistant!
Create tailored sales emails for your business.
```

The CLI also works with `../.venv/bin/python -m app.main`; API dependencies are imported only when creating the API application.

## Configuration and saved data

The default database is **`backend/data/outreach.sqlite3`**, created automatically. Its location is independent of the directory from which the process starts. Changes survive restarts; back up this file with the backend stopped if you want to preserve a copy. Databases and virtual environments are ignored by Git.

`backend/.env.example` documents this optional setting:

```dotenv
OUTREACH_DB_PATH=data/outreach.sqlite3
OUTREACH_UPLOAD_MAX_BYTES=1048576
OUTREACH_UPLOAD_PREVIEW_ROWS=50
```

`.env` files are **not loaded automatically**. To choose another file, export the setting before launching the backend:

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant/backend
export OUTREACH_DB_PATH=data/my-workspace.sqlite3
.venv/bin/python -m uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Relative paths resolve under `backend/`; absolute paths also work. To return to the default, run `unset OUTREACH_DB_PATH` before restarting. The original `data/seller_profile.json` is preserved and is not imported automatically. There are no credentials in the frontend or example configuration.

## CSV uploads for review

In **Offerings**, the upload area is visible by default. Click the prominent **Choose CSV file** area or drag and drop one `.csv` or `.tsv` file onto it. Multiple files are rejected explicitly; picker and drop use the same validation. Choose **Auto-detect**, **Comma**, **Semicolon**, or **Tab**, and specify whether the **first row contains headers**. Selecting or dropping a file automatically prepares its preview. If detection is wrong, change the separator or header checkbox; the preview refreshes automatically. A failed preview keeps the source available for **Retry preview**. **Clear file** resets the selection without hiding the upload area. Only **Save upload for review** persists the source.

Columns can have any labels, including duplicate or empty labels. No `name,description` mapping is required. For example:

```csv
SKU,Product title,Price,Price,
A-001,"Desk lamp, adjustable",35,40,
S-002,Workspace setup,120,150,Service
```

- UTF-8 with or without BOM is supported. Unsupported encoding is rejected with instructions to re-export as UTF-8, never decoded with replacement characters.
- Quoted delimiters and newlines are supported. Whitespace, original labels, blank rows, empty cells, and variable-width rows are retained; rows are lists, never dictionaries keyed by header names.
- Preview rows are paginated by default: 10 per page in compact view. **Expand preview** shows 25 rows per page in a taller table; **Collapse preview** restores compact view. These controls do not fetch beyond the configured preview limit. Row controls stay visible even for a single page.
- Wide previews show 25 columns per page with Previous/Next controls; all original columns remain stored. Column numbers and empty/missing-cell hints are display aids only. Source values are never rewritten. Cells are rendered as plain text, including HTML-like text and formulas.
- Empty/all-whitespace sources and malformed CSV produce actionable errors. The entire file is validated, including rows beyond the preview.
- Defaults: **1 MiB (1,048,576 bytes)** per source and **50 preview data rows**. Configure `OUTREACH_UPLOAD_MAX_BYTES` (1–67,108,864 bytes) and `OUTREACH_UPLOAD_PREVIEW_ROWS` (1–1,000 rows) in the backend shell before startup; invalid settings fail startup with the variable name. Preview truncation never truncates the stored source. There is no old 1,000-offering import limit.
- Preview does not persist. **Save upload for review** creates a separate upload with status **Awaiting review**. It does not create offerings or complete the offering checklist step.
- The **Uploads awaiting review** list shows filename, upload time, size, parsing settings and status. **Open** reloads a saved source preview with its saved settings; **Delete** removes only that source after confirmation.
- Staged files survive backend restarts and are included in your SQLite backup. Reopening an older source does not reject it just because the new-upload size limit was lowered.
- AI review and mapping are planned, not implemented. Add offerings manually to use them in the catalog today. Excel and PDF files are not accepted.

The original offering, seller, and prospect tables/data are preserved. This update adds separate staged storage; no conversion or migration of existing catalog values occurs.

## API reference

All endpoints have the `/api` prefix. Listing endpoints return arrays; successful deletes return HTTP 204.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/health` | GET | Local API availability |
| `/seller` | GET, PUT | Read/save the singleton business profile |
| `/offerings` | GET, POST | List/add catalog entries |
| `/offerings/{id}` | PUT, DELETE | Edit/delete one offering |
| `/uploads/settings` | GET | Configured size and preview limits |
| `/uploads/preview` | POST | Parse a source without writing |
| `/uploads` | GET, POST | List or save staged sources |
| `/uploads/{id}` | GET, DELETE | Reopen or delete one staged source |
| `/offerings/example.csv` | GET | Download an example |
| `/prospects` | GET, POST | List/add prospects |
| `/prospects/{id}` | PUT, DELETE | Edit/delete one prospect |
| `/dashboard` | GET | Profile completeness and real saved counts |

Upload preview and staging accept JSON fields `filename`, `content_base64` (original file bytes), `delimiter` (`"auto"`, `","`, `";"`, or `"\t"`), and `has_headers` (boolean). Responses contain positional `headers`/`rows`, full row/column counts, preview truncation status and parsing warnings. Staged records additionally expose the generated ID, filename, UTC timestamp, byte size, parsing settings and `Awaiting review` status. The previous `/offerings/import/preview` and `/offerings/import/confirm` routes have been removed.

Prospect fields are `business_name`, `email`, `description`, optional `contact_name`, and optional `needs`. The seller is complete when its saved business name and description are both nonblank. Other checklist steps require at least one saved offering and one saved prospect; staged uploads do not count.

Errors use `{"error": {"message": "...", "details": ["..."]}}`. Pydantic rejects invalid HTTP fields and validates email syntax; it does not check that a mailbox exists. There are no drafting or sending endpoints.

## Verification

Backend tests:

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant/backend
.venv/bin/python -m unittest discover -s tests -v
.venv/bin/python -m app.main
.venv/bin/python -m pip check
```

Frontend checks:

```bash
cd /Users/macbook/Development/agentic-projects/sales-outreach-assistant/frontend
npm test
npm run typecheck
npm run build
```

Optional local production-build preview: keep the backend running, run `npm run preview`, and open `http://127.0.0.1:4173`. The same `/api` proxy is configured for preview. This is not a production deployment.

Backend tests use temporary databases and cover persistence across new application/repository instances, manual CRUD, invalid HTTP inputs, arbitrary/duplicate/blank headers, headerless files, delimiters and overrides, exact source-byte preservation, malformed/unsupported input, preview limits, and staging without creating offerings. Frontend tests cover byte-preserving upload transport and configured file-size limits. HTTP integration checks use separate temporary storage, never saved user data. Browser rendering and interactive keyboard/mobile behavior have not been verified with browser automation in this environment.

## Troubleshooting

- **`No module named app`**: run Python commands from `backend/`, not the repository root.
- **Missing FastAPI, Uvicorn, or other modules**: install `backend/requirements.txt` using `backend/.venv/bin/python`; use that interpreter to start the API.
- **`npm` is missing or Vite reports a Node version error**: install a supported Node.js version, reopen the terminal, then run `npm ci` in `frontend/`.
- **Frontend says it cannot reach the workspace / proxy errors**: confirm the backend is running on `127.0.0.1:8000`, check its terminal, then use **Reload workspace**.
- **Port already in use**: stop the other process or an older copy of this app. If changing backend ports, also update the proxy target in `frontend/vite.config.ts` and restart Vite.
- **Expected data is missing**: check `OUTREACH_DB_PATH`. A different path means a different database. Returning to the prior path restores access to that file.
- **Database cannot be opened or is locked**: verify the configured directory is writable and run one backend instance for this local workspace.
- **CSV rejected or columns look wrong**: export as UTF-8 `.csv`/`.tsv`, select the correct delimiter, set the header checkbox explicitly, and check quoting/line details in the error. There are no required column names.
- **Upload saved but offering count stays the same**: this is intentional. The source awaits future review/mapping and does not create offerings.
- **Upload too large / short preview**: configure the backend upload limits before restart. The preview limit affects display only; complete source bytes remain saved.
- **Deletion was accidental**: deletes have a confirmation prompt but no undo; restore your own database backup if available.

Documentation references: [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/), [Vite setup](https://vite.dev/guide/), and [Pydantic fields](https://docs.pydantic.dev/latest/concepts/fields/).
