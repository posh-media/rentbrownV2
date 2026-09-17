# syntax=docker/dockerfile:1
# RentBrown API — Cloud Run image (europe-west3)
# Build context must be the REPO ROOT: docker build -f apps/api/Dockerfile .

FROM node:22-slim AS deps
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @rentbrown/api...

FROM deps AS build
COPY tsconfig.base.json turbo.json ./
COPY apps/api ./apps/api
RUN pnpm --filter @rentbrown/api... build
# produce a pruned, deployable package (prod deps only, workspace deps inlined)
RUN pnpm --filter @rentbrown/api deploy --prod --legacy /prod/api

FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN groupadd -r app && useradd -r -g app app
COPY --from=build --chown=app:app /prod/api ./
USER app
EXPOSE 3001
CMD ["node", "dist/main.js"]
