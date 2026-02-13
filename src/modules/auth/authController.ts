import { Request, Response } from 'express';
import { AuthService } from './authService';

class AuthController {
  async register(req: Request, res: Response) {
    try {
      const result = await AuthService.register(req.body);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error('Erro no registro:', error);
      
      const statusCode = error.statusCode || 400;
      
      return res.status(statusCode).json({
        error: error.message || 'Erro ao registrar usuário',
      });
    }
  }

  async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body);
      return res.json(result);
    } catch (error: any) {
      console.error('Erro no login:', error);
      
      const statusCode = error.statusCode || 400;
      
      return res.status(statusCode).json({
        error: error.message || 'Erro ao fazer login',
      });
    }
  }
}

export const authController = new AuthController();