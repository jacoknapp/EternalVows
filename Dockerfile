# Dynamic target: Node + Express serving /config and dynamic /api/photos
FROM node:lts

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
