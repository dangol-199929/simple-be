# Stage 1: build the app and generate Prisma client
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma/
COPY prisma.config.ts tsconfig.json ./
COPY src ./src/

RUN pnpm prisma generate && pnpm build

# Stage 2: minimal image to run the app
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Run as non-root (good practice for production)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=builder --chown=expressjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/package.json ./
COPY --from=builder --chown=expressjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=expressjs:nodejs /app/prisma.config.ts ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
USER expressjs

# Apply migrations then start the server (DATABASE_URL set at runtime)
ENTRYPOINT ["./docker-entrypoint.sh"]

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
