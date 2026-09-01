# ---- Build stage ----
FROM node:18-alpine AS build

# System deps for any native modules built during install
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Reproducible install, including devDependencies (needed to compile)
COPY package*.json ./
RUN npm ci

# Compile TypeScript -> JavaScript (dist/)
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:18-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy the compiled output only
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Run the compiled JS with plain node - never watch mode
CMD ["node", "dist/server.js"]
