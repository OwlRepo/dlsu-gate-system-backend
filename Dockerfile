FROM oven/bun:1

WORKDIR /app

# Install netcat for database connection checking
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

# Add persistent uploads directory
RUN mkdir -p /app/persistent_uploads && chmod 777 /app/persistent_uploads

# Copy the entrypoint script and force Linux line endings
COPY docker-entrypoint.sh .
RUN sed -i 's/\r$//' docker-entrypoint.sh && \
    chmod +x docker-entrypoint.sh

# Expose the port your app runs on
EXPOSE 3000

# Use the entrypoint script
ENTRYPOINT ["./docker-entrypoint.sh"] 