# Architecture Overview

This document provides an overview of the DLSU Gate System Backend architecture.

## System Architecture

### High-Level Architecture

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
```

### Technology Stack

- **Framework:** NestJS (TypeScript)
- **Database:** PostgreSQL with TypeORM
- **Cache:** Redis
- **Authentication:** JWT with Passport
- **API Documentation:** Swagger/OpenAPI
- **Process Management:** PM2
- **Load Balancer:** Nginx

## Module Structure

### Module Pattern

Each feature module follows this structure:

```
src/{module}/
├── {module}.module.ts      # Module definition
├── {module}.controller.ts # HTTP endpoints
├── {module}.service.ts    # Business logic
├── dto/                   # Data transfer objects
│   ├── create-{entity}.dto.ts
│   ├── update-{entity}.dto.ts
│   └── {entity}-pagination.dto.ts
└── entities/              # TypeORM entities
    └── {entity}.entity.ts
```

### Module Relationships

- **Auth Module:** Provides JWT authentication and guards
- **Employee Module:** Manages employee data and authentication
- **Admin Module:** Manages admin users
- **SuperAdmin Module:** Manages super admin users
- **Users Module:** Unified user management
- **Reports Module:** Access reports and logging
- **DatabaseSync Module:** Synchronizes with external systems
- **Health Module:** Health check endpoints

## Data Flow

### Request Flow

1. **Request** → Nginx (Load Balancer)
2. **Nginx** → API Node (Round-robin)
3. **API Node** → JwtAuthGuard (Authentication)
4. **JwtAuthGuard** → RolesGuard (Authorization, if needed)
5. **Controller** → Service (Business Logic)
6. **Service** → Repository (Database Access)
7. **Response** ← Cache (if cached)
8. **Response** ← Database (if not cached)

### Authentication Flow

1. User sends credentials to `/auth/login`
2. Service validates credentials
3. JWT token generated with user info and role
4. Token returned to client
5. Client includes token in `Authorization: Bearer {token}` header
6. JwtAuthGuard validates token on each request
7. User info attached to request object

## Key Patterns

### Dependency Injection

- Services injected via constructor
- Repositories injected using `@InjectRepository()`
- Modules export services for use in other modules

### Error Handling

- NestJS built-in exceptions
- Try-catch in services
- Consistent error response format
- Meaningful error messages

### Caching Strategy

- GET endpoints cached with configurable TTL
- Cache keys based on URL and query parameters
- Automatic cache invalidation on mutations
- Redis for distributed caching

### Database Patterns

- TypeORM for ORM
- Migrations for schema changes
- Entities define database structure
- Repositories for data access

### API Patterns

- RESTful endpoints
- DTOs for request/response validation
- Swagger documentation
- Role-based access control

## Security

### Authentication

- JWT tokens with 2-day expiration
- Token blacklist for logout
- Password hashing with bcrypt

### Authorization

- Role-based access control
- Three roles: Employee, Admin, Super Admin
- Guards applied at controller/method level

### Input Validation

- DTOs with class-validator
- Validation at request level
- Type safety with TypeScript

## Performance

### Caching

- Redis caching for frequently accessed data
- Configurable TTL per endpoint
- Cache invalidation on mutations

### Database

- Connection pooling
- Query optimization
- Indexes on frequently queried columns

### API

- Response compression
- Rate limiting
- Pagination for list endpoints

## Deployment

### Process Management

- PM2 for process management
- Multiple API instances (5 nodes)
- Zero-downtime deployment

### Monitoring

- Health check endpoints
- Application logs
- Error logging
- Performance monitoring

## Development Workflow

1. **Feature Development**
   - Create module following patterns
   - Implement entity, DTOs, service, controller
   - Add Swagger documentation
   - Generate migration

2. **Testing**
   - Manual testing via Swagger UI
   - Verify authentication/authorization
   - Test error cases

3. **Documentation**
   - Run `document-changes` command
   - Update context files
   - Generate feature documentation

4. **Deployment**
   - Test on staging
   - Run migrations
   - Deploy to production

## Best Practices

1. **Code Organization**
   - Follow module structure
   - Keep controllers thin
   - Business logic in services

2. **Error Handling**
   - Use NestJS exceptions
   - Provide meaningful messages
   - Log errors appropriately

3. **Documentation**
   - Document all endpoints
   - Keep Swagger docs updated
   - Update context files

4. **Security**
   - Validate all inputs
   - Use authentication guards
   - Apply role-based authorization

5. **Performance**
   - Cache appropriately
   - Optimize database queries
   - Use pagination

