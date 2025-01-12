# DLSU Gate System Backend

Backend service for DLSU Gate System with load balancing and high availability setup.

## Tech Stack

- NestJS with TypeScript
- PostgreSQL Database
- Redis Cache
- Nginx Load Balancer
- Docker Containerization

## Prerequisites

- Docker Desktop
- Git
- Bun (for development)

## Quick Start

1. **Clone and Setup**

```bash
git clone [repository-url]
cd dlsu-gate-system-backend
```

2. **Environment Setup**
   Create `.env` file in project root:

```env
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=dlsu_gate_system
```

3. **Start Application**

```bash
# Using startup script (Windows)
start-docker-app.bat

# Using Docker Compose (Mac/Linux)
docker compose up --build -d
```

## Access Points

- Main Application: `http://localhost`
- API Documentation: `http://localhost/api`
- Health Check: `http://localhost/health`
- Database (External): `localhost:5433`
- Redis Cache: `localhost:6379`

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test
```

## Production Architecture

- **Load Balancing**:

  - Nginx reverse proxy
  - Multiple application instances
  - Least connection distribution

- **Performance**:

  - Compression enabled
  - Rate limiting (100 requests/15min)
  - Static file caching
  - Connection pooling

- **Monitoring**:

```bash
# View logs
docker compose logs -f

# Check container status
docker compose ps

# Health check endpoint
curl http://localhost/health
```

## Container Resource Limits

Each application instance is configured with:

- CPU: max 0.5 cores (reserved 0.25)
- Memory: max 512MB (reserved 256MB)

## Original NestJS Documentation

For NestJS-specific documentation, please refer to [NESTJS.md](NESTJS.md)

## License

[Your License]

## Docker Deployment Setup

Backend service for DLSU Gate System with load balancing and high availability setup.

### Tech Stack

- NestJS with TypeScript
- PostgreSQL Database
- Redis Cache
- Nginx Load Balancer
- Docker Containerization

### Prerequisites

- Docker Desktop
- Git
- Bun (for development)

### Quick Start

1. **Clone and Setup**

```bash
git clone git@github.com:OwlRepo/dlsu-gate-system-backend.git
cd dlsu-gate-system-backend
```

2. **Environment Setup**
   Create `.env` file in project root:

```env
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=dlsu_gate_system
```

3. **Start Application**

```bash
# Using startup script (Windows)
start-docker-app.bat

# Using Docker Compose (Mac/Linux)
docker compose up --build -d
```

### Access Points

- Main Application: `http://localhost`
- API Documentation: `http://localhost/api`
- Health Check: `http://localhost/health`
- Database (External): `localhost:5433`
- Redis Cache: `localhost:6379`

### Production Architecture

- **Load Balancing**:

  - Nginx reverse proxy
  - Multiple application instances
  - Least connection distribution

- **Performance**:

  - Compression enabled
  - Rate limiting (100 requests/15min)
  - Static file caching
  - Connection pooling

- **Monitoring**:

```bash
# View logs
docker compose logs -f

# Check container status
docker compose ps

# Health check endpoint
curl http://localhost/health
```

### Container Resource Limits

Each application instance is configured with:

- CPU: max 0.5 cores (reserved 0.25)
- Memory: max 512MB (reserved 256MB)
