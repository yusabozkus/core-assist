FROM node:22-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run db:generate && npm run build

FROM base AS runtime

ENV NODE_ENV=production
ENV PORT=4001

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY docker-env.cjs ./
COPY --from=build /app/dist ./dist

USER node

EXPOSE 4001

ENTRYPOINT ["node", "--require", "./docker-env.cjs"]
CMD ["dist/src/main.js"]
