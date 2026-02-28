#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  npm run seed
fi

node dist/index.js
