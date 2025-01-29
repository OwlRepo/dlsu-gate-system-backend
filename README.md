# DLSU Gate System Backend

Backend service for DLSU Gate System with load balancing and high availability setup.

## Prerequisites

- Docker Desktop
- Git
- Bun (for development)

Note: When running this project with Docker, you don't need to install PostgreSQL, Redis, or Jenkins locally. All dependencies are containerized.

## Quick Start

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

### Using Startup Scripts

#### Windows

```bash
start-docker-app.bat
```

#### macOS and Linux

```bash
# First make the script executable (one-time setup)
chmod +x start-docker-app.sh

# Then run the script
./start-docker-app.sh
```

The startup scripts provide intelligent container management:

- Ensure only one instance is running at a time
- Check if containers are already running
- Start existing containers if they're stopped
- Only build new containers if none exist
- Display container logs automatically

Note: If you try to run the script while it's already running, you'll receive a notification.

## Container Management

### Clean Build Process

To perform a clean build while preserving uploaded files and data:

```bash
# Stop all containers
docker-compose down

# Clear Docker build cache
docker builder prune -f

# Rebuild and start everything
docker-compose up --build --force-recreate
```

**Important Note About Data Persistence:**

- The system uses named volumes to ensure data persistence across rebuilds
- Images and files stored in `persistent_uploads` volume will be preserved
- Do NOT use `docker-compose down -v` as it will remove all volumes including stored images

### Manual Container Management

```bash
# Start with logs
docker compose up --build -d
docker compose logs -f

# Check container status
docker compose ps

# Start existing containers
docker compose start

# Stop containers (preserves data)
docker compose stop
```

## Access Points

- Main Application: `http://localhost`
- API Documentation: `http://localhost/api`
- Health Check: `http://localhost/health`
- Database (External): `localhost:5433`
- Redis Cache: `localhost:6379`
- Jenkins: `http://localhost/jenkins`

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

### Tech Stack

- NestJS with TypeScript
- PostgreSQL Database
- Redis Cache
- Nginx Load Balancer
- Docker Containerization

### Load Balancing

- Nginx reverse proxy
- Multiple application instances
- Least connection distribution

### Performance

- Compression enabled
- Rate limiting (1000 requests/15min)
- Static file caching
- Connection pooling

### Container Resource Limits

Each application instance is configured with:

- CPU: max 0.5 cores (reserved 0.25)
- Memory: max 512MB (reserved 256MB)

### Monitoring

```bash
# View logs
docker compose logs -f

# Check container status
docker compose ps

# Health check endpoint
curl http://localhost/health
```

### Configuration Files

- Nginx configuration: `nginx.conf` - configures reverse proxy and load balancer
- Docker configuration: `docker-compose.yml` - defines service architecture

## Additional Documentation

For NestJS-specific documentation, please refer to [NESTJS.md](NESTJS.md)

## License

[Your License]
