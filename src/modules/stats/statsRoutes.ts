import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { asyncHandler } from '../../shared/asyncHandler';
import { statsController } from './statsController';

const router = Router();

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Reading statistics for the authenticated user
 *     tags: [Stats]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Aggregated statistics }
 */
router.get('/', authMiddleware, asyncHandler(statsController.overview));

export default router;
