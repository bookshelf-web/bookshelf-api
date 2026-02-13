import { Response } from 'express';
import { BooksService } from './booksService';
import { AuthRequest } from '../../types/auth';

class BooksController {
  async create(req: AuthRequest, res: Response) {
    try {
      const result = await BooksService.create({ ...req.body, userId: req.userId });

      return res.status(201).json(result);
    } catch (error: any) {
      console.error('Erro ao criar livro:', error);

      const statusCode = error.statusCode || 400;

      return res.status(statusCode).json({
        error: error.message || 'Erro ao criar livro',
      });
    }
  }

  async list(req: AuthRequest, res: Response) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const status = req.query.status as string | undefined;
      const rating = req.query.rating ? parseInt(req.query.rating as string) : undefined;
      const search = req.query.search as string | undefined;
      const title = req.query.title as string | undefined;
      const author = req.query.author as string | undefined;
      const sortBy = req.query.sortBy as string | undefined;
      const sortOrder = req.query.sortOrder as 'ASC' | 'DESC' | undefined;

      const result = await BooksService.list(req.userId, { 
        page, 
        limit, 
        status, 
        rating, 
        search,
        title,
        author,
        sortBy,
        sortOrder,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao listar livros:', error);

      return res.status(400).json({
        error: error.message || 'Erro ao listar livros',
      });
    }
  }

  async getById(req: AuthRequest, res: Response) {
    try {
      const book = await BooksService.getById(req.params.id, req.userId);

      return res.json({ book });
    } catch (error: any) {
      console.error('Erro ao buscar livro:', error);

      const statusCode = error.statusCode || 400;

      return res.status(statusCode).json({
        error: error.message || 'Erro ao buscar livro',
      });
    }
  }

  async update(req: AuthRequest, res: Response) {
    try {
      const result = await BooksService.update(req.params.id, req.body, req.userId);

      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao atualizar livro:', error);

      const statusCode = error.statusCode || 400;

      return res.status(statusCode).json({
        error: error.message || 'Erro ao atualizar livro',
      });
    }
  }

  async updateStatus(req: AuthRequest, res: Response) {
    try {
      const result = await BooksService.updateStatus(req.params.id, req.body, req.userId);

      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);

      const statusCode = error.statusCode || 400;

      return res.status(statusCode).json({
        error: error.message || 'Erro ao atualizar status',
      });
    }
  }

  async remove(req: AuthRequest, res: Response) {
    try {
      const result = await BooksService.remove(req.params.id, req.userId);

      return res.json(result);
    } catch (error: any) {
      console.error('Erro ao deletar livro:', error);

      const statusCode = error.statusCode || 400;

      return res.status(statusCode).json({
        error: error.message || 'Erro ao deletar livro',
      });
    }
  }
}

export const booksController = new BooksController();