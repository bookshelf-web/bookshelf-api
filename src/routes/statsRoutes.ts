import { Router } from 'express';
import { StatsController } from '../controllers/statsController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const statsController = new StatsController();

router.use(authMiddleware);

/**
 * @swagger
 * /api/stats:
 *   get:
 *     summary: Obter estatísticas de leitura
 *     tags: [Stats]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         toRead:
 *                           type: integer
 *                         reading:
 *                           type: integer
 *                         read:
 *                           type: integer
 *                     averageRating:
 *                       type: number
 *                     totalPages:
 *                       type: integer
 *                     booksWithRating:
 *                       type: integer
 */
router.get('/', (req, res) => statsController.getStats(req, res));

export default router;