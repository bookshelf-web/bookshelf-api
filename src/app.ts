import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import setupSwagger from './config/swagger';

const app = express();

// Segurança - Headers HTTP seguros
app.use(helmet());

// CORS configurado - permitir origens específicas
// Em CI/Docker o frontend roda em http://frontend:5173 e o Chromium acessa via esse hostname
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://frontend:5173',
];

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

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }))

export default app;