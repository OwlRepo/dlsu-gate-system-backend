FROM oven/bun:1

WORKDIR /app

# Install prerequisites first
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    netcat-openbsd \
    unixodbc \
    unixodbc-dev \
    python3 \
    python3-pip \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install SQL Server ODBC driver
RUN curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
    && curl https://packages.microsoft.com/config/debian/11/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 \
    && ACCEPT_EULA=Y apt-get install -y mssql-tools18

# Copy package files
COPY package.json .
COPY bun.lockb .

# Install dependencies - using only mssql package
RUN bun install
RUN bun add mssql

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