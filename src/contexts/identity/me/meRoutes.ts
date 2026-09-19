import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../shared/asyncHandler';
import { MeService } from './meService';
import { updateRolesSchema } from './meSchemas';

const router = Router();

router.use(authMiddleware);

const userId = (req: Request): string => req.userId as string;

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: The authenticated user, their roles and companies
 *     tags: [Me]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The profile }
 *       401: { description: Not authenticated }
 */
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await MeService.getProfile(userId(req)));
  }),
);

/**
 * @swagger
 * /api/me/roles:
 *   patch:
 *     summary: Add or remove the reader, buyer and seller roles; returns a fresh token
 *     tags: [Me]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Roles updated }
 *       400: { description: Invalid input, or the account would be left without a role }
 */
router.patch(
  '/roles',
  validate({ body: updateRolesSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await MeService.updateRoles(userId(req), req.body);
    res.json({ message: 'Roles updated', ...result });
  }),
);

export default router;
