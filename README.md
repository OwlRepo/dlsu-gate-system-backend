# DLSU Gate System Backend

Backend service for DLSU Gate System with load balancing and high availability setup.

## Table of Contents

- [DLSU Gate System Backend](#dlsu-gate-system-backend)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
  - [Development](#development)
  - [Sync Logs and Records](#sync-logs-and-records)
    - [Log Directory Structure](#log-directory-structure)
    - [Accessing Sync Logs](#accessing-sync-logs)
    - [Log File Contents](#log-file-contents)
    - [Log Retention Policy](#log-retention-policy)
    - [Accessing Logs in Docker](#accessing-logs-in-docker)
    - [Accessing Logs through Docker Desktop](#accessing-logs-through-docker-desktop)
      - [Windows/Mac GUI Method](#windowsmac-gui-method)
      - [Quick Tips](#quick-tips)
  - [Access Points](#access-points)
  - [Container Management](#container-management)
    - [Clean Build Process](#clean-build-process)
    - [Manual Container Operations](#manual-container-operations)
  - [Production Architecture](#production-architecture)
    - [Tech Stack](#tech-stack)
    - [System Features](#system-features)
    - [Monitoring](#monitoring)
    - [Configuration Files](#configuration-files)
  - [Additional Documentation](#additional-documentation)
  - [License](#license)

## Prerequisites

Before you begin, ensure you have:

- Docker Desktop
- Git
- Bun (for development)

Note: When running this project with Docker, you don't need to install PostgreSQL, Redis, or Jenkins locally. All dependencies are containerized.

## Quick Start

1. **Clone the Repository**

```bash
git clone git@github.com:OwlRepo/dlsu-gate-system-backend.git
cd dlsu-gate-system-backend
```

2. **Set Up Environment**
   Create `.env` file in project root:

```env
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=dlsu_gate_system
PGADMIN_EMAIL=admin@admin.com
PGADMIN_PASSWORD=admin
```

3. **Launch Services**

```bash
docker-compose up -d
```

The startup scripts automatically:

- Ensure single instance running
- Manage container lifecycle
- Display logs
- Handle container dependencies

## Development

Local development setup:

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test
```

## Sync Logs and Records

When database synchronization runs (either manual or scheduled), the system generates detailed logs in the following locations:

### Log Directory Structure

```
logs/
├── skipped-records/          # Records that failed validation
│   └── skipped_YYYY-MM-DD.json
├── synced-records/
│   ├── csv/                 # Successful syncs in CSV format
│   │   └── synced_TYPE_YYYY_MM_DD.csv
│   └── json/               # Successful syncs in JSON format
│       └── synced_TYPE_YYYY_MM_DD.json
```

### Accessing Sync Logs

1. **Skipped Records**

   - Location: `logs/skipped-records/`
   - Format: JSON
   - Contains: Records that failed validation with reasons
   - Example filename: `skipped_2025-02-16.json`

2. **Successful Syncs**
   - CSV Format: `logs/synced-records/csv/`
   - JSON Format: `logs/synced-records/json/`
   - Contains: Successfully synced records with timestamps
   - Example filenames:
     - `synced_manual_2025_02_16.csv`
     - `synced_sync1_2025_02_16.json`

### Log File Contents

1. **Skipped Records JSON**

```json
[
  {
    "ID_Number": "12345678",
    "userId": "12345678",
    "name": "John Doe",
    "livedName": "John",
    "remarks": "Some remarks",
    "reasons": ["ID too long", "Name exceeds 48 characters"],
    "timestamp": "2025-02-16T08:00:00.000Z"
  }
]
```

2. **Synced Records CSV/JSON**

```json
{
  "user_id": "12345678",
  "name": "John Doe",
  "lived_name": "John",
  "remarks": "Active",
  "campus_entry": "Y",
  "expiry_datetime": "20250216 23:59:59.999",
  "sync_timestamp": "2025-02-16T08:00:00.000Z"
}
```

### Log Retention Policy

- Logs are automatically cleaned up after 1 month
- New logs are created for each sync operation
- Logs are organized by date for easy tracking

### Accessing Logs in Docker

If running in Docker, you can access logs using:

```bash
# Copy logs from container to host
docker cp dlsu-portal-be-dlsu-gate-system-api-5-1:/app/logs ./local_logs

# View logs in real-time
docker exec dlsu-portal-be-dlsu-gate-system-api-5-1 tail -f /app/logs/synced-records/json/synced_manual_2025_02_16.json
```

### Accessing Logs through Docker Desktop

#### Windows/Mac GUI Method

1. **Open Docker Desktop**

   - Launch Docker Desktop application
   - Ensure the DLSU Gate System containers are running

2. **Access Container Files**

   - Click on "Containers" in the left sidebar
   - Find `dlsu-portal-be-dlsu-gate-system-api-5-1` container
   - Click on the container name to open details

3. **Navigate to Logs Directory**

   - Click on the "Files" tab
   - Navigate to `/app/logs/`
   - You'll see three main directories:
     - `skipped-records/`
     - `synced-records/csv/`
     - `synced-records/json/`

4. **View or Download Logs**
   - Click on any log file to view its contents directly
   - Use the download icon (↓) to save the file locally
   - Use the copy icon to copy file contents to clipboard

#### Quick Tips

- **Real-time Logs**: Use the "Logs" tab in Docker Desktop to view real-time sync operations
- **Search**: Use Docker Desktop's search function to find specific log files by date
- **Refresh**: Click the refresh icon to see newly generated logs
- **Bulk Download**: Right-click on a folder to download all logs at once

> Note: The exact appearance may vary slightly depending on your Docker Desktop version.

## Access Points

Once running, access the system at:

- 🌐 Main Application: `http://localhost`
- 📚 API Documentation: `http://localhost:9580/api/docs/`
- 💓 Health Check: `http://localhost/health`
- 🗄️ Database (External): `localhost:5438`
- 📦 Redis Cache: `localhost:6389`
- 🔧 PgAdmin: `http://localhost:9580/pgadmin`

## Container Management

### Clean Build Process

For a fresh build while preserving data:

```bash
# Stop all containers
docker-compose down

# Clear Docker build cache
docker builder prune -f

# Rebuild and start everything
docker-compose up --build --force-recreate
```

⚠️ **Important: Data Persistence**

- All data is stored in named Docker volumes
- `persistent_uploads` volume preserves uploaded files
- Never use `docker-compose down -v` unless you want to delete all data

### Manual Container Operations

```bash
# Start with logs
docker compose up --build -d
docker compose logs -f

# Container management
docker compose ps      # Check status
docker compose start   # Start containers
docker compose stop    # Stop containers (preserves data)
```

## Production Architecture

### Tech Stack

- 🔧 NestJS with TypeScript
- 🗄️ PostgreSQL Database
- 📦 Redis Cache
- 🔄 Nginx Load Balancer
- 🐳 Docker Containerization

### System Features

**Load Balancing**

- Nginx reverse proxy with enhanced worker connections (4096)
- 5 load-balanced application instances
- Least connection distribution strategy
- Keepalive connections: 128

**Rate Limiting**

- API endpoints: 100 requests/second with 200 burst
- Static files: 200 requests/second with 300 burst

**Port Configuration**

- API/Frontend: 9580 (nginx)
- PostgreSQL: 5438
- Redis: 6389
- Internal API instances: 3000

**PgAdmin Access**

- URL: `http://localhost:9580/pgadmin`
- Default email: `admin@admin.com`
- Default password: `admin`

**Performance Optimizations**

- Advanced compression with gzip
- Intelligent rate limiting:
  - API endpoints: 100 requests/second with 200 burst
  - Static files: 200 requests/second with 300 burst
- Static file caching with optimized settings
- Connection pooling
- TCP optimizations (tcp_nopush, tcp_nodelay)
- File descriptor caching
- Enhanced buffer sizes

**Resource Management**

Each API instance is allocated:

- CPU: max 2.0 cores (reserved 1.0)
- Memory: max 2048MB (reserved 1024MB)

Database (PostgreSQL) resources:

- CPU: max 4.0 cores (reserved 2.0)
- Memory: max 4096MB (reserved 2048MB)
- Max connections: 500
- Shared buffers: 1GB
- Effective cache size: 3GB
- Work memory: 16MB

Redis Cache:

- CPU: max 1.0 cores (reserved 0.5)
- Memory: max 1024MB (reserved 512MB)
- Max memory: 768MB with LRU eviction

Nginx Load Balancer:

- CPU: max 2.0 cores (reserved 1.0)
- Memory: max 2048MB (reserved 1024MB)

**Timeout Configurations**

- Client body timeout: 60s
- Client header timeout: 60s
- Keepalive timeout: 120s
- Send timeout: 60s
- Proxy timeouts: 120s (connect, send, read)

### Monitoring

```bash
# View logs
docker compose logs -f

# Check status
docker compose ps

# Health check
curl http://localhost/health
```

### Configuration Files

- `nginx.conf` - Load balancer and proxy settings with optimized performance configurations
- `docker-compose.yml` - Service architecture definition with resource limits

## Additional Documentation

For NestJS-specific details, see [NESTJS.md](NESTJS.md)

## License

[Your License]
