import { Router } from 'express';
import { BooksController } from '../controllers/booksController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();
const booksController = new BooksController();

router.use(authMiddleware);

/**
 * @swagger
 * /api/books:
 *   post:
 *     summary: Criar novo livro
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - author
 *             properties:
 *               title:
 *                 type: string
 *                 example: Clean Code
 *               author:
 *                 type: string
 *                 example: Robert C. Martin
 *               isbn:
 *                 type: string
 *                 example: "9780132350884"
 *               publisher:
 *                 type: string
 *                 example: Prentice Hall
 *               publishedYear:
 *                 type: integer
 *                 example: 2008
 *               pages:
 *                 type: integer
 *                 example: 464
 *               language:
 *                 type: string
 *                 example: pt-BR
 *               coverUrl:
 *                 type: string
 *                 example: https://example.com/cover.jpg
 *               description:
 *                 type: string
 *                 example: Livro sobre boas práticas de programação
 *     responses:
 *       201:
 *         description: Livro criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       409:
 *         description: ISBN já cadastrado
 */
router.post('/', (req, res) => booksController.create(req, res));

/**
 * @swagger
 * /api/books:
 *   get:
 *     summary: Listar todos os livros
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [to_read, reading, read]
 *         description: Filtrar por status
 *       - in: query
 *         name: author
 *         schema:
 *           type: string
 *         description: Buscar por autor
 *       - in: query
 *         name: title
 *         schema:
 *           type: string
 *         description: Buscar por título
 *       - in: query
 *         name: rating
 *         schema:
 *           type: integer
 *         description: Filtrar por rating
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Itens por página
 *     responses:
 *       200:
 *         description: Lista de livros
 *       401:
 *         description: Não autorizado
 */
router.get('/', (req, res) => booksController.list(req, res));

/**
 * @swagger
 * /api/books/{id}:
 *   get:
 *     summary: Buscar livro por ID
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do livro
 *     responses:
 *       200:
 *         description: Livro encontrado
 *       404:
 *         description: Livro não encontrado
 *       401:
 *         description: Não autorizado
 */
router.get('/:id', (req, res) => booksController.getById(req, res));

/**
 * @swagger
 * /api/books/{id}:
 *   put:
 *     summary: Atualizar livro completo
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Book'
 *     responses:
 *       200:
 *         description: Livro atualizado
 *       404:
 *         description: Livro não encontrado
 */
router.put('/:id', (req, res) => booksController.update(req, res));

/**
 * @swagger
 * /api/books/{id}/status:
 *   patch:
 *     summary: Atualizar apenas o status do livro
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [to_read, reading, read]
 *                 example: reading
 *     responses:
 *       200:
 *         description: Status atualizado
 *       400:
 *         description: Status inválido
 *       404:
 *         description: Livro não encontrado
 */
router.patch('/:id/status', (req, res) => booksController.updateStatus(req, res));

/**
 * @swagger
 * /api/books/{id}:
 *   delete:
 *     summary: Deletar livro
 *     tags: [Books]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Livro deletado
 *       404:
 *         description: Livro não encontrado
 */
router.delete('/:id', (req, res) => booksController.delete(req, res));

export default router;