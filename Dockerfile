# syntax=docker/dockerfile:1

# Stage 1: build NestJS app
FROM node:20-bookworm AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: runtime with prebuilt CuraEngine
# Using Debian to install a packaged cura-engine without compiling
FROM node:20-bookworm AS runtime
WORKDIR /app

# Install cura-engine package (provides /usr/bin/CuraEngine)
# Also install minimal runtime tools
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    cura-engine \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 10001 appuser
# Change ownership of /app to appuser
RUN chown -R appuser:appuser /app
USER appuser

# App files
COPY --chown=appuser:appuser --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --chown=appuser:appuser --from=build /app/dist ./dist
COPY --chown=appuser:appuser config ./config

# Working dirs for uploads and gcode
RUN mkdir -p /app/tmp/uploads /app/tmp/gcode

ENV NODE_ENV=production
# Ensure CuraEngine is on PATH
ENV PATH="/usr/bin:${PATH}"
ENV RATES_PATH=/app/config/rates.json
EXPOSE 3000
CMD ["node", "dist/main.js"]
