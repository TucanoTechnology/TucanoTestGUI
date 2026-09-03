FROM ubuntu:26.04 AS builder

WORKDIR /build
COPY package.json package-lock.json ./
RUN apt-get update \
    && apt-get install --no-install-recommends --yes nodejs npm ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

FROM ubuntu/nginx:latest

ARG BUILD_NUMBER=local
LABEL org.opencontainers.image.version="${BUILD_NUMBER}"

RUN rm -f /etc/nginx/sites-enabled/default

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 8080
