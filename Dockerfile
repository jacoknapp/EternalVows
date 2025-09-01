FROM node:lts-alpine


WORKDIR /app

# Install dependencies using existing package files (production only)
COPY package*.json ./
ENV NODE_ENV=production \
	npm_config_loglevel=warn \
	npm_config_update_notifier=false \
	SHARP_IGNORE_GLOBAL_LIBVIPS=1 \
	SHARP_IGNORE_NATIVE=false

# Install production deps only; skip optional (native) deps to avoid cross-arch hangs
RUN set -eux; \
	npm ci --omit=dev --omit=optional --no-audit --no-fund || npm i --omit=dev --omit=optional --no-audit --no-fund; \
	npm cache clean --force

# Copy application files
COPY server.mjs ./
COPY index.html ./
COPY config ./config
COPY favicon ./favicon

ENV PORT=5500
EXPOSE 5500

# Ensure all files are readable/executable by arbitrary users (compose may set user)
RUN chmod -R a+rX /app

CMD ["node", "server.mjs"]
