---
name: db-and-tests
description: >-
  Use when running or debugging the BookShelf API test suite, or when a local
  PostgreSQL is needed for `npm run dev`. Covers starting the database, the
  env vars the suite needs, and the known test-isolation pitfalls.
---

# Database & tests

The API tests are **integration tests** (Supertest against `src/app`) that need a
real PostgreSQL. There is currently **no local Postgres or Docker** on the
development machine, so day to day the suite runs in CI. Use these steps when a
database is available.

## Start PostgreSQL

```
docker compose up -d db
```

This uses `docker-compose.yml` (Postgres 15, db `bookshelf`, user `admin` /
`admin123`) and runs `scripts/init-db.sql`. Wait for the healthcheck:

```
docker compose ps
```

## Env vars

The test run needs (jest sets `NODE_ENV=test`, which turns on TypeORM
`synchronize` so the schema is created automatically):

```
JWT_SECRET=<anything, >=32 chars in production only>
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=admin123
DB_NAME=bookshelf
```

A local `.env` already has working values.

## Run

```
npm test                 # full suite + coverage
npm test -- <path>        # one file
npm test -- --runInBand   # serial; use this if the DB is contended / flaky
```

CI always runs with `--runInBand`.

## Without a database

You can still get strong signal without Postgres:

```
npm run typecheck
npm run lint
```

and a route-level smoke test that never opens a DB connection:

```
JWT_SECRET=test-secret-1234567890-1234567890-abc NODE_ENV=test \
  node -e "const r=require('supertest');const a=require('./dist/app').default; \
  r(a).get('/health').then(x=>console.log(x.status,x.body))"
```

(`npm run build` first.) This exercises helmet, CORS, validation, the 404
handler, and the error handler — everything except the actual queries.

## Known pitfalls

- **Shared `ApiClient` between users.** `AuthHelper` calls `setToken` on the
  client it wraps, so if two "users" share one client the second login
  overwrites the first token and assertions read the wrong user's data. Any
  multi-user test must build a separate `new ApiClient()` +
  `new AuthHelper(client)` per user. (This bit the two user-isolation tests.)
- **Parallel workers + `TRUNCATE`.** The cleanup helper truncates `books` and
  `users`; with parallel jest workers on one database this is racy. `--runInBand`
  avoids it.
- `cleanupTestDatabase` only truncates if `AppDataSource.isInitialized`, so the
  first `setupTestDatabase` must run in `beforeAll`.
