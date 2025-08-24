# Stage 1: build
FROM node:20-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Stage 2: runtime with PrusaSlicer
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libglu1-mesa libglib2.0-0 libsm6 libxrender1 libxext6 libx11-6 libxkbcommon0 \
    && rm -rf /var/lib/apt/lists/*

# Install PrusaSlicer via AppImage (headless)
# Update version as needed
ENV PRUSASLICER_VERSION=2.7.4
ENV PRUSASLICER_GITHUB_VERSION="2.7.4+linux-x64-GTK3-202404050928"
WORKDIR /opt
# https://github.com/prusa3d/PrusaSlicer/releases/download/version_2.7.4/PrusaSlicer-2.7.4+linux-x64-GTK3-202404050928.AppImage
RUN curl -L -o PrusaSlicer.AppImage https://github.com/prusa3d/PrusaSlicer/releases/download/version_${PRUSASLICER_VERSION}/PrusaSlicer-${PRUSASLICER_GITHUB_VERSION}.AppImage \
    && chmod +x PrusaSlicer.AppImage \
    && ./PrusaSlicer.AppImage --appimage-extract \
    && ln -s /opt/squashfs-root/usr/bin/prusa-slicer /usr/local/bin/prusa-slicer

# App setup
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Temp directory for uploads and slices
RUN mkdir -p /tmp && chmod 1777 /tmp

# Healthcheck (optional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:'+ (process.env.PORT||3000) +'/pricing/health',()=>process.exit(0)).on('error',()=>process.exit(1))" || exit 1

EXPOSE 3000
CMD ["node", "dist/main.js"]
