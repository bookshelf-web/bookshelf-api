# BookShelf API

[![CI](https://github.com/bookshelf-web/bookshelf-api/actions/workflows/ci.yml/badge.svg)](https://github.com/bookshelf-web/bookshelf-api/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white)

REST API for managing a personal book library, built with Node.js, TypeScript,
Express, TypeORM and PostgreSQL.

- **Live API:** <https://bookshelf-api-wfzs.onrender.com> (Swagger UI at `/api-docs`)
- **Frontend:** [bookshelf-frontend](https://github.com/bookshelf-web/bookshelf-frontend),
  live at <https://bookshelf-web.github.io/bookshelf-frontend/>

> The demo runs on Render's free tier and sleeps when idle, so the first request
> after a period of inactivity can take up to a minute.

## Table of contents

- [Features](#features)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [API overview](#api-overview)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Frontend](#frontend)
- [Contributing](#contributing)
- [License](#license)

## Features

- JWT authentication (register / login)
- Book CRUD with per-user data isolation
- Filtering (status, rating, title, author, full-text search), sorting and pagination
- Reading status (`to_read` / `reading` / `read`) with automatic start/finish timestamps
- Reading statistics
- Request validation with Zod
- OpenAPI / Swagger documentation at `/api-docs`
- Automated API test suite (Jest + Supertest)

## Requirements

- Node.js 18+
- PostgreSQL 14+ (or Docker)

## Getting started

```bash
npm install
cp .env.example .env   # then edit the values
```

Start PostgreSQL (the compose file provisions a local instance):

```bash
docker compose up -d db
```

Run the API:

```bash
npm run dev      # watch mode
npm run build && npm start   # production build
```

## Environment variables

| Variable         | Required                    | Default       | Notes |
|------------------|-----------------------------|---------------|-------|
| `NODE_ENV`       | no                          | `development` | `development` \| `test` \| `production` |
| `PORT`           | no                          | `3000`        | |
| `JWT_SECRET`     | yes                         | –             | ≥ 32 chars recommended in production |
| `JWT_EXPIRES_IN` | no                          | `7d`          | |
| `DATABASE_URL`   | yes, unless `DB_*` are set  | –             | hosted providers (Supabase/Render); implies SSL |
| `DB_HOST`        | yes, unless `DATABASE_URL`  | –             | |
| `DB_PORT`        | no                          | `5432`        | |
| `DB_USER`        | yes, unless `DATABASE_URL`  | –             | |
| `DB_PASSWORD`    | yes, unless `DATABASE_URL`  | –             | |
| `DB_NAME`        | yes, unless `DATABASE_URL`  | –             | |
| `CORS_ORIGIN`    | no                          | localhost set | comma-separated list of allowed origins |

## Database migrations

The schema is versioned with TypeORM migrations in [`src/migrations`](src/migrations).
On startup the API applies any pending ones (except when `NODE_ENV=test`, where the
throwaway test database is built with `synchronize`). The baseline migration is
idempotent, so it is also safe on databases created earlier by `synchronize` or by
`scripts/init-db.sql`.

| Script                                    | Description                                  |
|-------------------------------------------|----------------------------------------------|
| `npm run migration:show`                  | List applied and pending migrations          |
| `npm run migration:run`                   | Apply pending migrations                     |
| `npm run migration:revert`                | Revert the last applied migration            |
| `npm run migration:generate -- src/migrations/Name` | Generate a migration from entity changes |

Changing an entity? Generate a migration and commit it together with the change.

### Hosting on Supabase

Supabase exposes every `public` table through its REST API with a public key. The API
talks to Postgres directly, so on startup it enables Row Level Security on its tables and
revokes access for the `anon`/`authenticated` roles (a no-op on plain Postgres). Nothing
to configure; only the `postgres` connection in `DATABASE_URL` can read the data.

The free tiers used by the demo go idle (Render spins the API down, Supabase pauses inactive
projects). [`keep-warm.yml`](.github/workflows/keep-warm.yml) pings the API, the database and the
frontend every 14 minutes on weekdays to keep them available.

## Scripts

| Script              | Description                        |
|---------------------|------------------------------------|
| `npm run dev`       | Start with hot reload              |
| `npm run build`     | Compile TypeScript to `dist/`      |
| `npm start`         | Run the compiled build             |
| `npm test`          | Run the test suite with coverage   |
| `npm run typecheck` | Type-check without emitting        |
| `npm run lint`      | Lint `src` and `tests`             |
| `npm run format`    | Format with Prettier               |

## API overview

Base path: `/api`. All book and stats endpoints require
`Authorization: Bearer <token>`.

| Method | Endpoint                 | Description              |
|--------|--------------------------|-------------------------|
| POST   | `/auth/register`         | Create an account       |
| POST   | `/auth/login`            | Authenticate            |
| GET    | `/books`                 | List books (filters, pagination) |
| POST   | `/books`                 | Create a book           |
| GET    | `/books/:id`             | Get a book              |
| PUT    | `/books/:id`             | Update a book           |
| PATCH  | `/books/:id/status`      | Update reading status   |
| DELETE | `/books/:id`             | Delete a book           |
| GET    | `/stats`                 | Reading statistics      |

Errors are returned as `{ "error": string, "code": string, "details"?: unknown }`.

## Testing

The suite runs against a real PostgreSQL database:

```bash
docker compose up -d db
npm test
```

### End-to-end tests

Full-stack suites (API + UI) live in separate repositories:

| Suite | Repository | Report |
|-------|------------|--------|
| Playwright (TypeScript) | [bookshelf-playwright-tests](https://github.com/thiago8rocha/bookshelf-playwright-tests) | [Allure](https://thiago8rocha.github.io/bookshelf-playwright-tests/allure-report/) |
| Robot Framework | [bookshelf-robotframework-tests](https://github.com/thiago8rocha/bookshelf-robotframework-tests) | [Allure](https://thiago8rocha.github.io/bookshelf-robotframework-tests/allure-report/) |

To run them without leaving this repository, use the
[Run E2E Tests](.github/workflows/run-e2e-tests.yml) workflow: *Actions → Run E2E
Tests → Run workflow*, choose `playwright`, `robot` or `both` (and a Robot suite
such as `smoke`), and follow the links in the run summary.

It needs a repository secret named `E2E_DISPATCH_TOKEN`: a fine-grained personal
access token with **Actions: read and write** on the two test repositories.

## Project structure

```
src/
  config/       env, database and swagger setup
  middlewares/  auth, request validation, error handling
  models/       TypeORM entities (User, Book)
  modules/      feature modules (auth, books, stats): controller + service + routes + schemas
  shared/       cross-cutting helpers (errors, asyncHandler, jwt)
  app.ts        Express app wiring
  server.ts     entry point
tests/          API tests (Jest + Supertest)
```

## Frontend

The web client lives in a separate repository:
[bookshelf-web/bookshelf-frontend](https://github.com/bookshelf-web/bookshelf-frontend).
To run both locally, start this API (port `3000`) and then the frontend's dev
server, which proxies `/api` to it and serves the app at
<http://localhost:5173>. When hosting the frontend elsewhere,
add its origin to `CORS_ORIGIN`.

## Contributing

Contributions are welcome. Fork the repository, create a branch, and open a pull
request. Run `npm run lint`, `npm run typecheck` and `npm test` before submitting.
Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).
Notable changes are tracked in [CHANGELOG.md](CHANGELOG.md); to report a security
issue, see [SECURITY.md](SECURITY.md).

Repository maintainers can import [`.github/rulesets/protect-main.json`](.github/rulesets/protect-main.json)
(*Settings → Rules → Rulesets → Import*) to block force pushes to, and deletion of, `main`.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

## Author

**Thiago Rocha** — [@thiago8rocha](https://github.com/thiago8rocha)
