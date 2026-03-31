# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG PNPM_VERSION=10.33.0

FROM node:${NODE_VERSION}-slim AS base
WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG APP_NAME=orders
RUN pnpm run build:${APP_NAME}

FROM base AS production
WORKDIR /usr/src/app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /usr/src/app/node_modules ./node_modules
RUN pnpm prune --prod

COPY --from=build /usr/src/app/dist ./dist

USER node

ARG APP_NAME=orders
CMD ["sh", "-c", "node dist/apps/${APP_NAME}/main"]
