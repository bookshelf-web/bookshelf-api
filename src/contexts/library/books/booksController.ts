import { Request, Response } from 'express';
import { BooksService } from './booksService';
import { listBooksQuerySchema } from './booksSchemas';

const userId = (req: Request): string => req.userId as string;

export const booksController = {
  async create(req: Request, res: Response) {
    const book = await BooksService.create(userId(req), req.body);
    res.status(201).json({ message: 'Book created successfully', book });
  },

  async list(req: Request, res: Response) {
    const query = listBooksQuerySchema.parse(req.query);
    const result = await BooksService.list(userId(req), query);
    res.json(result);
  },

  async getById(req: Request, res: Response) {
    const book = await BooksService.getById(userId(req), req.params.id);
    res.json({ book });
  },

  async update(req: Request, res: Response) {
    const book = await BooksService.update(userId(req), req.params.id, req.body);
    res.json({ message: 'Book updated successfully', book });
  },

  async updateStatus(req: Request, res: Response) {
    const book = await BooksService.updateStatus(userId(req), req.params.id, req.body.status);
    res.json({ message: 'Book status updated successfully', book });
  },

  async remove(req: Request, res: Response) {
    await BooksService.remove(userId(req), req.params.id);
    res.json({ message: 'Book deleted successfully' });
  },
};
