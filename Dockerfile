# Digital Futures registration API (Node.js + Express + Prisma/MySQL).
# Build:  docker build -t df-backend .
# Run:    see deploy/DEPLOYMENT.md. Configuration comes only from environment variables.

FROM node:24-bookworm-slim AS base
# OpenSSL for the Prisma query engine; tini forwards stop signals so the API shuts down cleanly.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PRISMA_HIDE_UPDATE_MESSAGE=1 \
    CHECKPOINT_DISABLE=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

# Production dependencies only (the Prisma CLI is one, so migrations can run in the container).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx --no-install prisma generate

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=5000
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY dhis2 ./dhis2
COPY docker/entrypoint.sh /usr/local/bin/df-entrypoint
RUN chmod 0755 /usr/local/bin/df-entrypoint

# Run as the unprivileged "node" user; the app never writes to its own files.
USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/df-entrypoint"]
CMD ["node", "src/server.js"]
