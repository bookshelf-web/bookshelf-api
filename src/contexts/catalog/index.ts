// Public surface of the catalog context. Other contexts may import only from here.
export { catalogRoutes, adminCatalogRoutes } from './routes';
export { CatalogService, dedupeKeyFor, normalizeText, EDITABLE_FIELDS } from './catalogService';
export type { CatalogFields, CatalogChanges, EditOutcome } from './catalogService';
export { normalizeIsbn, isValidIsbn10, isValidIsbn13 } from './isbn';
export { CatalogBook, CatalogBookStatus, CatalogReviewStatus } from './models/CatalogBook';
export { CatalogRevision, RevisionStatus } from './models/CatalogRevision';
