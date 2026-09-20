import { Request, Response, Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { requireRole } from '../../middlewares/requireRole';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { withContext } from '../../shared/requestContext';
import { Role } from '../../shared/roles';
import { CatalogService } from './catalogService';
import { CatalogBookStatus } from './models/CatalogBook';
import {
  adminEditSchema,
  catalogSearchQuerySchema,
  decisionSchema,
  idParamsSchema,
  reviewBooksQuerySchema,
  revisionsQuerySchema,
  visibilitySchema,
} from './catalogSchemas';

const userId = (req: Request): string => req.userId as string;

// ─── Public catalog (any signed-in user) ─────────────────────────────────────

export const catalogRoutes = Router();
catalogRoutes.use(withContext('catalog'), authMiddleware);

/**
 * @swagger
 * /api/catalog/books:
 *   get:
 *     summary: Search the shared catalog (active books only)
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: isbn, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: A page of catalog books }
 */
catalogRoutes.get(
  '/books',
  validate({ query: catalogSearchQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await CatalogService.search(catalogSearchQuerySchema.parse(req.query)));
  }),
);

/**
 * @swagger
 * /api/catalog/books/{id}:
 *   get:
 *     summary: Get a catalog book
 *     tags: [Catalog]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: The book }
 *       404: { description: Not found (hidden books are not found either) }
 */
catalogRoutes.get(
  '/books/:id',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const book = await CatalogService.getById(req.params.id);
    if (book.status === CatalogBookStatus.HIDDEN) {
      res.status(404).json({
        error: 'Catalog book not found',
        code: 'CATALOG_BOOK_NOT_FOUND',
        context: 'catalog',
        requestId: String(req.id),
      });
      return;
    }
    res.json({ book });
  }),
);

// ─── Moderation (admin) ──────────────────────────────────────────────────────

export const adminCatalogRoutes = Router();
adminCatalogRoutes.use(withContext('catalog'), authMiddleware, requireRole(Role.ADMIN));

/**
 * @swagger
 * /api/admin/catalog/books:
 *   get:
 *     summary: Catalog books for moderation, e.g. review=pending_review (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: review, schema: { type: string, enum: [pending_review, reviewed] } }
 *       - { in: query, name: status, schema: { type: string, enum: [active, hidden] } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: A page of catalog books, oldest first }
 */
adminCatalogRoutes.get(
  '/books',
  validate({ query: reviewBooksQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await CatalogService.listBooksForReview(reviewBooksQuerySchema.parse(req.query)));
  }),
);

/**
 * @swagger
 * /api/admin/catalog/books/{id}:
 *   patch:
 *     summary: Edit a catalog book directly (admin only, audited)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Book updated }
 *       409: { description: Another book already has this identity }
 */
adminCatalogRoutes.patch(
  '/books/:id',
  validate({ params: idParamsSchema, body: adminEditSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const book = await CatalogService.adminEdit(userId(req), req.params.id, req.body);
    res.json({ message: 'Catalog book updated', book });
  }),
);

/**
 * @swagger
 * /api/admin/catalog/books/{id}/review:
 *   post:
 *     summary: Confirm that a first registration looked fine (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Book marked as reviewed }
 */
adminCatalogRoutes.post(
  '/books/:id/review',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ message: 'Catalog book reviewed', book: await CatalogService.confirmBook(userId(req), req.params.id) });
  }),
);

/**
 * @swagger
 * /api/admin/catalog/books/{id}/visibility:
 *   patch:
 *     summary: Take a book down or bring it back (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Visibility updated }
 */
adminCatalogRoutes.patch(
  '/books/:id/visibility',
  validate({ params: idParamsSchema, body: visibilitySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { hidden, reason } = req.body;
    res.json({
      message: hidden ? 'Catalog book hidden' : 'Catalog book restored',
      book: await CatalogService.setHidden(userId(req), req.params.id, hidden, reason),
    });
  }),
);

/**
 * @swagger
 * /api/admin/catalog/revisions:
 *   get:
 *     summary: Proposed edits waiting for a decision (admin only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, approved, rejected] } }
 *     responses:
 *       200: { description: A page of revisions with their book, oldest first }
 */
adminCatalogRoutes.get(
  '/revisions',
  validate({ query: revisionsQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await CatalogService.listRevisions(revisionsQuerySchema.parse(req.query)));
  }),
);

/**
 * @swagger
 * /api/admin/catalog/revisions/{id}/decision:
 *   post:
 *     summary: Approve or reject a proposed edit (admin only, audited)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Decision recorded; an approved edit is applied to the book }
 *       404: { description: Revision not found }
 *       409: { description: Already decided, or the edit would duplicate another book }
 */
adminCatalogRoutes.post(
  '/revisions/:id/decision',
  validate({ params: idParamsSchema, body: decisionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { decision, note } = req.body;
    const result = await CatalogService.decideRevision(userId(req), req.params.id, decision, note);
    res.json({ message: `Revision ${decision === 'approve' ? 'approved' : 'rejected'}`, ...result });
  }),
);
