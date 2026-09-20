# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Accounts with roles** (`reader`, `buyer`, `seller`, `admin`): register with an optional
  `roles` list, `GET /api/me`, `PATCH /api/me/roles`. The library (`/books`, `/stats`) now
  needs the `reader` role; existing accounts default to it. Admins come from `ADMIN_EMAILS`.
- **User administration** (`/api/admin/users`): search, edit name/email/roles and suspend or reactivate
  accounts, with guards (no self-suspension, the last active admin is protected) and an **audit log**
  (`/api/admin/audit-logs`) that also records company verification. Users can change their own name and
  password (`/api/me/profile`, `/api/me/password`). Suspended accounts cannot sign in.
- **Shared catalog** (`/api/catalog`, `/api/admin/catalog`): a book exists once (ISBN-13; books without
  ISBN are matched by metadata). Library entries reference it and keep only personal data. The first
  registration is approved at once and flagged for admin review; other edits become revisions an admin
  approves or rejects. **Breaking:** ISBNs are validated (check digit) and normalised to ISBN-13, the same
  ISBN by two readers now shares one catalog book instead of conflicting, and `PUT /api/books/:id` may
  answer with `pendingRevision` instead of applying descriptive changes. Existing books were migrated.
- **Companies**: `POST/GET/PUT /api/companies`, member management, and admin verification
  (`/api/admin/companies`). CNPJ is validated and unique.
- **Bounded contexts** (`identity`, `library`) with ESLint-enforced boundaries, structured
  JSON logs (pino), an `X-Request-Id` on every response, and `context`/`requestId` in error
  bodies. See `docs/architecture.md`.
- Unit test suite (`npm run test:unit`) with mocked persistence and coverage thresholds.
- TypeORM migrations (`src/migrations`) with `migration:*` scripts. Pending
  migrations run on startup, replacing the `DB_SYNC` flag (removed). The baseline
  is idempotent for existing databases.
- Indexes on `books` (`user_id`, `status`, `title`, `author`).
- `keep-warm` workflow that pings the hosted API, database and frontend on weekdays.
- `.github/rulesets/protect-main.json` to import as a branch ruleset.

### Fixed

- `PUT /api/books/:id` now clears optional fields (rating, notes, ...) when they are sent as
  `null`; previously the update was silently ignored.

### Security

- On startup the API enables Row Level Security on its tables and revokes the
  Supabase `anon`/`authenticated` roles, so the data is not readable through
  Supabase's public REST API. No-op on plain PostgreSQL.

### Changed

- **BREAKING (API responses):** error bodies now include a machine-readable
  `code` (e.g. `BOOK_NOT_FOUND`, `ISBN_ALREADY_REGISTERED`, `VALIDATION_ERROR`)
  and validation errors return every failing rule joined in `error` plus a
  `details` array.
- **BREAKING (language):** all API messages are now in English.
- Request validation moved to [Zod](https://zod.dev) schemas applied by a
  `validate` middleware; controllers no longer hand-roll field checks.
- Centralised error handling: services throw typed `AppError`s that a single
  Express error handler converts to HTTP responses (`asyncHandler` removes the
  per-controller `try/catch`).
- Environment variables are parsed and validated once at startup into a typed
  `env` object.
- `list` now rejects `sortBy` values outside an allow-list (previously the raw
  value was interpolated into the query).
- Unknown routes return a JSON `404` (`ROUTE_NOT_FOUND`) instead of Express' HTML.

### Added

- ESLint + Prettier configuration and `lint` / `format` / `typecheck` scripts.
- `zod` dependency.

### Removed

- Dead code: the unused `where`/`order` builders in `BooksService.list`, the
  previously-unregistered error handler, `getJWTSecret`/`validateEnv` helpers.

## [0.1.0] - 2026-08-31

First tagged version (pre-1.0; improvements ongoing): JWT auth, book CRUD with
filtering/pagination, reading status with automatic timestamps, per-user data
isolation, reading statistics, Swagger docs, Docker/Render deployment.

[Unreleased]: https://github.com/bookshelf-web/bookshelf-api/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bookshelf-web/bookshelf-api/releases/tag/v0.1.0
