# ---- Build stage ----
FROM node:18-alpine AS build

# Dependências de sistema para eventuais módulos nativos durante o build
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Instalar dependências (incl. devDependencies) de forma reprodutível
COPY package*.json ./
RUN npm ci

# Copiar código fonte e compilar TypeScript -> JavaScript (dist/)
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:18-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Somente dependências de produção
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar apenas os artefatos já compilados
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Produção: roda o JS compilado com node puro — NUNCA watch mode
CMD ["node", "dist/server.js"]
