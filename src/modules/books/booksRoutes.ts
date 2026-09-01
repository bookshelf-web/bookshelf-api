import { Router } from 'express';
import { authMiddleware } from '../../middlewares/authMiddleware';
import { validate } from '../../middlewares/validate';
import { asyncHandler } from '../../shared/asyncHandler';
import { booksController } from './booksController';
import {
  bookIdParamsSchema,
  createBookSchema,
  updateBookSchema,
  updateBookStatusSchema,
} from './booksSchemas';

const router = Router();

router.use(authMiddleware);

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Create a book
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookInput'
 *     responses:
 *       201: { description: Book created }
 *       400: { description: Invalid input }
 *       409: { description: ISBN already registered }
 */
router.post('/', validate({ body: createBookSchema }), asyncHandler(booksController.create));

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: List the authenticated user's books
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: status, schema: { type: string, enum: [to_read, reading, read] } }
 *       - { in: query, name: rating, schema: { type: integer } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: title, schema: { type: string } }
 *       - { in: query, name: author, schema: { type: string } }
 *       - { in: query, name: sortBy, schema: { type: string } }
 *       - { in: query, name: sortOrder, schema: { type: string, enum: [ASC, DESC] } }
 *     responses:
 *       200: { description: Paginated list of books }
 */
router.get('/', asyncHandler(booksController.list));

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Get a book by id
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Book found }
 *       404: { description: Book not found }
 */
router.get('/:id', validate({ params: bookIdParamsSchema }), asyncHandler(booksController.getById));

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Update a book
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateBookInput'
 *     responses:
 *       200: { description: Book updated }
 *       400: { description: Invalid input }
 *       404: { description: Book not found }
 *       409: { description: ISBN already registered }
 */
router.put(
  '/:id',
  validate({ params: bookIdParamsSchema, body: updateBookSchema }),
  asyncHandler(booksController.update),
);

/**
 * @swagger
 * /api/books/{id}/status:
 *   patch:
 *     summary: Update a book's reading status
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [to_read, reading, read] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status }
 *       404: { description: Book not found }
 */
router.patch(
  '/:id/status',
  validate({ params: bookIdParamsSchema, body: updateBookStatusSchema }),
  asyncHandler(booksController.updateStatus),
);

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Delete a book
 *     tags: [Books]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Book deleted }
 *       404: { description: Book not found }
 */
router.delete(
  '/:id',
  validate({ params: bookIdParamsSchema }),
  asyncHandler(booksController.remove),
);

export default router;
