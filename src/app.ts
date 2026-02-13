import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import setupSwagger from './config/swagger';

const app = express();

// Segurança - Headers HTTP seguros
app.use(helmet());

// CORS configurado - permitir apenas origens específicas
const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requisições sem origin (mobile apps, Postman, etc)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

app.use('/api', routes);

/**
 * Swagger
 */
setupSwagger(app);

export default app;