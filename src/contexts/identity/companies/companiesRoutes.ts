import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/authMiddleware';
import { requireRole } from '../../../middlewares/requireRole';
import { validate } from '../../../middlewares/validate';
import { asyncHandler } from '../../../shared/asyncHandler';
import { Role } from '../../../shared/roles';
import { adminCompaniesController, companiesController } from './companiesController';
import {
  addMemberSchema,
  companyIdParamsSchema,
  createCompanySchema,
  memberParamsSchema,
  updateCompanySchema,
  verificationSchema,
} from './companiesSchemas';

export const companiesRoutes = Router();
export const adminCompaniesRoutes = Router();

companiesRoutes.use(authMiddleware);

/**
 * @swagger
 * /api/companies:
 *   post:
 *     summary: Register a company (seller role required); the caller becomes its owner
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201: { description: Company registered }
 *       400: { description: Invalid input (e.g. invalid CNPJ) }
 *       403: { description: Seller role required }
 *       409: { description: CNPJ already registered }
 */
companiesRoutes.post(
  '/',
  requireRole(Role.SELLER),
  validate({ body: createCompanySchema }),
  asyncHandler(companiesController.create),
);

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: List the companies the user belongs to
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: The user's companies }
 */
companiesRoutes.get('/', asyncHandler(companiesController.listMine));

/**
 * @swagger
 * /api/companies/{id}:
 *   get:
 *     summary: Get a company the user belongs to
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The company }
 *       404: { description: Not found, or the user is not a member }
 */
companiesRoutes.get(
  '/:id',
  validate({ params: companyIdParamsSchema }),
  asyncHandler(companiesController.getById),
);

/**
 * @swagger
 * /api/companies/{id}:
 *   put:
 *     summary: Update a company (owner or manager). The CNPJ cannot be changed.
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Company updated }
 *       403: { description: Only owners and managers can update }
 *       404: { description: Not found }
 */
companiesRoutes.put(
  '/:id',
  validate({ params: companyIdParamsSchema, body: updateCompanySchema }),
  asyncHandler(companiesController.update),
);

/**
 * @swagger
 * /api/companies/{id}/members:
 *   get:
 *     summary: List a company's members
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The members }
 */
companiesRoutes.get(
  '/:id/members',
  validate({ params: companyIdParamsSchema }),
  asyncHandler(companiesController.listMembers),
);

/**
 * @swagger
 * /api/companies/{id}/members:
 *   post:
 *     summary: Add an existing user to the company by email (owner only)
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       201: { description: Member added }
 *       403: { description: Only the owner can add members }
 *       404: { description: Company or user not found }
 *       409: { description: Already a member }
 */
companiesRoutes.post(
  '/:id/members',
  validate({ params: companyIdParamsSchema, body: addMemberSchema }),
  asyncHandler(companiesController.addMember),
);

/**
 * @swagger
 * /api/companies/{id}/members/{userId}:
 *   delete:
 *     summary: Remove a member (owner only; the owner cannot be removed)
 *     tags: [Companies]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: userId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Member removed }
 *       403: { description: Not allowed }
 *       404: { description: Not found }
 */
companiesRoutes.delete(
  '/:id/members/:userId',
  validate({ params: memberParamsSchema }),
  asyncHandler(companiesController.removeMember),
);

adminCompaniesRoutes.use(authMiddleware, requireRole(Role.ADMIN));

/**
 * @swagger
 * /api/admin/companies:
 *   get:
 *     summary: List every company (admin only), optionally filtered by verification
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: verified, schema: { type: boolean } }
 *     responses:
 *       200: { description: The companies }
 *       403: { description: Admin role required }
 */
adminCompaniesRoutes.get('/', asyncHandler(adminCompaniesController.list));

/**
 * @swagger
 * /api/admin/companies/{id}/verification:
 *   patch:
 *     summary: Verify or un-verify a company (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Verification updated }
 *       403: { description: Admin role required }
 *       404: { description: Company not found }
 */
adminCompaniesRoutes.patch(
  '/:id/verification',
  validate({ params: companyIdParamsSchema, body: verificationSchema }),
  asyncHandler(adminCompaniesController.setVerification),
);
