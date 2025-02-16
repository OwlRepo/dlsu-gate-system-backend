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
    - [Redis Usage Overview](#redis-usage-overview)
    - [PostgreSQL Implementation](#postgresql-implementation)
    - [PostgreSQL Usage Overview](#postgresql-usage-overview)
    - [PostgreSQL Configuration](#postgresql-configuration)
    - [Database Management](#database-management)
    - [Nginx Implementation](#nginx-implementation)
    - [Nginx Usage Overview](#nginx-usage-overview)
    - [Nginx Configuration](#nginx-configuration)
    - [Performance Tuning](#performance-tuning)
    - [Docker Implementation](#docker-implementation)
    - [Docker Usage Overview](#docker-usage-overview)
    - [Docker Configuration](#docker-configuration)
    - [Container Management](#container-management-1)

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

### PostgreSQL Implementation

### PostgreSQL Usage Overview

PostgreSQL serves as the primary database in the DLSU Gate System:

**1. Data Storage and Management**

- Stores user profiles and authentication data
- Manages gate access logs and records
- Handles system configurations and settings
- Maintains audit trails and activity logs

**2. Transaction Management**

- Ensures ACID compliance for critical operations
- Handles concurrent access and updates
- Manages data integrity constraints
- Provides rollback capabilities

**3. Performance Optimization**

- Implements connection pooling
- Uses prepared statements
- Maintains optimized indexes
- Handles query caching

**4. High Availability**

- Supports database replication
- Implements backup and recovery
- Manages failover scenarios
- Handles data consistency across nodes

### PostgreSQL Configuration

**Container Settings**

```yaml
Maximum Connections: 500
Shared Buffers: 1GB
Effective Cache Size: 3GB
Work Memory: 16MB
Port: 5438 (external), 5432 (internal)
Resource Limits:
  - CPU: 4.00 (max), 2.00 (reserved)
  - Memory: 4096MB (max), 2048MB (reserved)
```

**Connection Settings**

```env
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-dlsu_gate_system}
```

### Database Management

**Backup Schedules**

- Full backup: Daily at midnight
- Incremental backup: Every 6 hours
- Transaction logs: Continuous archiving
- Retention period: 30 days

**Maintenance Operations**

1. **Regular Maintenance**

   - VACUUM operations
   - Index rebuilding
   - Statistics updates
   - Dead tuple cleanup

2. **Performance Monitoring**

   - Query performance analysis
   - Index usage statistics
   - Table bloat monitoring
   - Connection pool status

3. **Data Archival**
   - Historical data management
   - Data partitioning
   - Archive storage
   - Retrieval procedures

### Nginx Implementation

### Nginx Usage Overview

Nginx serves as the load balancer and reverse proxy:

**1. Load Distribution**

- Manages traffic across 5 API instances
- Implements health checking
- Handles failover scenarios
- Maintains session persistence

**2. Request Processing**

- Handles SSL/TLS termination
- Manages static file serving
- Implements request compression
- Processes HTTP/2 connections

**3. Security Management**

- Implements rate limiting
- Manages access control
- Handles DDoS protection
- Controls request validation

**4. Performance Optimization**

- Manages connection pooling
- Implements caching strategies
- Handles request buffering
- Optimizes static content delivery

### Nginx Configuration

**Server Settings**

```nginx
Worker Processes: auto
Worker Connections: 4096
Keepalive: 128
Port: 9580
Resource Limits:
  - CPU: 2.00 (max), 1.00 (reserved)
  - Memory: 2048MB (max), 1024MB (reserved)
```

**Timeout Settings**

```nginx
client_body_timeout: 60s
client_header_timeout: 60s
keepalive_timeout: 120s
send_timeout: 60s
proxy_timeouts: 120s
```

### Performance Tuning

**Buffer Settings**

- Client body buffer: 128k
- Client header buffer: 1k
- Large client header buffers: 4 8k
- Output buffers: 4 32k

**Optimization Categories**

1. **Connection Optimization**

   - Keep-alive settings
   - Worker process tuning
   - Connection queue management
   - Backlog configuration

2. **Content Optimization**

   - Gzip compression
   - Static file caching
   - ETags configuration
   - Content encoding

3. **SSL Optimization**
   - Session caching
   - OCSP stapling
   - Cipher suite selection
   - SSL buffer size

### Docker Implementation

### Docker Usage Overview

Docker manages the containerized environment:

**1. Container Orchestration**

- Manages multi-container deployment
- Handles service dependencies
- Controls container lifecycle
- Manages resource allocation

**2. Resource Management**

- Implements CPU limiting
- Controls memory allocation
- Manages disk I/O
- Handles network resources

**3. Volume Management**

- Manages persistent storage
- Handles data backups
- Controls file permissions
- Implements volume sharing

**4. Network Configuration**

- Manages container networking
- Implements service discovery
- Handles port mapping
- Controls network isolation

### Docker Configuration

**Resource Allocation**

```yaml
API Services (each):
  CPU: 2.00 (max), 1.00 (reserved)
  Memory: 2048MB (max), 1024MB (reserved)
Database:
  CPU: 4.00 (max), 2.00 (reserved)
  Memory: 4096MB (max), 2048MB (reserved)
Redis:
  CPU: 1.00 (max), 0.50 (reserved)
  Memory: 1024MB (max), 512MB (reserved)
```

**Volume Configuration**

```yaml
Persistent Volumes:
  - postgres_data
  - persistent_uploads
  - screensaver_uploads
  - pgadmin_data
Network:
  - app-network (bridge)
```

### Container Management

**Deployment Strategies**

1. **Build Process**

   - Multi-stage builds
   - Layer optimization
   - Cache management
   - Image size reduction

2. **Runtime Management**

   - Health checking
   - Auto-restart policies
   - Log rotation
   - Resource monitoring

3. **Maintenance Operations**
   - Container updates
   - Image cleanup
   - Volume backups
   - Network maintenance
