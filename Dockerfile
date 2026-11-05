FROM node:26.13.0-alpine AS base
ARG TARGETARCH
# Node 26 does not bundle Corepack. Install the pinned native pnpm release.
# Digests are from the immutable pnpm v12.16.1 GitHub release assets.
RUN case "$TARGETARCH" in \
      amd64) PNPM_ARCH=x64; PNPM_SHA256=2ce798ca1565730137fb9b1871b17297e195a06383de69f3d76041b64a4c4e72 ;; \
      arm64) PNPM_ARCH=arm64; PNPM_SHA256=1bb5df66cef8ec77089167e52111ce4515ea36c465ca3068e1ac96fe0338bcc1 ;; \
      *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac \
    && wget -qO /tmp/pnpm.tar.gz "https://github.com/pnpm/pnpm/releases/download/v12.16.1/pnpm-linux-${PNPM_ARCH}-musl.tar.gz" \
    && echo "${PNPM_SHA256}  /tmp/pnpm.tar.gz" | sha256sum -c - \
    && mkdir -p /opt/pnpm \
    && tar -xzf /tmp/pnpm.tar.gz -C /opt/pnpm \
    && ln -s /opt/pnpm/pnpm /usr/local/bin/pnpm \
    && rm /tmp/pnpm.tar.gz
ENV HUSKY=0
WORKDIR /app

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm run build

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:26.13.0-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
    CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health/live" >/dev/null || exit 1
CMD ["node", "dist/main"]
