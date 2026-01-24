ARG NODE_MAJOR_VERSION=22
ARG SENTRY_AUTH_TOKEN

FROM node:${NODE_MAJOR_VERSION}-slim AS base

RUN apt-get update -y && apt-get install -y openssl && \
  apt-get clean && rm -rf /var/lib/apt/lists/* && \
  npm install -g npm@^11

FROM base AS dependencies

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY . .

ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

RUN npm run db:generate && npm run build

FROM gcr.io/distroless/nodejs${NODE_MAJOR_VERSION}-debian12 AS production

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3000

CMD ["dist/src/main"]
