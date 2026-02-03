# 📚 BookShelf API

![Node.js](https://img.shields.io/badge/Node.js-18-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)
![License](https://img.shields.io/badge/license-MIT-green)

API RESTful completa para gerenciamento de biblioteca pessoal, desenvolvida como portfólio de **QA Automation** demonstrando boas práticas de desenvolvimento e testes automatizados.

## 🎯 Objetivo

Este projeto foi criado para demonstrar:
- ✅ Desenvolvimento de API REST profissional
- ✅ Arquitetura limpa e organizada
- ✅ Testes automatizados abrangentes (em desenvolvimento)
- ✅ CI/CD com GitHub Actions (em desenvolvimento)
- ✅ Documentação completa com Swagger
- ✅ Containerização com Docker

## 🚀 Tecnologias

### Backend
- **Node.js 18** - Runtime JavaScript
- **TypeScript** - Tipagem estática
- **Express** - Framework web
- **TypeORM** - ORM para TypeScript/JavaScript
- **PostgreSQL** - Banco de dados relacional

### Autenticação & Segurança
- **JWT** - JSON Web Tokens
- **bcrypt** - Hash de senhas
- **Helmet** - Segurança HTTP headers
- **CORS** - Cross-Origin Resource Sharing

### Documentação
- **Swagger UI** - Interface interativa da API
- **OpenAPI 3.0** - Especificação da API

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração de containers

### Testes (em desenvolvimento)
- **Jest** - Framework de testes
- **Supertest** - Testes de API HTTP
- **ts-jest** - Suporte TypeScript no Jest

## 📋 Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado e rodando
- [Git](https://git-scm.com/) para clonar o repositório
- [Node.js 18+](https://nodejs.org/) (opcional, para desenvolvimento local)

## 🔧 Instalação e Execução

### **Usando Docker (Recomendado)**
```bash
# 1. Clonar o repositório
git clone https://github.com/seu-usuario/bookshelf-api.git
cd bookshelf-api

# 2. Copiar arquivo de ambiente
cp .env.example .env

# 3. Subir containers
docker compose up -d

# 4. Verificar logs
docker compose logs -f
```

A API estará disponível em:
- **API:** http://localhost:3000
- **Swagger UI:** http://localhost:3000/api-docs
- **Health Check:** http://localhost:3000/health

### **Desenvolvimento Local (sem Docker)**
```bash
# 1. Instalar dependências
npm install

# 2. Configurar PostgreSQL local e atualizar .env
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=bookshelf
# DB_USER=seu_usuario
# DB_PASSWORD=sua_senha

# 3. Executar migrations/criar tabelas manualmente
# (usar o script scripts/init-db.sql)

# 4. Rodar em modo desenvolvimento
npm run dev
```

## 📚 Documentação da API

Acesse a documentação interativa completa via Swagger:

👉 **http://localhost:3000/api-docs**

### Endpoints Principais

#### **Autenticação**
- `POST /api/auth/register` - Criar nova conta
- `POST /api/auth/login` - Fazer login

#### **Livros** (requer autenticação)
- `GET /api/books` - Listar todos os livros (com filtros e paginação)
- `POST /api/books` - Criar novo livro
- `GET /api/books/:id` - Buscar livro específico
- `PUT /api/books/:id` - Atualizar livro completo
- `PATCH /api/books/:id/status` - Atualizar apenas status
- `DELETE /api/books/:id` - Deletar livro

#### **Estatísticas** (requer autenticação)
- `GET /api/stats` - Obter estatísticas de leitura

## 🧪 Testes
```bash
# Rodar todos os testes
npm test

# Rodar testes em modo watch
npm run test:watch

# Gerar relatório de cobertura
npm test -- --coverage
```

## 🐳 Comandos Docker Úteis
```bash
# Subir containers
docker compose up -d

# Ver logs em tempo real
docker compose logs -f

# Parar containers
docker compose down

# Reconstruir containers
docker compose up --build

# Acessar banco de dados
docker exec -it bookshelf-db psql -U admin -d bookshelf

# Limpar tudo (cuidado: apaga dados)
docker compose down -v
```

## 📁 Estrutura do Projeto
```
bookshelf-api/
├── src/
│   ├── config/          # Configurações (DB, Swagger)
│   ├── controllers/     # Controladores
│   ├── middlewares/     # Middlewares (auth, errors)
│   ├── models/          # Modelos TypeORM
│   ├── routes/          # Rotas da API
│   ├── services/        # Lógica de negócio
│   ├── types/           # TypeScript types/interfaces
│   ├── app.ts           # Configuração Express
│   └── server.ts        # Entry point
├── tests/               # Testes automatizados
├── scripts/             # Scripts SQL
├── docker-compose.yml   # Configuração Docker
├── Dockerfile           # Imagem Docker
└── package.json         # Dependências
```

## 🔐 Variáveis de Ambiente

Crie um arquivo `.env` baseado no `.env.example`:
```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=db
DB_PORT=5432
DB_NAME=bookshelf
DB_USER=admin
DB_PASSWORD=admin123

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# API
API_PREFIX=/api
```

## 🎨 Features

- ✅ **CRUD Completo** de livros
- ✅ **Autenticação JWT** segura
- ✅ **Validações** de dados
- ✅ **Regras de negócio** (status automático, datas, ISBN único)
- ✅ **Filtros e paginação** na listagem
- ✅ **Estatísticas** de leitura
- ✅ **Documentação Swagger** interativa
- ✅ **Containerização** Docker
- ✅ **TypeScript** com tipagem forte
- 🔄 **Testes automatizados** (em desenvolvimento)
- 🔄 **CI/CD** (em desenvolvimento)

## 🐛 Troubleshooting

### Porta 3000 já está em uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Containers não sobem
```bash
# Ver logs detalhados
docker compose logs

# Reconstruir do zero
docker compose down -v
docker compose up --build
```

## 📝 Roadmap

- [ ] Testes automatizados completos (Jest + Supertest)
- [ ] CI/CD com GitHub Actions
- [ ] Relatórios Allure
- [ ] Testes de performance (K6)
- [ ] Análise de código (SonarQube)
- [ ] Frontend React (futuro)

## 👤 Autor

**Seu Nome**
- QA Engineer com 8+ anos de experiência
- LinkedIn: [seu-linkedin](https://linkedin.com/in/seu-perfil)
- Email: seu@email.com

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🙏 Agradecimentos

Projeto desenvolvido como portfólio de QA Automation para demonstrar habilidades em:
- Desenvolvimento de APIs
- Testes automatizados
- DevOps e CI/CD
- Boas práticas de engenharia de software