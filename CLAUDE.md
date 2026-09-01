# CLAUDE.md — BookShelf API

> **Respond to the user in Brazilian Portuguese (pt-BR).**
> All code, comments, identifiers, commit messages, API messages, and docs stay in
> **English** — only the chat replies are in pt-BR.

## What this is

REST API for a personal book library. Node.js + TypeScript + Express + TypeORM +
PostgreSQL. JWT auth, per-user data isolation, book CRUD with filtering/pagination,
reading status with automatic timestamps, reading statistics, Swagger docs.
Deployed on Render; the frontend lives in a separate repo (`bookshelf-frontend`,
GitHub Pages).

The project is intentionally **pre-1.0**.

## Layout

```
src/
  config/       env.ts (Zod-validated config), database.ts, swagger.ts
  middlewares/  authMiddleware, errorHandler (+ notFoundHandler), validate
  shared/       errors.ts (AppError hierarchy), asyncHandler.ts, jwt.ts
  models/       TypeORM entities: User, Book
  modules/<feature>/
                <feature>Controller.ts  - plain object of async handlers
                <feature>Service.ts     - static class, business logic
                <feature>Routes.ts      - router + validate + asyncHandler + swagger
                <feature>Schemas.ts     - Zod schemas + inferred input types
  types/        books.ts (BookStatus enum), express/index.d.ts (req.userId)
  routes.ts     mounts the feature routers under /api
  app.ts        Express wiring (helmet, cors, json, routes, swagger, 404, errors)
  server.ts     entry point
tests/          Jest + Supertest API tests against a real PostgreSQL
```

## Conventions (follow these when changing code)

- **Errors:** services throw `AppError` subclasses (`NotFoundError`,
  `ConflictError`, `UnauthorizedError`, `BadRequestError`, `ValidationError`) from
  `src/shared/errors.ts`. The central `errorHandler` turns them into
  `{ error, code, details? }` with `code` in `SCREAMING_SNAKE_CASE`. Never build
  error responses by hand in a controller.
- **Async route handlers:** always wrap with `asyncHandler(...)` in the route file
  so rejections reach the error handler.
- **Validation:** request shape is validated by Zod schemas via the `validate`
  middleware (`validate({ body, params })`). Services assume the input is already
  the right shape and only enforce **business rules** (uniqueness, "not in the
  future", ownership). Export input types as `z.infer<typeof schema>`.
- **Config:** read configuration only from the `env` object in `src/config/env.ts`.
  Do not sprinkle `process.env.*` elsewhere.
- **Services:** `export class XService` with `private static get repository()` and
  static async methods. They return domain data (an entity or `{ items, pagination }`),
  never HTTP concerns.
- **Controllers:** a plain object of async methods. Read the user id as
  `req.userId as string`. Shape the response: `{ message, <resource> }` for
  mutations, `{ <resource> }` / `{ <resource>s, pagination }` for reads.
- **Comments:** only when they explain *why* (a workaround, a non-obvious
  constraint). Delete comments that restate the code.
- **`sortBy` / dynamic column names:** must go through an allow-list
  (`SORTABLE_COLUMNS`) before touching a query.
- **Swagger:** every route gets a `@swagger` JSDoc block above it.

## Commands

| Command | Notes |
|---|---|
| `npm run dev` | watch mode |
| `npm run build` / `npm start` | compile to `dist/` then run |
| `npm test` | Jest + coverage — **needs PostgreSQL** (`docker compose up -d db`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` / `npm run lint:fix` | ESLint over `src` + `tests` |
| `npm run format` | Prettier |

CI (`.github/workflows/ci.yml`) runs lint + typecheck + tests (Postgres service,
`--runInBand`) on every push and PR. Keep it green.

## Git & releases

- **Conventional Commits**, in English, following the existing `type(scope): ...`
  style. **Never** add `Co-Authored-By`, `Claude-Session`, or any AI-attribution
  trailer to commits or PRs.
- Do not commit or push unless the user asks.
- `main` **auto-deploys to Render**. A breaking API change also affects the
  deployed frontend — flag it.
- Versioning: SemVer + [Keep a Changelog](https://keepachangelog.com). Keep
  `CHANGELOG.md`'s `[Unreleased]` section current; releases are cut from `v*` tags
  and published as GitHub Releases. See the `cut-release` skill.

## Gotchas

- No local PostgreSQL / Docker on the current machine — tests only run in CI.
  See the `db-and-tests` skill.
- The `gh` CLI here is authenticated as a **read-only** account; it cannot open
  PRs, merge, or create Releases on `bookshelf-web/bookshelf-api`. Pushes work
  over SSH.
- `main` currently has no branch protection (ruleset setup is pending).
