/**
 * Roles a single account can hold. They are combinable, so one account can keep a
 * personal library and also buy or sell in the second-hand bookstore.
 */
export enum Role {
  /** Uses the personal library (books, reading status, stats). */
  READER = 'reader',
  /** Browses and buys in the second-hand bookstore. */
  BUYER = 'buyer',
  /** Lists items for sale, as a person or on behalf of a company. */
  SELLER = 'seller',
  /** Moderates the shared catalog and verifies companies. Never self-assigned. */
  ADMIN = 'admin',
}

/** Roles a user may choose for themselves at sign-up or later. */
export const SELF_SERVICE_ROLES = [Role.READER, Role.BUYER, Role.SELLER] as const;

/** Old tokens and accounts predate roles; they were library-only. */
export const DEFAULT_ROLES: Role[] = [Role.READER];

/**
 * Normalises a requested role set: removes duplicates and lets a seller also buy
 * (a seller can always browse and purchase, so it is never a separate opt-in).
 */
export function normalizeRoles(roles: Role[]): Role[] {
  const unique = new Set(roles);
  if (unique.has(Role.SELLER)) unique.add(Role.BUYER);
  return [...unique];
}
