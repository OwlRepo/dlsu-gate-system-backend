# DLSU Gate System Backend

A high-availability, load-balanced backend service for DLSU's campus access management system.

## Overview

Enterprise-grade backend service featuring:

- 5-node distributed API architecture
- Sub-second gate access validation
- Automated university system synchronization
- Multi-layer security with DDoS protection
- Horizontal scalability with zero-downtime deployment

## Branch Management

> **Important**: This repository follows strict branch management practices:
>
> - `main` - Production environment only. Protected branch for stable releases
> - `dev` - Development and testing environment
>
> Always create feature branches from `dev` and submit PRs to `dev` first. Changes are promoted to `main` only after thorough testing.

## Architecture

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

### Core Components

- **Nginx**: Load balancing, SSL termination, DDoS protection
- **API Nodes**: NestJS-powered business logic and request handling
- **Redis**: Session management, caching, rate limiting
- **PostgreSQL**: Transactional data storage, audit logs

## Quick Start

1. **Prerequisites**

   - Docker Desktop/Engine
   - Git
   - Bun

2. **Setup**

```bash
git clone git@github.com:OwlRepo/dlsu-gate-system-backend.git
cd dlsu-gate-system-backend

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Launch system
docker-compose up -d
```

3. **Access Points**

- API: `http://localhost:9580`
- Docs: `http://localhost:9580/api/docs`
- Health: `http://localhost:9580/health`
- PgAdmin: `http://localhost:9580/pgadmin`

## Development

```bash
# Install dependencies
bun install

# Development server
bun run dev

# Testing
bun test

# Linting
bun run lint
```

### Best Practices

- Follow TypeScript standards
- Maintain 80%+ test coverage
- Use feature branches
- Write conventional commits

## Monitoring

### Logs

```
logs/
├── application/  # App logs
├── access/       # Access logs
├── error/        # Error logs
└── sync/         # Sync logs
```

### Health Checks

```bash
curl http://localhost:9580/health
docker-compose ps
docker-compose logs -f
```

## Technology Stack

- **NestJS**: TypeScript-based API framework
- **PostgreSQL**: ACID-compliant database
- **Redis**: Distributed caching
- **Nginx**: Load balancing and security

## Deployment

### Production Requirements

- 4+ CPU cores
- 8GB+ RAM
- 50GB+ storage
- SSL certificate

### Deploy

```bash
# Pull latest changes
git pull origin main

# Build and deploy with zero downtime
docker-compose up -d

# Note: The system automatically deploys 5 API instances as defined in docker-compose.yml
```

### Maintenance

```bash
# Backup
docker exec postgres pg_dump -U postgres dlsu_gate_system > backup.sql

# Updates
docker-compose pull
docker-compose up -d
bun run migration:run
```

## License

Copyright © 2024 De La Salle University. All rights reserved.
Proprietary and confidential software.
