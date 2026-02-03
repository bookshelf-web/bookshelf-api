import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookShelf API',
      version: '1.0.0',
      description: 'API para gerenciamento de biblioteca pessoal - Portfólio QA',
      contact: {
        name: 'Seu Nome',
        email: 'seu@email.com',
      },
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
        User: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'ID do usuário',
            },
            name: {
              type: 'string',
              description: 'Nome do usuário',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email do usuário',
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Senha do usuário (mínimo 6 caracteres)',
            },
          },
        },
        Book: {
          type: 'object',
          required: ['title', 'author'],
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
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
              description: 'ISBN do livro (10 ou 13 dígitos)',
            },
            publisher: {
              type: 'string',
              description: 'Editora',
            },
            publishedYear: {
              type: 'integer',
              description: 'Ano de publicação',
            },
            pages: {
              type: 'integer',
              description: 'Número de páginas',
            },
            language: {
              type: 'string',
              default: 'pt-BR',
              description: 'Idioma do livro',
            },
            coverUrl: {
              type: 'string',
              description: 'URL da capa do livro',
            },
            description: {
              type: 'string',
              description: 'Descrição do livro',
            },
            status: {
              type: 'string',
              enum: ['to_read', 'reading', 'read'],
              default: 'to_read',
              description: 'Status de leitura',
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: 'Avaliação (1-5)',
            },
            notes: {
              type: 'string',
              description: 'Anotações sobre o livro',
            },
            startedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data que começou a ler',
            },
            finishedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Data que terminou de ler',
            },
          },
        },
        Error: {
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
    tags: [
      {
        name: 'Auth',
        description: 'Endpoints de autenticação',
      },
      {
        name: 'Books',
        description: 'Endpoints de gerenciamento de livros',
      },
      {
        name: 'Stats',
        description: 'Endpoints de estatísticas',
      },
    ],
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
export { swaggerUi };