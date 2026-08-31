FROM node:24-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY . .
# Install skips lifecycle scripts, so run the project's postinstall explicitly
# to generate WXT's inherited TypeScript config before the Web Vite build.
RUN pnpm run postinstall
RUN pnpm run build:web:all

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    AAH_WEB_HOST=0.0.0.0 \
    AAH_WEB_PORT=8787 \
    AAH_WEB_DATABASE_PATH=/data/all-api-hub.sqlite \
    AAH_WEB_STATIC_DIR=/app/web

WORKDIR /app

RUN groupadd --system all-api-hub \
    && useradd --system --gid all-api-hub --home-dir /app all-api-hub \
    && mkdir -p /data \
    && chown all-api-hub:all-api-hub /data

COPY --from=build --chown=all-api-hub:all-api-hub /app/.output/web ./web
COPY --from=build --chown=all-api-hub:all-api-hub /app/.output/web-server ./web-server

USER all-api-hub

VOLUME ["/data"]
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/api/health').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "web-server/server.mjs"]
