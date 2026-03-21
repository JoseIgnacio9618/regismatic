#!/bin/sh
set -e

npx prisma migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  npm run seed
fi

if [ "$RUN_DEMO_FIXTURES" = "true" ]; then
  npm run seed:fixtures
fi

node dist/index.js
