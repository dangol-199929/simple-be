#!/bin/sh
set -e

# Apply pending migrations (uses DATABASE_URL from env)
npx prisma migrate deploy

# Start the API
exec node dist/index.js
