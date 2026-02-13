import { Response } from 'express';
import { StatsService } from './statsService';
import { AuthRequest } from '../../types/auth';

class StatsController {
  async overview(req: AuthRequest, res: Response) {
    try {
      const stats = await StatsService.overview(req.userId);
      return res.json(stats);
    } catch (error: any) {
      console.error('Erro ao buscar estatísticas:', error);
      return res.status(500).json({
        error: error.message || 'Erro ao buscar estatísticas',
      });
    }
  }
}

export const statsController = new StatsController();