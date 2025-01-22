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

The application can be started using the provided scripts for different operating systems:

### Windows

```bash
start-docker-app.bat
```

### macOS and Linux

```bash
# First make the script executable (one-time setup)
chmod +x start-docker-app.sh

# Then run the script
./start-docker-app.sh
```

Both scripts provide intelligent container management:

- Ensure only one instance is running at a time
- Check if containers are already running
- Start existing containers if they're stopped
- Only build new containers if none exist
- Display container logs automatically

Note: If you try to run the script while it's already running, you'll receive a notification and the new instance will not start.

For manual container management:

```bash
docker compose up --build -d
docker compose logs -f
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

- **Load Balancing**:

  - Nginx reverse proxy
  - Multiple application instances
  - Least connection distribution

- **Performance**:

  - Compression enabled
  - Rate limiting (1000 requests/15min)
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

## Container Management

### Using start-docker-app.bat (Windows)

The startup script provides smart container management:

1. **Already Running Containers**

   - If containers are running, it will just show logs
   - No unnecessary rebuilds or restarts

2. **Stopped Containers**

   - If containers exist but are stopped, it will start them
   - Preserves existing data and configurations

3. **New Setup**
   - Only builds new containers if none exist
   - Performs full setup with `docker compose up --build`

### Manual Container Management

```bash
# Check container status
docker compose ps

# Start existing containers
docker compose start

# Stop containers (preserves data)
docker compose stop

# Remove containers and volumes (caution: deletes data)
docker compose down -v
```

## Container Resource Limits

Each application instance is configured with:

- CPU: max 0.5 cores (reserved 0.25)
- Memory: max 512MB (reserved 256MB)

## Original NestJS Documentation

For NestJS-specific documentation, please refer to [NESTJS.md](NESTJS.md)

## License

[Your License]

## Docker and Local Dependencies

When running this project with Docker, you don't need to install PostgreSQL, Redis, or Jenkins locally on your machine. Docker containers provide isolated environments that include all necessary dependencies:

- PostgreSQL runs in its own container with data persistence
- Redis cache is containerized and accessible to the application
- Jenkins CI/CD runs in its isolated container
- All inter-service communication is handled through Docker's internal networking

The only local requirements are those listed in the Prerequisites section:

- Docker Desktop
- Git
- Bun (for development)

This containerized approach ensures consistent environments across development, testing, and production.

## Nginx Configuration

The Nginx configuration is located in the `nginx.conf` file. It is used to configure the reverse proxy and load balancer for the application.
