FROM node:26-bookworm-slim AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.29-alpine

ARG BUILD_NUMBER=local
LABEL org.opencontainers.image.version="${BUILD_NUMBER}"

USER root
RUN apk update && apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 8080
USER 101
