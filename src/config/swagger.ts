import path from 'path';
import { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

// Em produção o Render expõe a URL pública em RENDER_EXTERNAL_URL
const servers = [
  ...(process.env.RENDER_EXTERNAL_URL
    ? [{ url: process.env.RENDER_EXTERNAL_URL, description: 'Produção' }]
    : []),
  {
    url: `http://localhost:${process.env.PORT || 3000}`,
    description: 'Servidor de Desenvolvimento',
  },
];

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookShelf API',
      version: '1.0.0',
      description: 'API para gerenciamento de biblioteca pessoal',
    },
    servers,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        RegisterInput: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              description: 'Nome do usuário',
              example: 'João Silva',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário',
              example: 'joao@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Senha do usuário (mínimo 6 caracteres)',
              minLength: 6,
              example: 'senha123',
            },
          },
        },
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário',
              example: 'joao@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Senha do usuário',
              example: 'senha123',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Usuário criado com sucesso',
            },
            token: {
              type: 'string',
              description: 'Token JWT para autenticação',
            },
            user: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                email: {
                  type: 'string',
                },
              },
            },
          },
        },
        Book: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID do livro',
            },
            title: {
              type: 'string',
              description: 'Título do livro',
            },
            author: {
              type: 'string',
              description: 'Autor do livro',
            },
            isbn: {
              type: 'string',
              description: 'ISBN do livro (único)',
              example: '9780132350884',
            },
            publisher: {
              type: 'string',
              description: 'Editora',
              example: 'Prentice Hall',
            },
            publishedYear: {
              type: 'integer',
              description: 'Ano de publicação',
              example: 2008,
            },
            pages: {
              type: 'integer',
              description: 'Número de páginas',
              example: 464,
            },
            language: {
              type: 'string',
              description: 'Idioma do livro',
              example: 'pt-BR',
            },
            description: {
              type: 'string',
              description: 'Descrição do livro',
            },
            status: {
              type: 'string',
              enum: ['to_read', 'reading', 'read'],
              description: 'Status de leitura do livro',
            },
            userId: {
              type: 'string',
              description: 'ID do usuário dono do livro',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreateBookInput: {
          type: 'object',
          required: ['title', 'author'],
          properties: {
            title: {
              type: 'string',
              description: 'Título do livro',
              example: 'Clean Code',
            },
            author: {
              type: 'string',
              description: 'Autor do livro',
              example: 'Robert C. Martin',
            },
            isbn: {
              type: 'string',
              description: 'ISBN do livro (opcional, mas deve ser único se fornecido)',
              example: '9780132350884',
            },
            publisher: {
              type: 'string',
              description: 'Editora (opcional)',
              example: 'Prentice Hall',
            },
            publishedYear: {
              type: 'integer',
              description: 'Ano de publicação (opcional, não pode ser no futuro)',
              example: 2008,
            },
            pages: {
              type: 'integer',
              description: 'Número de páginas (opcional)',
              example: 464,
            },
            language: {
              type: 'string',
              description: 'Idioma do livro (opcional)',
              example: 'pt-BR',
            },
            description: {
              type: 'string',
              description: 'Descrição do livro (opcional)',
            },
          },
        },
        UpdateBookInput: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Título do livro',
              example: 'Clean Code',
            },
            author: {
              type: 'string',
              description: 'Autor do livro',
              example: 'Robert C. Martin',
            },
            isbn: {
              type: 'string',
              description: 'ISBN do livro',
              example: '9780132350884',
            },
            publisher: {
              type: 'string',
              description: 'Editora',
              example: 'Prentice Hall',
            },
            publishedYear: {
              type: 'integer',
              description: 'Ano de publicação',
              example: 2008,
            },
            pages: {
              type: 'integer',
              description: 'Número de páginas',
              example: 464,
            },
            language: {
              type: 'string',
              description: 'Idioma do livro',
              example: 'pt-BR',
            },
            description: {
              type: 'string',
              description: 'Descrição do livro',
            },
            status: {
              type: 'string',
              enum: ['to_read', 'reading', 'read'],
              description: 'Status de leitura',
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro',
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  /**
   * ⚠️ MUITO IMPORTANTE
   * Aqui é onde o Swagger encontra TODAS as rotas
   */
  apis: [
    // __dirname aponta para src/config (dev) ou dist/config (produção);
    // o glob {ts,js} cobre os dois casos
    path.join(__dirname, '../modules/**/*.{ts,js}'),
    path.join(__dirname, '../routes.{ts,js}'),
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

function setupSwagger(app: Express) {
  // O helmet() global aplica uma CSP que bloqueia os scripts inline do
  // Swagger UI; nesta rota afrouxamos apenas o necessário para a página renderizar
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

export default setupSwagger;
export { setupSwagger };