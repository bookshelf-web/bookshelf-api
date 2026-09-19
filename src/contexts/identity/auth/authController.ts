import { Request, Response } from 'express';
import { AuthService } from './authService';

export const authController = {
  async register(req: Request, res: Response) {
    const result = await AuthService.register(req.body);
    res.status(201).json({ message: 'User registered successfully', ...result });
  },

  async login(req: Request, res: Response) {
    const result = await AuthService.login(req.body);
    res.json({ message: 'Login successful', ...result });
  },
};
