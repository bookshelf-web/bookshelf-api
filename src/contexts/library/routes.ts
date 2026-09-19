import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { requireRole } from '../../middlewares/requireRole';
import { Role } from '../../shared/roles';
import { withContext } from '../../shared/requestContext';
import booksRoutes from './books/booksRoutes';
import statsRoutes from './stats/statsRoutes';

const router = Router();

// Everything here is the personal library: it needs an account with the reader role.
const libraryAccess = [withContext('library'), authMiddleware, requireRole(Role.READER)];

router.use('/books', ...libraryAccess, booksRoutes);
router.use('/stats', ...libraryAccess, statsRoutes);

export default router;
