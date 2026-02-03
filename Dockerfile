FROM node:18-alpine

# Instalar dependências do sistema
RUN apk add --no-cache python3 make g++

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Expor porta
EXPOSE 3000

# Rodar direto com ts-node-dev (sem compilar)
CMD ["npm", "run", "dev"]