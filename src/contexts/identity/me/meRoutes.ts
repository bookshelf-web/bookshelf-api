import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../shared/asyncHandler';
import { MeService } from './meService';
import { changePasswordSchema, updateProfileSchema, updateRolesSchema } from './meSchemas';

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
 * /api/me/profile:
 *   patch:
 *     summary: Change the display name
 *     tags: [Me]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Profile updated; returns a fresh token }
 */
router.patch(
  '/profile',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await MeService.updateProfile(userId(req), req.body);
    res.json({ message: 'Profile updated', ...result });
  }),
);

/**
 * @swagger
 * /api/me/password:
 *   patch:
 *     summary: Change the password (needs the current one)
 *     tags: [Me]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Password changed }
 *       401: { description: Current password is incorrect }
 */
router.patch(
  '/password',
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await MeService.changePassword(userId(req), req.body);
    res.json({ message: 'Password changed' });
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
