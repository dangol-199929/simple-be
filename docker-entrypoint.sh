#!/bin/sh
set -e

# Prisma CLI (migrate deploy) reads datasource.url from prisma.config.ts, which uses process.env.DATABASE_URL.
# ECS injects DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME — build DATABASE_URL if not set.
if [ -z "$DATABASE_URL" ] && [ -n "$DB_HOST" ] && [ -n "$DB_USERNAME" ] && [ -n "$DB_PASSWORD" ]; then
  DB_NAME="${DB_NAME:-snippet_manager}"
  DB_PORT="${DB_PORT:-5432}"
  export DATABASE_URL="postgresql://${DB_USERNAME}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=no-verify"
fi

npx prisma migrate deploy

exec node dist/index.js
