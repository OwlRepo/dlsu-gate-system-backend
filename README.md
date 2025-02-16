# DLSU Gate System Backend

Backend service for DLSU Gate System with load balancing and high availability setup.

## Table of Contents

- [DLSU Gate System Backend](#dlsu-gate-system-backend)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
  - [Development](#development)
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
