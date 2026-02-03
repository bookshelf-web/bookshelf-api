import { Response } from 'express';
import { BooksService } from '../services/booksService';
import { AuthRequest, BookStatus } from '../types';

const booksService = new BooksService();

export class BooksController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const bookData = req.body;

      // Validações básicas
      if (!bookData.title || !bookData.author) {
        res.status(400).json({ error: 'Título e autor são obrigatórios' });
        return;
      }

      const book = await booksService.createBook(userId, bookData);

      res.status(201).json({
        message: 'Livro criado com sucesso',
        book,
      });
    } catch (error: any) {
      if (error.message === 'ISBN já cadastrado') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error.message === 'Ano de publicação não pode ser no futuro') {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar livro' });
    }
  }

  async list(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const filters = {
        status: req.query.status as BookStatus,
        rating: req.query.rating ? parseInt(req.query.rating as string) : undefined,
        author: req.query.author as string,
        title: req.query.title as string,
        publishedYear: req.query.publishedYear ? parseInt(req.query.publishedYear as string) : undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'ASC',
      };

      const result = await booksService.getBooks(userId, filters);

      res.status(200).json({
        books: result.books,
        pagination: {
          total: result.total,
          page: filters.page,
          limit: filters.limit,
          totalPages: Math.ceil(result.total / filters.limit),
        },
      });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao listar livros' });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const book = await booksService.getBookById(userId, id);

      res.status(200).json({ book });
    } catch (error: any) {
      if (error.message === 'Livro não encontrado') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao buscar livro' });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const updateData = req.body;

      const book = await booksService.updateBook(userId, id, updateData);

      res.status(200).json({
        message: 'Livro atualizado com sucesso',
        book,
      });
    } catch (error: any) {
      if (error.message === 'Livro não encontrado') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message === 'ISBN já cadastrado') {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error.message.includes('Rating') || error.message.includes('Ano de publicação')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao atualizar livro' });
    }
  }

  async updateStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !Object.values(BookStatus).includes(status)) {
        res.status(400).json({ error: 'Status inválido' });
        return;
      }

      const book = await booksService.updateBookStatus(userId, id, status);

      res.status(200).json({
        message: 'Status atualizado com sucesso',
        book,
      });
    } catch (error: any) {
      if (error.message === 'Livro não encontrado') {
        res.status(404).json({ error: error.message });
        return;
      }
      if (error.message.includes('Data')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao atualizar status' });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await booksService.deleteBook(userId, id);

      res.status(200).json({ message: 'Livro removido com sucesso' });
    } catch (error: any) {
      if (error.message === 'Livro não encontrado') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao remover livro' });
    }
  }
}