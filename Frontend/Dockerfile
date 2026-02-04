# Use official Node.js image
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm build

# Development image for docker-compose
FROM base AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Production image, copy all the files and run react-router
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Add non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

COPY --from=builder /app/public ./public
COPY --from=builder --chown=appuser:nodejs /app/build ./build
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./package.json

USER appuser

EXPOSE 5173

ENV PORT=5173
ENV HOSTNAME="0.0.0.0"

CMD ["node", "node_modules/@react-router/serve/dist/index.js", "./build/index.html"]