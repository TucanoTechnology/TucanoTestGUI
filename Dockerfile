FROM node:26-trixie-slim AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

FROM nginx:trixie

ARG BUILD_NUMBER=local
LABEL org.opencontainers.image.version="${BUILD_NUMBER}"

RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 8080
