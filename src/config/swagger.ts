import path from 'path';
import { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env';

const servers = [
  ...(process.env.RENDER_EXTERNAL_URL
    ? [{ url: process.env.RENDER_EXTERNAL_URL, description: 'Production' }]
    : []),
  { url: `http://localhost:${env.PORT}`, description: 'Local development' },
];

const bookProperties = {
  title: { type: 'string', example: 'Clean Code' },
  author: { type: 'string', example: 'Robert C. Martin' },
  isbn: { type: 'string', example: '9780132350884' },
  publisher: { type: 'string', example: 'Prentice Hall' },
  publishedYear: { type: 'integer', example: 2008 },
  pages: { type: 'integer', example: 464 },
  language: { type: 'string', example: 'en' },
  description: { type: 'string' },
  rating: { type: 'integer', minimum: 1, maximum: 5 },
  notes: { type: 'string' },
  coverUrl: { type: 'string' },
  status: { type: 'string', enum: ['to_read', 'reading', 'read'] },
};

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookShelf API',
      version: '1.0.0',
      description: 'REST API for managing a personal book library',
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'Jane Doe' },
            email: { type: 'string', format: 'email', example: 'jane@example.com' },
            password: { type: 'string', format: 'password', minLength: 6, example: 'secret123' },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'jane@example.com' },
            password: { type: 'string', format: 'password', example: 'secret123' },
          },
        },
        Book: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            ...bookProperties,
            userId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateBookInput: {
          type: 'object',
          required: ['title', 'author'],
          properties: bookProperties,
        },
        UpdateBookInput: { type: 'object', properties: bookProperties },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            details: {},
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    // __dirname is src/config (dev) or dist/config (prod); the {ts,js} glob covers both.
    path.join(__dirname, '../modules/**/*.{ts,js}'),
    path.join(__dirname, '../routes.{ts,js}'),
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

export function setupSwagger(app: Express): void {
  // The global helmet() CSP blocks Swagger UI's inline scripts; relax just this route.
  const swaggerCsp = helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'https:'],
      },
    },
  });

  app.use('/api-docs', swaggerCsp, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
