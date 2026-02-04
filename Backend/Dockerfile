FROM node:22-alpine AS base

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

# Development image for docker-compose
FROM base AS development
WORKDIR /app

# Production build
FROM base AS build
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .

RUN pnpm build

EXPOSE 3001

CMD ["pnpm", "start"]
