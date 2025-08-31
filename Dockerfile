# Dynamic target: Node + Express serving /config and dynamic /api/photos
# Use a multi-arch base that includes linux/arm64. Alpine variants occasionally
# miss a platform in the manifest. bookworm-slim is reliably multi-arch.
ARG BASE_IMAGE=node:24-bookworm-slim
ARG TARGETPLATFORM
FROM --platform=$TARGETPLATFORM ${BASE_IMAGE}

WORKDIR /app

# Install dependencies using existing package files (production only)
COPY package*.json ./
# Prefer npm ci with omit=dev; fall back to npm i on older npm
RUN npm ci --omit=dev --no-audit --no-fund || npm i --omit=dev --no-audit --no-fund

# Copy application files
COPY server.mjs ./
COPY index.html ./
COPY config ./config
COPY favicon ./favicon

ENV NODE_ENV=production
ENV PORT=5500
EXPOSE 5500

# Ensure all files are readable/executable by arbitrary users (compose may set user)
RUN chmod -R a+rX /app

CMD ["node", "server.mjs"]
