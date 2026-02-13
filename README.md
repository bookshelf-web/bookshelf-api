# 📚 BookShelf API

API REST para gerenciamento de biblioteca pessoal, desenvolvida com Node.js, TypeScript, Express e PostgreSQL.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Tests-123%2F125-brightgreen)](https://jestjs.io/)
[![Coverage](https://img.shields.io/badge/Coverage-93%25-brightgreen)](https://jestjs.io/)

## 🚀 Funcionalidades

- ✅ **Autenticação JWT** - Sistema completo de registro e login
- ✅ **CRUD de Livros** - Gerenciamento completo de livros
- ✅ **Filtros e Busca** - Por status, rating, título e autor
- ✅ **Paginação** - Listagem paginada de livros
- ✅ **Estatísticas** - Dashboard com métricas da biblioteca
- ✅ **Status de Leitura** - To Read, Reading, Read
- ✅ **Timestamps Automáticos** - Data de início e término de leitura
- ✅ **Isolamento de Dados** - Cada usuário vê apenas seus livros
- ✅ **Documentação Swagger** - API documentada automaticamente
- ✅ **Testes Automatizados** - 98.4% de cobertura

## 🛠️ Tecnologias

### Backend
- **Node.js** - Runtime JavaScript
- **TypeScript** - Superset tipado de JavaScript
- **Express** - Framework web
- **TypeORM** - ORM para TypeScript/JavaScript
- **PostgreSQL** - Banco de dados relacional

### Segurança
- **bcryptjs** - Hash de senhas
- **jsonwebtoken** - Autenticação JWT
- **helmet** - Proteção de headers HTTP
- **cors** - Configuração de CORS
- **express-rate-limit** - Proteção contra brute force

### Testes
- **Jest** - Framework de testes
- **Supertest** - Testes de API

## 📋 Pré-requisitos

- Node.js 18+ 
- PostgreSQL 14+
- npm ou yarn

## 🔧 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/bookshelf-api.git
cd bookshelf-api
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações:

```env
# Ambiente
NODE_ENV=development

# Servidor
PORT=3000

# CORS - Origens permitidas
CORS_ORIGIN=http://localhost:3000

# Banco de Dados
DB_HOST=localhost
DB_PORT=5432
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=bookshelf

# JWT Secret - OBRIGATÓRIO - Mínimo 32 caracteres
# Gere uma chave forte: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=sua_chave_super_secreta_aqui
```

### 4. Configure o banco de dados

Crie o banco de dados PostgreSQL:

```bash
createdb bookshelf
```

Execute as migrations (ou use synchronize temporariamente):

```sql
-- Criar tabela users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela books
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  isbn VARCHAR(20) UNIQUE,
  publisher VARCHAR(255),
  published_year INTEGER,
  pages INTEGER,
  language VARCHAR(10),
  description TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  cover_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'to_read',
  started_at TIMESTAMP,
  finished_at TIMESTAMP,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Criar índices para performance
CREATE INDEX idx_books_user_id ON books(user_id);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_created_at ON books(created_at);
```

### 5. Inicie o servidor

```bash
# Desenvolvimento (com hot reload)
npm run dev

# Produção
npm run build
npm start
```

O servidor estará rodando em `http://localhost:3000`

## 📖 Documentação da API

Acesse a documentação Swagger em: `http://localhost:3000/api-docs`

## 🔐 Autenticação

A API usa JWT (JSON Web Tokens) para autenticação.

### Registrar

```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "João Silva",
  "email": "joao@example.com",
  "password": "senha123"
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "joao@example.com",
  "password": "senha123"
}
```

**Resposta:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@example.com"
  }
}
```

### Usando o Token

Inclua o token no header `Authorization` de todas as requisições protegidas:

```http
Authorization: Bearer seu_token_aqui
```

## 📚 Endpoints

### Books

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| `GET` | `/api/books` | Listar livros | ✅ |
| `GET` | `/api/books/:id` | Buscar livro por ID | ✅ |
| `POST` | `/api/books` | Criar livro | ✅ |
| `PUT` | `/api/books/:id` | Atualizar livro | ✅ |
| `PATCH` | `/api/books/:id/status` | Atualizar status | ✅ |
| `DELETE` | `/api/books/:id` | Deletar livro | ✅ |

### Stats

| Método | Endpoint | Descrição | Autenticação |
|--------|----------|-----------|--------------|
| `GET` | `/api/stats` | Estatísticas do usuário | ✅ |

## 🔍 Exemplos de Uso

### Criar um livro

```http
POST /api/books
Authorization: Bearer seu_token
Content-Type: application/json

{
  "title": "Clean Code",
  "author": "Robert C. Martin",
  "isbn": "9780132350884",
  "publisher": "Prentice Hall",
  "publishedYear": 2008,
  "pages": 464,
  "language": "en",
  "description": "A handbook of agile software craftsmanship"
}
```

### Listar livros com filtros

```http
GET /api/books?status=reading&page=1&limit=10
Authorization: Bearer seu_token
```

### Buscar por título

```http
GET /api/books?title=clean
Authorization: Bearer seu_token
```

### Atualizar status de leitura

```http
PATCH /api/books/:id/status
Authorization: Bearer seu_token
Content-Type: application/json

{
  "status": "reading"
}
```

## 🧪 Testes

Execute os testes:

```bash
# Todos os testes
npm test

# Com watch mode
npm run test:watch

# Com coverage
npm test -- --coverage
```

**Resultados:**
- ✅ 123/125 testes passando (98.4%)
- ✅ 93.13% de cobertura de código

## 🏗️ Estrutura do Projeto

```
bookshelf-api/
├── src/
│   ├── config/          # Configurações (DB, Swagger, Env)
│   ├── middlewares/     # Middlewares (Auth)
│   ├── models/          # Entidades TypeORM (User, Book)
│   ├── modules/         # Módulos da aplicação
│   │   ├── auth/        # Autenticação (controller, service, routes)
│   │   ├── books/       # Livros (controller, service, routes)
│   │   └── stats/       # Estatísticas (controller, service, routes)
│   ├── types/           # Tipos TypeScript
│   ├── app.ts           # Configuração do Express
│   ├── routes.ts        # Rotas principais
│   └── server.ts        # Entry point
├── tests/               # Testes automatizados
├── .env.example         # Exemplo de variáveis de ambiente
├── package.json
├── tsconfig.json
└── README.md
```

## 🔒 Segurança

### Implementado

- ✅ **Hash de Senhas** - bcrypt com 10 rounds
- ✅ **JWT** - Tokens com expiração de 7 dias
- ✅ **CORS Configurado** - Apenas origens permitidas
- ✅ **Helmet** - Headers HTTP seguros
- ✅ **Rate Limiting** - Proteção contra brute force
- ✅ **SQL Injection** - Prevenido pelo TypeORM
- ✅ **Validação de Input** - Campos obrigatórios validados
- ✅ **Isolamento de Dados** - Usuários isolados por userId

## 🚀 Deploy

### Variáveis de Ambiente Necessárias

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://seu-dominio.com
DB_HOST=seu-db-host
DB_PORT=5432
DB_USER=seu-usuario
DB_PASSWORD=senha-segura
DB_NAME=bookshelf
JWT_SECRET=chave-super-secreta-minimo-32-caracteres
```

### Comandos

```bash
# Build
npm run build

# Start
npm start
```