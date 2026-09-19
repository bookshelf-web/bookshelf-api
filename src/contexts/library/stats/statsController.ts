import { Request, Response } from 'express';
import { StatsService } from './statsService';

export const statsController = {
  async overview(req: Request, res: Response) {
    const stats = await StatsService.overview(req.userId as string);
    res.json({ stats });
  },
};
