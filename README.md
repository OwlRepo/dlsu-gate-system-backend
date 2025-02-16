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
  - [Redis Implementation](#redis-implementation)
    - [Redis Usage Overview](#redis-usage-overview)
    - [Redis Configuration](#redis-configuration)
    - [Cache Management](#cache-management)
    - [Monitoring Redis](#monitoring-redis)
    - [Best Practices](#best-practices)
  - [Technology Stack Overview](#technology-stack-overview)
    - [NestJS Implementation](#nestjs-implementation)
    - [PostgreSQL Implementation](#postgresql-implementation)
    - [Redis Implementation](#redis-implementation)
    - [Nginx Implementation](#nginx-implementation)
    - [Docker Implementation](#docker-implementation)
    - [TypeScript Implementation](#typescript-implementation)
    - [Testing Framework](#testing-framework)
    - [Monitoring and Logging](#monitoring-and-logging)
    - [Security Implementation](#security-implementation)

## Prerequisites

Before you begin, ensure you have:

- Docker Desktop
- Git
- Bun (for development)

Note: When running this project with Docker, you don't need to install PostgreSQL or Redis locally. All dependencies are containerized.

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

> Note: For a complete set of environment variables needed for production deployment, please reach out to the repository maintainers.

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

## Redis Implementation

### Redis Usage Overview

Redis serves several critical functions in the DLSU Gate System:

**1. Session Management**

- Stores user session data
- Enables session sharing across multiple API instances
- Configurable TTL (Time To Live) for sessions
- Handles user logout by invalidating sessions

**2. Rate Limiting**

- Tracks API request counts across distributed instances
- Implements sliding window rate limiting
- Stores rate limit counters with automatic expiration
- Ensures consistent rate limiting across all API instances

**3. Caching Layer**

- Caches frequently accessed data:
  - User profiles
  - Authentication tokens
  - Common API responses
- Reduces database load
- Improves response times
- Uses LRU (Least Recently Used) eviction policy

**4. Real-time Data Synchronization**

- Facilitates real-time updates across API instances
- Manages distributed locks for synchronized operations
- Enables pub/sub messaging between services

### Redis Configuration

**Container Settings**

```yaml
Maximum Memory: 768MB
Eviction Policy: allkeys-lru
Port: 6389 (external), 6379 (internal)
Resource Limits:
  - CPU: 1.00 (max), 0.50 (reserved)
  - Memory: 1024MB (max), 512MB (reserved)
```

**Connection Settings**

```env
REDIS_HOST=redis
REDIS_PORT=6379
```

### Cache Management

**TTL (Time To Live) Settings**

- Session data: 24 hours
- Rate limit counters: 15 minutes
- API response cache: 5 minutes
- User profile cache: 1 hour

**Cache Categories**

1. **Short-lived Cache (1-5 minutes)**

   - API responses
   - Validation results
   - Temporary tokens

2. **Medium-lived Cache (1-24 hours)**

   - User sessions
   - Authentication tokens
   - User profiles

3. **Persistent Cache (until evicted)**
   - System configurations
   - Common reference data

### Monitoring Redis

**View Redis Statistics**

```bash
# Connect to Redis CLI
docker exec -it dlsu-portal-be-redis-1 redis-cli

# Monitor real-time commands
redis-cli MONITOR

# Check memory usage
redis-cli INFO memory

# View cache statistics
redis-cli INFO stats
```

**Key Performance Metrics**

- Memory usage
- Hit/miss ratio
- Connected clients
- Operations per second
- Eviction count

### Best Practices

1. **Data Storage**

   - Use appropriate data structures
   - Implement proper key naming conventions
   - Set reasonable TTL values

2. **Memory Management**

   - Monitor memory usage
   - Adjust maxmemory based on usage patterns
   - Review eviction policies

3. **Error Handling**
   - Implement fallback mechanisms
   - Handle Redis connection failures
   - Log cache-related errors

## Technology Stack Overview

### NestJS Implementation

**Core Features**

- Built with TypeScript for type safety and better developer experience
- RESTful API architecture with OpenAPI/Swagger documentation
- JWT-based authentication and role-based authorization
- Request validation and DTO transformations
- Global exception handling and custom error responses

**Key Components**

- Controllers: Handle HTTP requests and route management
- Services: Implement business logic and data operations
- Guards: Protect routes with authentication and authorization
- Interceptors: Transform request/response data
- Pipes: Validate and transform input data

### PostgreSQL Implementation

**Database Structure**

- Relational database design with referential integrity
- Optimized indexes for frequent queries
- Partitioned tables for large datasets
- Connection pooling for efficient resource usage

**Key Features**

- Complex queries with JOIN operations
- Transaction management
- Concurrent access handling
- Full-text search capabilities
- Database migrations and versioning

### Redis Implementation

**Container Settings**

```yaml
Maximum Memory: 768MB
Eviction Policy: allkeys-lru
Port: 6389 (external), 6379 (internal)
Resource Limits:
  - CPU: 1.00 (max), 0.50 (reserved)
  - Memory: 1024MB (max), 512MB (reserved)
```

**Connection Settings**

```env
REDIS_HOST=redis
REDIS_PORT=6379
```

**TTL (Time To Live) Settings**

- Session data: 24 hours
- Rate limit counters: 15 minutes
- API response cache: 5 minutes
- User profile cache: 1 hour

**Cache Categories**

1. **Short-lived Cache (1-5 minutes)**

   - API responses
   - Validation results
   - Temporary tokens

2. **Medium-lived Cache (1-24 hours)**

   - User sessions
   - Authentication tokens
   - User profiles

3. **Persistent Cache (until evicted)**
   - System configurations
   - Common reference data

### Nginx Implementation

**Load Balancing**

- Round-robin distribution across 5 API instances
- Health checks for backend services
- Session persistence configuration
- SSL/TLS termination

**Performance Optimizations**

- Gzip compression for responses
- Static file caching
- Buffer size optimizations
- Keep-alive connection management
- HTTP/2 support

**Security Features**

- Rate limiting configuration
- DDoS protection
- Header security policies
- Cross-origin resource sharing (CORS)

### Docker Implementation

**Container Architecture**

- Multi-container deployment with docker-compose
- Layered image building for optimal caching
- Volume management for persistent data
- Network isolation between services

**Resource Management**

- CPU and memory limits per container
- Restart policies
- Health checks
- Log rotation

**Development Features**

- Hot-reload configuration
- Development vs production environments
- Multi-stage builds
- Docker layer caching

### TypeScript Implementation

**Language Features**

- Strong typing system
- Interface definitions
- Decorators for metadata
- Advanced type utilities

**Project Structure**

- Modular architecture
- Shared types and interfaces
- Utility functions
- Type guards and assertions

**Development Tools**

- ESLint configuration
- Prettier code formatting
- TypeScript compiler options
- Path aliases

### Testing Framework

**Unit Testing**

- Jest test runner
- Mocking utilities
- Test coverage reporting
- Snapshot testing

**Integration Testing**

- Supertest for HTTP testing
- Database testing utilities
- Redis integration tests
- Mock services

**E2E Testing**

- Full API endpoint testing
- Authentication flow testing
- Error handling scenarios
- Performance benchmarks

### Monitoring and Logging

**Application Monitoring**

- Health check endpoints
- Performance metrics
- Error tracking
- Resource usage statistics

**Logging System**

- Structured JSON logging
- Log levels and categories
- Request/response logging
- Error and exception logging

**Metrics Collection**

- Response time tracking
- Database query performance
- Cache hit/miss ratios
- API usage statistics

### Security Implementation

**Authentication**

- JWT token management
- Refresh token rotation
- Session handling
- Password hashing

**Authorization**

- Role-based access control
- Permission management
- API key authentication
- IP whitelisting

**Data Protection**

- Input validation
- SQL injection prevention
- XSS protection
- CSRF tokens

**Network Security**

- SSL/TLS configuration
- Secure headers
- Rate limiting
- DDoS protection
