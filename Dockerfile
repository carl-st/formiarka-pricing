# Base image with Node.js and OrcaSlicer dependencies
FROM node:18-slim

# Install OrcaSlicer dependencies and extraction tools
RUN apt-get update && apt-get install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    unzip \
    libarchive-tools \
    libfuse2 \
    && rm -rf /var/lib/apt/lists/*

# Download and extract OrcaSlicer AppImage
RUN curl -L -o /tmp/orcaslicer.AppImage https://github.com/SoftFever/OrcaSlicer/releases/download/v1.9.1/OrcaSlicer_Linux_V1.9.1.AppImage && \
    chmod +x /tmp/orcaslicer.AppImage && \
    cd /opt && \
    /tmp/orcaslicer.AppImage --appimage-extract && \
    mv squashfs-root orcaslicer && \
    rm /tmp/orcaslicer.AppImage

# Create symlink for the console executable
RUN ln -s /opt/orcaslicer/AppRun /usr/local/bin/orca-slicer


WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Create necessary directories
RUN mkdir -p uploads gcodes

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
