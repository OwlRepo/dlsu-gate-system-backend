# DLSU Gate System Backend

A high-availability, load-balanced backend service for the DLSU Gate System, designed to handle campus access management efficiently and reliably.

## Table of Contents

- [DLSU Gate System Backend](#dlsu-gate-system-backend)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
    - [Key Features](#key-features)
  - [Architecture](#architecture)
    - [System Components](#system-components)
    - [Component Roles](#component-roles)
  - [Prerequisites](#prerequisites)
  - [Getting Started](#getting-started)
    - [Access Points](#access-points)
  - [Development](#development)
    - [Local Setup](#local-setup)
    - [Development Best Practices](#development-best-practices)
  - [Monitoring \& Logging](#monitoring--logging)
    - [Log Management](#log-management)
    - [Monitoring Tools](#monitoring-tools)
  - [Technology Stack](#technology-stack)
    - [NestJS (API Framework)](#nestjs-api-framework)
    - [PostgreSQL (Database)](#postgresql-database)
    - [Redis (Caching)](#redis-caching)
    - [Nginx (Load Balancer)](#nginx-load-balancer)
  - [Deployment](#deployment)
    - [Production Deployment](#production-deployment)
    - [Maintenance](#maintenance)
  - [Contributing](#contributing)
  - [License](#license)

## Overview

The DLSU Gate System Backend is a robust service that manages campus access control through:

- Real-time gate access validation
- User authentication and authorization
- Distributed session management
- High-availability architecture
- Automated synchronization with university systems

### Key Features

- **Load Balanced Architecture**: 5 distributed API instances for high availability
- **Real-time Processing**: Sub-second response times for gate access validation
- **Fault Tolerance**: Automatic failover and recovery mechanisms
- **Scalable Design**: Horizontally scalable architecture
- **Secure Access**: Multi-layer security with rate limiting and DDoS protection

## Architecture

### System Components

```
┌─────────────────┐     ┌──────────────┐
│   Nginx (LB)    │────▶│ API Node 1   │
│   - SSL Term    │     └──────────────┘
│   - Rate Limit  │     ┌──────────────┐
│   - Load Bal    │────▶│ API Node 2   │
└────────┬────────┘     └──────────────┘
         │              ┌──────────────┐
         └─────────────▶│ API Node 3-5 │
                        └──────────────┘
         │                    │
    ┌────┼────────────┬───────┘
    │    │            │
┌─────────┐     ┌─────────┐
│ Redis   │     │ Postgres│
└─────────┘     └─────────┘
    │
    │
┌───────────────┐
│ File Storage  │
└───────────────┘
```

### Component Roles

1. **Nginx Load Balancer**

   - SSL/TLS termination
   - Request distribution across API nodes
   - Rate limiting and DDoS protection
   - Static file serving
   - Compression and caching

2. **API Nodes (NestJS)**

   - Business logic processing
   - Authentication/Authorization
   - Request validation
   - Data processing
   - Service orchestration

3. **Redis Cache**

   - Session management
   - Real-time data caching
   - Rate limit tracking
   - Distributed locking
   - Pub/sub messaging

4. **PostgreSQL Database**
   - User data storage
   - Access logs
   - System configurations
   - Audit trails
   - Transactional data

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git
- Bun (for local development)

## Getting Started

1. **Clone the Repository**

```bash
git clone git@github.com:OwlRepo/dlsu-gate-system-backend.git
cd dlsu-gate-system-backend
```

2. **Configure Environment**
   Create a `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-jwt-secret-key                    # Secret key for JWT tokens

# Environment Configuration
NODE_ENV=development                              # Application environment
PORT=51742                                        # Application port

# Database Configuration
DB_HOST=localhost                                 # Database host
DB_PORT=5432                                      # Database port
DB_USERNAME=postgres                              # Database username
DB_PASSWORD=your_secure_password                  # Database password
DB_NAME=dlsu_gate_system                         # Database name

# Source Database Configuration
SOURCE_DB_HOST=your_source_host                   # Source database host
SOURCE_DB_PORT=your_source_port                   # Source database port
SOURCE_DB_USERNAME=your_source_username           # Source database username
SOURCE_DB_PASSWORD=your_source_password           # Source database password
SOURCE_DB_NAME=your_source_db                     # Source database name

# BIOSTAR API Configuration
BIOSTAR_API_BASE_URL=your_biostar_url            # BIOSTAR API URL
BIOSTAR_API_LOGIN_ID=your_biostar_username       # BIOSTAR username
BIOSTAR_API_PASSWORD=your_biostar_password       # BIOSTAR password

# Application URLs
BASE_URL=http://localhost                         # Base application URL
RAILWAY_STATIC_URL=your_railway_url              # Railway deployment URL

# Docker Configuration
DOCKER_ENVIRONMENT=true                          # Docker environment flag
```

> **Important**: For the official production environment variables and credentials, please contact the repository maintainers. The above example is for development purposes only.

3. **Launch the System**

```bash
# Start all services
docker-compose up -d

# Verify deployment
docker-compose ps
```

### Access Points

- **Main API**: `http://localhost:9580`
- **API Documentation**: `http://localhost:9580/api/docs`
- **Health Check**: `http://localhost:9580/health`
- **PgAdmin**: `http://localhost:9580/pgadmin`
- **Database Port**: `5438`
- **Redis Port**: `6389`

## Development

### Local Setup

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Run tests
bun test

# Lint code
bun run lint
```

### Development Best Practices

1. **Code Style**

   - Follow TypeScript best practices
   - Use ESLint and Prettier
   - Maintain consistent naming conventions
   - Document code with JSDoc comments

2. **Testing**

   - Write unit tests for business logic
   - Include integration tests
   - Maintain 80%+ code coverage
   - Test error scenarios

3. **Git Workflow**
   - Use feature branches
   - Follow conventional commits
   - Include PR descriptions
   - Keep changes atomic

## Monitoring & Logging

### Log Management

Logs are stored in structured format:

```
logs/
├── application/          # Application logs
├── access/              # Access logs
├── error/              # Error logs
└── sync/               # Sync operation logs
```

### Monitoring Tools

1. **Health Checks**

```bash
# API health
curl http://localhost:9580/health

# Service status
docker-compose ps

# Container logs
docker-compose logs -f
```

2. **Performance Monitoring**
   - CPU/Memory usage
   - Response times
   - Error rates
   - Cache hit ratios

## Technology Stack

### NestJS (API Framework)

- TypeScript-based backend
- Modular architecture
- Dependency injection
- Built-in validation
- OpenAPI documentation

### PostgreSQL (Database)

- ACID compliance
- Complex queries
- Data integrity
- Backup/Recovery
- Connection pooling

### Redis (Caching)

- Session storage
- Data caching
- Rate limiting
- Real-time updates
- Pub/sub messaging

### Nginx (Load Balancer)

- Load distribution
- SSL termination
- Static file serving
- Request compression
- Security features

## Deployment

### Production Deployment

1. **System Requirements**

   - 4+ CPU cores
   - 8GB+ RAM
   - 50GB+ storage
   - Production SSL certificate

2. **Deployment Steps**

```bash
# Pull latest changes
git pull origin main

# Build containers
docker-compose build

# Deploy with zero downtime
docker-compose up -d --scale api=5
```

### Maintenance

1. **Backup Procedures**

```bash
# Database backup
docker exec postgres pg_dump -U postgres dlsu_gate_system > backup.sql

# Volume backup
docker run --rm -v dlsu_gate_system_data:/data -v /backup:/backup \
  alpine tar czf /backup/volumes_backup.tar.gz /data
```

2. **Updates and Patches**

```bash
# Update containers
docker-compose pull
docker-compose up -d

# Apply database migrations
bun run migration:run
```

## Contributing

This is a closed source project for DLSU internal use only. For any changes or improvements, please contact the system administrators or authorized maintainers.

## License

Copyright © 2024 De La Salle University
All rights reserved.

This software and its documentation are proprietary and confidential.
Unauthorized copying, distribution, or use of this software is strictly prohibited.
