# BookShelf API

REST API for managing a personal book library, built with Node.js, TypeScript,
Express, TypeORM and PostgreSQL.

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

## Setup

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
| `DB_SYNC`        | no                          | `false`       | run `synchronize` on the hosted DB |
| `CORS_ORIGIN`    | no                          | localhost set | comma-separated list of allowed origins |

The schema is created automatically via TypeORM `synchronize` when `NODE_ENV=test`
or `DB_SYNC=true`; `scripts/init-db.sql` seeds it for the local Docker database.

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
