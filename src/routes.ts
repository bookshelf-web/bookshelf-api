import { Router } from 'express';
import { identityRoutes } from './contexts/identity';
import { libraryRoutes } from './contexts/library';
import { auditRoutes } from './contexts/audit';
import { adminCatalogRoutes, catalogRoutes } from './contexts/catalog';

// Each bounded context owns its URL prefixes (identity: /auth; library: /books, /stats).
const routes = Router();

routes.use(identityRoutes);
routes.use(libraryRoutes);
routes.use('/admin/audit-logs', auditRoutes);
routes.use('/catalog', catalogRoutes);
routes.use('/admin/catalog', adminCatalogRoutes);

export default routes;
