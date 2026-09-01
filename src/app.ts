import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import routes from './routes';
import { setupSwagger } from './config/swagger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';

const app = express();

// Render (and most PaaS) serve the app behind a reverse proxy; without this
// express-rate-limit rejects the forwarded client IP.
app.set('trust proxy', 1);

app.use(helmet());

app.use(
  cors({
    // A disallowed origin simply gets no CORS headers (the browser blocks it).
    // Throwing here would surface as a 500 instead.
    origin: (origin, callback) => callback(null, !origin || env.corsOrigins.includes(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use(express.json({ limit: '100kb' }));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', routes);
setupSwagger(app);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
