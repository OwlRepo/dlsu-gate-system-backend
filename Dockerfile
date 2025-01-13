FROM oven/bun:1

WORKDIR /app

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies
RUN bun install

# Copy the rest of the application
COPY . .

# Build the application
RUN bun run build

# Expose the port your app runs on
EXPOSE 3000

# Add this before the CMD line
VOLUME ["/app/persistent_uploads"]

# Start the application
CMD ["bun", "run", "start:prod"]

# Add this near the end of your Dockerfile
RUN mkdir -p /app/persistent_uploads && chmod 777 /app/persistent_uploads 