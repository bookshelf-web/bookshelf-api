# Architecture

BookShelf is a **modular monolith**: one deployable API, one database, and a set of
**bounded contexts** with hard boundaries between them. This document records the
decisions behind that shape and the plan for the second-hand bookstore ("sebo").

## Decision: modular monolith, not separate services (yet)

| Concern | Choice | Why |
|---|---|---|
| Deployment | One API, one Render service | Free tier, one developer, one web client |
| Boundaries | Bounded contexts enforced by lint | Cheap now, and each context can be extracted later |
| Debuggability | `requestId` + structured logs + `context` on every error | Finding *where* a failure came from is an observability problem, not a process-count problem |
| BFF | Not needed | There is a single web client; a BFF pays off with a second client (mobile, admin panel) |
| Data consistency | One database, real transactions | An order, its stock and its payment must change together |

Splitting into services without distributed tracing makes failures harder to locate
("which of five services, in which call?"). The first extraction candidate is
**payments** (webhooks, different security and failure profile); it already sits
behind a gateway interface, so moving it out later is cheap.

## Bounded contexts

```
src/
  contexts/
    identity/     accounts, roles, companies, members, company verification
    library/      a reader's personal shelf: books, reading status, stats
    catalog/      shared books keyed by ISBN, with admin moderation and proposed edits
    audit/        append-only log of admin and moderation actions
    marketplace/  (planned) listings, cart, orders
    payments/     (planned) payment gateway port + simulated gateway
  shared/         cross-cutting kernel: errors, jwt, roles, logger, request context
  middlewares/    auth, role guard, validation, error handler
```

Rules, checked by ESLint (`import/no-restricted-paths`):

- A context may import another context **only through its `index.ts`** (its public API).
- Contexts do not import each other's models. Cross-context relations use entity
  names (`@ManyToOne('User', ...)`) and ids, never classes.
- `shared/` is the only thing every context may depend on.

## Observability

- Every request gets a `requestId` (`X-Request-Id`; an upstream id is reused only if it
  is short and printable). It appears in every log line and in every error body.
- Logs are JSON (pino) with `context`, `requestId`, status and latency; `Authorization`
  and passwords are redacted. Set `LOG_LEVEL` to change verbosity.
- Error bodies carry `context` (`identity`, `library`, ...) so a failure points at a
  module straight away: `{ "error": "...", "code": "ROLE_REQUIRED", "context": "library", "requestId": "..." }`.

## Accounts and roles

One account can hold several roles, so the same person can keep a library **and** buy
or sell in the sebo without a second sign-up.

| Role | Can |
|---|---|
| `reader` | Use the personal library (`/books`, `/stats`) |
| `buyer` | Browse and buy in the sebo |
| `seller` | List items, as a person or for a company (implies `buyer`) |
| `admin` | Moderate the catalog and verify companies. Never self-assigned |

Roles travel in the JWT (`roles` claim), so a change needs a new token; `PATCH /api/me/roles`
returns one. Admins come from the `ADMIN_EMAILS` allow-list, applied at register/login.
Tokens issued before roles existed are treated as `reader`.

## Companies

A company (CNPJ validated by check digits, unique) is registered by a `seller`, who becomes
its owner. Members are `owner` / `manager` / `staff`: owners and managers edit the company,
only owners manage members. Non-members get `404` so ids cannot be probed. An admin
**verifies** a company; the marketplace will require verification to publish listings.

## Catalog and moderation

The ISBN is the identity of a book, so a book exists **once** in the shared catalog, no matter
how many readers shelve it (and, later, how many sebos sell it).

- **Catalog book**: one row per ISBN-13 (ISBN-10 and hyphenated forms are validated and normalised).
  A book without an ISBN is matched by a normalised title/author/publisher/year/edition key, so
  the same book is not registered twice and different editions stay apart.
- **Library entries** point at the catalog book and keep only what is personal (status, rating,
  notes, dates). Title, author, ISBN and the rest are read from the catalog.
- **First registration** is **approved automatically** so the reader is never blocked, and is
  flagged `pending_review` for an admin, who confirms it or takes it down (`hidden`).
- **Edits** to descriptive fields never apply straight away: they become a **revision** that an
  admin approves or rejects. One exception keeps the flow natural: the creator can fix their own
  fresh registration directly until an admin has reviewed it and while nobody else shelves it.
  Personal fields (rating, notes, status) always apply at once.
- Every moderation action (confirm, hide, edit, approve, reject) is written to the audit log.
- Existing library books were moved into the catalog by a migration (merged by ISBN-13, marked as
  reviewed). Books with an invalid ISBN or none are kept as separate entries.
- Listings (price, condition, quantity, seller) belong to the marketplace, not the catalog.

## Planned: payments

Payments sit behind a `PaymentGateway` port. The default adapter is an in-process
**simulated gateway** (deterministic Pix and card outcomes, simulated webhooks), which
needs no credentials and runs in CI. A Mercado Pago sandbox adapter can be added later
without touching the marketplace.
