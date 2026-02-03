import 'reflect-metadata';
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/authRoutes';
import booksRoutes from './routes/booksRoutes';
import statsRoutes from './routes/statsRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { swaggerUi, swaggerSpec } from './config/swagger';

dotenv.config();

const app: Application = express();

// Middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Redirect para Swagger
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Rotas da API
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/books`, booksRoutes);
app.use(`${apiPrefix}/stats`, statsRoutes);

// Rota 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// Error handler
app.use(errorHandler);

export default app;