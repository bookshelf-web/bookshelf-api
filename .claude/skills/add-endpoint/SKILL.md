---
name: add-endpoint
description: >-
  Use when adding a new endpoint, resource, or feature module to the BookShelf
  API. Walks through the schema -> service -> controller -> route -> test -> docs
  pattern the codebase follows so new code matches the existing structure.
---

# Adding an endpoint to the BookShelf API

Follow the same layering every existing module uses. Read one existing module
first (`src/modules/books/` is the most complete) and mirror it.

## 1. Decide where it lives

- New operation on an existing resource -> add to that module
  (`src/modules/<feature>/`).
- New resource -> create `src/modules/<feature>/` with the four files below and
  register it in `src/routes.ts` (`routes.use('/<feature>', <feature>Routes)`).
- New persisted resource -> also add a TypeORM entity in `src/models/` and list
  it in `entities` in `src/config/database.ts`.

## 2. Schema — `<feature>Schemas.ts`

- One Zod object per request body / params / query.
- Only validate **shape** here (required, types, ranges, enum membership,
  format). Business rules (uniqueness, ownership, "not in the future") stay in
  the service.
- Export the inferred type: `export type CreateXInput = z.infer<typeof createXSchema>;`
- For optional free-text fields use the `optionalText` / `clearableText` helpers
  pattern already in `booksSchemas.ts` (trim, collapse empty to `undefined`;
  keep `null` on update so a field can be cleared).
- Any user-supplied column name (sort, filter-by) must be a `z.enum([...])`
  backed by an exported allow-list constant.

## 3. Service — `<feature>Service.ts`

- `export class XService` with `private static get repository() { return AppDataSource.getRepository(X); }`.
- Static async methods. Signature convention: `(userId: string, ...)` first so
  every query is scoped to the owner.
- Throw `AppError` subclasses from `src/shared/errors.ts` with a
  `SCREAMING_SNAKE_CASE` code:
  - not found / not owned -> `new NotFoundError('X not found', 'X_NOT_FOUND')`
  - duplicate -> `new ConflictError('...', 'X_ALREADY_EXISTS')`
  - bad business state -> `new BadRequestError('...', 'CODE')`
- Return domain data only (an entity, or `{ items, pagination }`). No `res`, no
  status codes, no `message`.

## 4. Controller — `<feature>Controller.ts`

- A plain exported object of async methods: `export const xController = { async create(req, res) { ... } }`.
- Read the user: `const uid = req.userId as string;` (populated by `authMiddleware`).
- Call the service, then shape the HTTP response:
  - create -> `res.status(201).json({ message: 'X created successfully', x })`
  - update / status change -> `res.json({ message: 'X updated successfully', x })`
  - read one -> `res.json({ x })`
  - list -> `res.json({ xs, pagination })`
  - delete -> `res.json({ message: 'X deleted successfully' })`
- If a query object needs parsing, do `const q = listXQuerySchema.parse(req.query)`
  here (ZodError is handled centrally).

## 5. Route — `<feature>Routes.ts`

```ts
router.use(authMiddleware); // if every route in the module is protected
router.post(
  '/',
  validate({ body: createXSchema }),
  asyncHandler(xController.create),
);
```

- Always `asyncHandler(...)` around the controller method.
- `validate({ params: xIdParamsSchema })` on any `/:id` route.
- Add a `@swagger` JSDoc block above each route (copy the shape from
  `booksRoutes.ts`).

## 6. Tests — `tests/api/<feature>/<operation>.test.ts`

- Supertest against `src/app`, real Postgres. Copy the structure of an existing
  file (`beforeAll(setupTestDatabase)`, `beforeEach(cleanupTestDatabase)`,
  `afterAll(closeTestDatabase)`).
- Use the helpers: `ApiClient`, `AuthHelper`, `TestDataBuilder`.
- For any test that needs two users, give **each user its own `new ApiClient()`
  and `new AuthHelper(client)`** — `AuthHelper` mutates the token on the client
  it wraps, so a shared client leaks the last token.
- Cover: success, validation (400), auth (401), not-found / cross-user (404),
  conflicts (409).
- Assert English messages; validation errors put every failing rule joined in
  `body.error`.

## 7. Verify

```
npm run typecheck && npm run lint
```

Then run the tests (see the `db-and-tests` skill). Update `CHANGELOG.md`'s
`[Unreleased]` section.
