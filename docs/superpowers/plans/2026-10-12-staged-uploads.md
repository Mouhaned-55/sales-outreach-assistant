# Staged catalog uploads implementation plan

Goal: replace CSV-to-offerings imports with independent, persistent uploads awaiting future review. Preserve manual CRUD and all existing data. No AI, Excel/PDF, email, commits, or deployment.

Architecture: application coordinates parser/storage ports; infrastructure parses UTF-8 CSV and persists original source bytes plus metadata in a separate SQLite table keyed by generated UUID. Domain remains framework/format independent. React renders positional cells as plain text. No new dependencies needed.

## Contract

All endpoints /api. Errors retain {error:{message,details}}.
- GET /uploads/settings -> {max_file_bytes:number, preview_row_limit:number}.
- POST /uploads/preview input {filename:string, content_base64:string, delimiter:"auto"|","|";"|"\t", has_headers:boolean} -> preview below; no writes.
- POST /uploads same input -> detail below with HTTP201. Reparse validated full source before atomic storage. Does NOT create offerings.
- GET /uploads -> metadata array, newest first.
- GET /uploads/{id} -> detail, reopening persisted parsing settings.
- DELETE /uploads/{id} ->204 deletes source and metadata together. Missing->404.
- Remove /offerings/import/preview and /offerings/import/confirm; no accidental direct imports.
- Retain /offerings/example.csv and adapt fictional sample to arbitrary columns.

Metadata: {id:string, filename:string, uploaded_at:UTC ISO string, status:"Awaiting review", delimiter:","|";"|"\t", requested_delimiter:"auto"|","|";"|"\t", has_headers:boolean, size_bytes:number, row_count:number, column_count:number}.
Preview: {headers:string[]|null, rows:string[][], row_count:number, column_count:number, delimiter:","|";"|"\t", requested_delimiter:"auto"|","|";"|"\t", has_headers:boolean, truncated:boolean, warnings:string[]}.
Detail: metadata fields plus {preview:Preview}.

Preserve raw bytes (BOM included) in SQLite BLOB under generated ID, not filename paths. Base64 transports bytes without browser decoding/re-encoding loss; server strictly validates UTF-8(-sig) and base64. Keep exact whitespace, original labels and cells, duplicate/blank headers, empty records and ragged rows positionally (warnings for raggedness rather than losing cells). Table display can use supplemental positional column numbers without mutating original labels. Full file validation despite limited preview. Reject empty/all-whitespace source, invalid encoding, NUL/binary controls or malformed quoting with actionable feedback. Automatic delimiter detection limited to comma/semicolon/tab; explicit override always available including after failure. Ambiguous auto detection produces clear warning. No automatic header detection: explicit checkbox defaults true.

Configuration: OUTREACH_UPLOAD_MAX_BYTES default1048576; OUTREACH_UPLOAD_PREVIEW_ROWS default50, validated positive sensible caps. Persist complete source even when preview truncated; no old1000 data-row truncation. Limits available to UI. Source parsing settings stored, future configuration changes must not make valid older uploads inaccessible (preview can follow current preview limit, don't reject stored sources due to lowered upload max). Database schema changes additive only.

## Tasks
- [x] Backend: write failing tests first; implement parser/staging ports/use cases/storage/API/config; adapt old import tests to new requirements, keep all unrelated tests and run whole suite.
- [x] Frontend: replace CsvImport with CatalogUploads, preview settings+source; stage confirmation, list/reopen/delete with confirmations, metadata/status; update all old CSV-to-offering copy, preserve busy protection/manual CRUD. Typecheck/build.
- [x] Documentation and review: update README English; independent review; live HTTP tests isolated from saved data; verify unchanged offering counts; report checks/limits in Tunisian Arabic.

Tests: arbitrary/duplicate/blank headers, headerless rows, all3 delimiters and overrides, quoted delimiters/newlines, BOM exact original-byte storage, empty/malformed/unsupported encoding, ragged/blank rows preserved, whitespace preserved, source limits, preview truncation while validating entire file, save/reopen/restart/list/delete, UUID storage despite path-like filename, untouched offerings across staging/deletion, old direct endpoints unavailable; existing seller/prospect/CLI tests.

## Verification results

- Backend: all 40 unittest tests passed with warnings as errors; original CLI output preserved.
- Frontend: 5 byte-transport tests, TypeScript check, and production build passed.
- Static preview verification passed positional labels, escaped content, immutable values, and 25-column pagination controls.
- Live temporary-database HTTP checks passed staging, preview, listing, reopen, process restart, delete, invalid inputs, and unchanged manual offerings/counts.
- Independent review found no important unresolved issues; 150 generated parser round trips passed.
- Existing dashboard responds HTTP200 and its upload-settings endpoint returns current defaults. No user-data test writes, new dependencies, AI calls, email sends, or commits.
- Browser layout and interactive accessibility were not exercised by a browser tool.
