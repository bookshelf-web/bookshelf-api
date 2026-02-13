import { Router } from 'express';

import authRoutes from './modules/auth/authRoutes';
import booksRoutes from './modules/books/booksRoutes';
import statsRoutes from './modules/stats/statsRoutes';

const routes = Router();

routes.use('/auth', authRoutes);
routes.use('/books', booksRoutes);
routes.use('/stats', statsRoutes);

export default routes;
