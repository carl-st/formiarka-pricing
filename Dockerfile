# Stage 1: build
FROM node:20-slim AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY configs ./configs
COPY src ./src
RUN npm run build

# Stage 2: runtime with PrusaSlicer
FROM node:20-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libglu1-mesa libglib2.0-0 libsm6 libxrender1 libxext6 libx11-6 libxkbcommon0 \
    mesa-utils libegl1-mesa libgl1-mesa-glx libgl1-mesa-dri xvfb \
    libgtk-3-0 libgdk-pixbuf2.0-0 libcairo-gobject2 libpango-1.0-0 libatk1.0-0 \
    libcairo2 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libpango-1.0-0 \
    libharfbuzz0b libfontconfig1 libfreetype6 libx11-xcb1 libxcb1 libxcursor1 \
    libxi6 libxrandr2 libxss1 libxcomposite1 libxdamage1 libxfixes3 \
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

# Set environment variables for headless OpenGL
ENV LIBGL_ALWAYS_SOFTWARE=1
ENV GALLIUM_DRIVER=llvmpipe
ENV DISPLAY=:99

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

# Create a script to start Xvfb and the Node.js app
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1024x768x24 &\nexec "$@"' > /start.sh && chmod +x /start.sh

CMD ["/start.sh", "node", "dist/main.js"]
