import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { requireRole } from '../../middlewares/requireRole';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { Role } from '../../shared/roles';
import { withContext } from '../../shared/requestContext';
import { AuditService } from './auditService';

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  targetType: z.string().trim().min(1).optional(),
  targetId: z.string().trim().min(1).optional(),
  actorId: z.string().uuid().optional(),
});

const router = Router();

router.use(withContext('audit'), authMiddleware, requireRole(Role.ADMIN));

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     summary: Who changed what (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: targetType, schema: { type: string } }
 *       - { in: query, name: targetId, schema: { type: string } }
 *       - { in: query, name: actorId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: A page of audit entries, newest first }
 *       403: { description: Admin role required }
 */
router.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await AuditService.list(querySchema.parse(req.query)));
  }),
);

export default router;
