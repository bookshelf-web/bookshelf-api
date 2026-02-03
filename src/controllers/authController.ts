import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;

      // Validações básicas
      if (!name || !email || !password) {
        res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' });
        return;
      }

      const result = await authService.register(name, email, password);

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        token: result.token,
      });
    } catch (error: any) {
      if (error.message === 'Email já cadastrado') {
        res.status(409).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao criar usuário' });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validações básicas
      if (!email || !password) {
        res.status(400).json({ error: 'Email e senha são obrigatórios' });
        return;
      }

      const result = await authService.login(email, password);

      res.status(200).json({
        message: 'Login realizado com sucesso',
        user: {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
        },
        token: result.token,
      });
    } catch (error: any) {
      if (error.message === 'Credenciais inválidas') {
        res.status(401).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: 'Erro ao fazer login' });
    }
  }
}