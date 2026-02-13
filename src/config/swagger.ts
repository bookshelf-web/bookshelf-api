import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookShelf API',
      version: '1.0.0',
      description: 'API para gerenciamento de biblioteca pessoal',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de Desenvolvimento',
      },
    ],
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
    './src/modules/**/*.ts',
    './src/routes.ts',
  ],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

function setupSwagger(app: Express) {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

export default setupSwagger;
export { setupSwagger };