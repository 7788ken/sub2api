# beehears-plugin: multi-stage build
# Stage 1 - install deps & build frontend
# Stage 2 - production runtime

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# --- Production ---
FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

RUN apk add --no-cache tini curl

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY server.ts tsconfig.json ./
COPY src ./src
COPY db ./db

EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx/esm", "server.ts"]
