# API e worker usam a mesma imagem (seção 10); o comando decide o processo.
# Debian slim (glibc), não Alpine: o motor do Prisma é multithread e o malloc da musl virava gargalo
# sob carga (teste de carga da Fase 7: ~4× menos vazão na imagem Alpine).
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl wget ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api... 
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @vagas/contracts build && pnpm --filter api build

FROM build AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
