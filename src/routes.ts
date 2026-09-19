import { Router } from 'express';
import { identityRoutes } from './contexts/identity';
import { libraryRoutes } from './contexts/library';

// Each bounded context owns its URL prefixes (identity: /auth; library: /books, /stats).
const routes = Router();

routes.use(identityRoutes);
routes.use(libraryRoutes);

export default routes;
