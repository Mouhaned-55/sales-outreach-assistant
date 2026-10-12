# Local Sales Dashboard Implementation Plan

**Goal:** A local, single-user React dashboard with real seller, offering, and prospect persistence.

**Architecture:** Preserve domain dataclasses and CLI under backend. Application ports and use cases own workflows; SQLite and standard-library CSV adapters implement ports. FastAPI validates HTTP input. React uses a Vite /api proxy.

**Tech Stack:** Python 3.12, FastAPI, Pydantic, sqlite3, csv, unittest, React, TypeScript, Vite, plain CSS.

**Spec:** User's attached request; no AI calls, sending, deployment, authentication, or Git commits. Preserve root .venv and existing data/seller_profile.json.

## Shared API contract

All routes start /api. Errors: {error: {message: string, details: string[]}}.
- GET/PUT /seller: {business_name, description, offerings: [{id, name, description}]}; PUT accepts only business_name and description. Unsaved profile returns empty strings.
- GET/POST /offerings; PUT/DELETE /offerings/{id}. Offering input {name, description}, response adds integer id. GET returns array. DELETE returns 204.
- POST /offerings/import/preview accepts {content: string} (raw CSV decoded by browser), returns {offerings: [{name, description}], count: number}. No writes.
- POST /offerings/import/confirm accepts same {content}, reparses and appends atomically, returns {imported: number}. Confirmation uses the exact previewed source. Max 1 MB UTF-8 and 1000 rows; required name,description headers; BOM, blank rows, quoted commas supported; useful row errors. Duplicates append intentionally.
- GET /offerings/example.csv serves example CSV.
- GET/POST /prospects; PUT/DELETE /prospects/{id}. Fields: business_name, contact_name (default empty), email, description, needs (default empty). Response adds integer id. GET array, DELETE 204.
- GET /dashboard: {seller_complete: boolean, offering_count: number, prospect_count: number}.
- GET /health: {status: "ok"}.

## Task 1: Backend foundation

- [x] Move existing app/tests/config into backend without modifying old virtual environment.
- [x] Write failing unittest tests for CSV edge cases, atomicity, persistence across new repository/app instances, API CRUD/validation/errors/dashboard and preserved CLI.
- [x] Implement domain records, ports, use cases, SQLite repository, CSV parser, Pydantic schemas/routes and composition factory app.main:create_app. Keep main() CLI and lazy API imports.
- [x] Run backend suite and CLI. Include example CSV and configuration with stable default backend/data/outreach.sqlite3 path; no dotenv dependency needed.

## Task 2: Frontend dashboard

- [x] Build responsive shell with Overview, Business Profile, Offerings, Prospects, Outreach; English UI; restrained ink/teal/cream styling.
- [x] Connect all forms, counts and checklist to API. Add edit/delete confirmations and import preview/append flow, loading/success/error/empty states.
- [x] Keep future AI/email/Excel clearly unavailable. Make fields labeled and keyboard focus visible.
- [x] Run TypeScript and production build; inspect browser if available.

## Task 3: Review and handoff

- [x] Review actual API contract and UI integration; exercise API with isolated temporary storage.
- [x] Document install/start/CLI/check commands, architecture, ports/proxy, persistence/config, feature status and troubleshooting in English README.
- [x] Report checks and limits in Tunisian Arabic, with exact startup commands.

## Review focus

Invalid CSV must never partially write; preview must not persist; form state must not report success on failure; counters must refresh after mutations; saved data must survive restart. No secrets or simulated outreach in UI.

## Verification record

- Backend: 28 unittest tests passed, including API CRUD, restart persistence, CSV atomicity and error handling.
- Preserved CLI verified using both backend and original root interpreters.
- Frontend: TypeScript check and production build passed.
- Live HTTP: Vite page/proxy and seller, offering, prospect, CSV and dashboard endpoints passed with temporary SQLite storage.
- Independent review addressed shared pending-operation navigation, secondary-text contrast, and accessible checklist status.
- Browser tools were unavailable; visual rendering, keyboard interaction and mobile behavior remain unverified in a browser.
- Root .venv and data/seller_profile.json preserved. No commits, email sends, paid AI calls or deployment.
