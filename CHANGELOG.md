# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
