import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware';
import { requireRole } from '../../../middlewares/requireRole';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../shared/asyncHandler';
import { Role } from '../../../shared/roles';
import { UsersService } from './usersService';
import { adminUpdateUserSchema, listUsersQuerySchema, userIdParamsSchema } from './usersSchemas';

const router = Router();

router.use(authMiddleware, requireRole(Role.ADMIN));

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List and search accounts (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: role, schema: { type: string, enum: [reader, buyer, seller, admin] } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, suspended] } }
 *     responses:
 *       200: { description: A page of accounts }
 *       403: { description: Admin role required }
 */
router.get(
  '/',
  validate({ query: listUsersQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await UsersService.list(listUsersQuerySchema.parse(req.query)));
  }),
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     summary: Get an account (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The account }
 *       404: { description: User not found }
 */
router.get(
  '/:id',
  validate({ params: userIdParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: await UsersService.getById(req.params.id) });
  }),
);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   patch:
 *     summary: Edit name, email, roles or status of an account (admin only)
 *     description: >
 *       Any role can be set, including admin. Nobody can suspend themselves, and the
 *       last active admin cannot lose the role or be suspended. Every change is audited.
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Account updated }
 *       403: { description: Not allowed (self-suspension, last admin) }
 *       404: { description: User not found }
 *       409: { description: Email already registered }
 */
router.patch(
  '/:id',
  validate({ params: userIdParamsSchema, body: adminUpdateUserSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await UsersService.update(req.userId as string, req.params.id, req.body);
    res.json({ message: 'User updated successfully', user });
  }),
);

export default router;
