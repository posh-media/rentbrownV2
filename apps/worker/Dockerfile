# syntax=docker/dockerfile:1
# RentBrown worker — Cloud Run service (min-instances=1; never scale-to-zero,
# pg-boss polls Postgres for jobs)
# Build context must be the REPO ROOT: docker build -f apps/worker/Dockerfile .

FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/worker/package.json ./apps/worker/package.json
RUN pnpm install --frozen-lockfile --filter @rentbrown/worker...

FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY apps/worker ./apps/worker
RUN pnpm --filter @rentbrown/worker... build
RUN pnpm --filter @rentbrown/worker deploy --prod --legacy /prod/worker

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd -r app && useradd -r -g app app
COPY --from=build --chown=app:app /prod/worker ./
USER app
CMD ["node", "dist/main.js"]
