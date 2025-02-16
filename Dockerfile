FROM oven/bun:1.0.25

WORKDIR /app

COPY package*.json ./

# Install system dependencies for canvas
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

RUN bun install --legacy-peer-deps

COPY . .

EXPOSE 3000

CMD ["bun", "start"] 