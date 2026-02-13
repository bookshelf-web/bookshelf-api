import { Router } from 'express';
import { statsController } from './statsController';
import { authMiddleware } from '../../middlewares/authMiddleware';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Stats
 *   description: API statistics
 */

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: Get API statistics
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authMiddleware, statsController.overview);

export default router;
