import { Response } from 'express';
import { BooksService } from '../services/booksService';
import { AuthRequest } from '../types';

const booksService = new BooksService();

export class StatsController {
  async getStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;

      const stats = await booksService.getStats(userId);

      res.status(200).json({ stats });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao buscar estatísticas' });
    }
  }
}