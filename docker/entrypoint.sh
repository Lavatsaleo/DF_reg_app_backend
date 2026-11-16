#!/bin/sh
# Applies any pending database migrations, then starts the API.
# Set RUN_MIGRATIONS=false when running more than one API replica, and run migrations once instead:
#   docker run --rm --env-file .env <image> npx prisma migrate deploy
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Applying database migrations (prisma migrate deploy)"
  npx --no-install prisma migrate deploy
fi

exec "$@"
