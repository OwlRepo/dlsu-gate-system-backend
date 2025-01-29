# DLSU Gate System Backend

Backend service for DLSU Gate System with load balancing and high availability setup.

## Table of Contents

- [DLSU Gate System Backend](#dlsu-gate-system-backend)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Quick Start](#quick-start)
    - [Windows Users](#windows-users)
    - [macOS and Linux Users](#macos-and-linux-users)
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
```

3. **Launch the Application**

Choose your platform:

### Windows Users

```bash
start-docker-app.bat
```

### macOS and Linux Users

```bash
# Make script executable (one-time setup)
chmod +x start-docker-app.sh

# Run the application
./start-docker-app.sh
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
- 📚 API Documentation: `http://localhost/api`
- 💓 Health Check: `http://localhost/health`
- 🗄️ Database (External): `localhost:5433`
- 📦 Redis Cache: `localhost:6379`
- 🔧 Jenkins: `http://localhost/jenkins`

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

- Nginx reverse proxy
- Multiple application instances
- Least connection distribution

**Performance Optimizations**

- Compression enabled
- Rate limiting (1000 requests/15min)
- Static file caching
- Connection pooling

**Resource Management**
Each instance is allocated:

- CPU: max 0.5 cores (reserved 0.25)
- Memory: max 512MB (reserved 256MB)

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

- `nginx.conf` - Load balancer and proxy settings
- `docker-compose.yml` - Service architecture definition

## Additional Documentation

For NestJS-specific details, see [NESTJS.md](NESTJS.md)

## License

[Your License]
