# Project File Index

This file provides a comprehensive map of the codebase structure to help quickly locate files and understand their purpose.

## Quick Navigation

- [Core Application Files](#core-application-files)
- [Feature Modules](#feature-modules)
- [Authentication & Authorization](#authentication--authorization)
- [Configuration](#configuration)
- [Database](#database)
- [Shared Utilities](#shared-utilities)
- [Common Patterns](#common-patterns)

---

## Core Application Files

### Entry Point
- **`src/main.ts`** - Application bootstrap, server initialization, Swagger setup, middleware configuration
  - Sets up NestJS application
  - Configures CORS, compression, rate limiting
  - Initializes database connection and runs migrations
  - Sets up Swagger documentation

### Root Module
- **`src/app.module.ts`** - Main application module, registers all feature modules
  - Imports all feature modules (Employee, Reports, Login, Admin, etc.)
  - Configures TypeORM, JWT, Cache, Config modules
  - Registers global interceptors (HttpCacheInterceptor)

### Root Controller & Service
- **`src/app.controller.ts`** - Root controller, basic health/status endpoints
- **`src/app.service.ts`** - Root service, basic application logic

---

## Feature Modules

Each feature module follows the pattern: `src/{module-name}/`

### Employee Module
**Location:** `src/employee/`
- **Purpose:** Employee management (CRUD operations)
- **Files:**
  - `employee.module.ts` - Module definition
  - `employee.controller.ts` - HTTP endpoints for employee operations
  - `employee.service.ts` - Business logic for employee management
  - `dto/` - Data transfer objects (create, update, pagination)
  - `entities/employee.entity.ts` - Employee database entity

### Reports Module
**Location:** `src/reports/`
- **Purpose:** Gate access reports and logging
- **Files:**
  - `reports.module.ts` - Module definition
  - `reports.controller.ts` - HTTP endpoints for reports
  - `reports.service.ts` - Report generation and querying logic
  - `reports.gateway.ts` - WebSocket gateway for real-time report updates
  - `dto/` - Report query and filter DTOs
  - `entities/report.entity.ts` - Report database entity

### Login Module
**Location:** `src/login/`
- **Purpose:** Authentication and login functionality
- **Files:**
  - `login.module.ts` - Module definition
  - `login.controller.ts` - Login endpoints
  - `login.service.ts` - Login business logic
  - `services/` - Separate auth services (employee-auth, super-admin-auth)
  - `dto/` - Login request DTOs
  - `entities/` - Login-related entities

### Admin Module
**Location:** `src/admin/`
- **Purpose:** Admin user management
- **Files:**
  - `admin.module.ts` - Module definition
  - `admin.controller.ts` - Admin CRUD endpoints
  - `admin.service.ts` - Admin business logic
  - `dto/` - Admin DTOs (create, update)
  - `entities/admin.entity.ts` - Admin database entity

### Super Admin Module
**Location:** `src/super-admin/`
- **Purpose:** Super admin user management (highest privilege level)
- **Files:**
  - `super-admin.module.ts` - Module definition
  - `super-admin.controller.ts` - Super admin endpoints
  - `super-admin.service.ts` - Super admin business logic
  - `dto/` - Super admin DTOs
  - `entities/super-admin.entity.ts` - Super admin database entity

### Users Module
**Location:** `src/users/`
- **Purpose:** General user management operations
- **Files:**
  - `users.module.ts` - Module definition
  - `users.controller.ts` - User management endpoints
  - `users.service.ts` - User business logic
  - `dto/` - Multiple DTOs for various user operations

### Students Module
**Location:** `src/students/`
- **Purpose:** Student data management
- **Files:**
  - `students.module.ts` - Module definition
  - `students.controller.ts` - Student endpoints
  - `students.service.ts` - Student business logic
  - `dto/` - Student DTOs
  - `entities/student.entity.ts` - Student database entity

### Database Sync Module
**Location:** `src/database-sync/`
- **Purpose:** Synchronization with external university systems
- **Files:**
  - `database-sync.module.ts` - Module definition
  - `database-sync.controller.ts` - Sync control endpoints
  - `database-sync.service.ts` - Main sync logic (large file, handles API calls, CSV processing)
  - `database-sync-queue.service.ts` - Queue management for sync operations
  - `dto/` - Sync-related DTOs
  - `entities/` - Sync schedule and queue entities

### Health Module
**Location:** `src/health/`
- **Purpose:** Health check endpoints for monitoring
- **Files:**
  - `health.module.ts` - Module definition
  - `health.controller.ts` - Health check endpoints (database, Redis, etc.)

### Screensaver Module
**Location:** `src/screensaver/`
- **Purpose:** Screensaver functionality
- **Files:**
  - `screensaver.module.ts` - Module definition
  - `screensaver.controller.ts` - Screensaver endpoints
  - `screensaver.service.ts` - Screensaver logic

---

## Authentication & Authorization

**Location:** `src/auth/`

### Core Files
- **`auth.module.ts`** - Auth module definition, registers JWT strategy
- **`jwt-auth.guard.ts`** - JWT authentication guard (validates tokens)
- **`jwt.strategy.ts`** - Passport JWT strategy implementation
- **`strategies/jwt.strategy.ts`** - JWT strategy (alternative location)

### Guards
- **`guards/jwt-auth.guard.ts`** - JWT authentication guard
- **`guards/roles.guard.ts`** - Role-based authorization guard

### Decorators
- **`decorators/roles.decorator.ts`** - `@Roles()` decorator for role-based access
- **`public.decorator.ts`** - `@Public()` decorator to bypass authentication

### Services
- **`token-blacklist.service.ts`** - Manages blacklisted JWT tokens

### Entities
- **`entities/token-blacklist.entity.ts`** - Token blacklist database entity

### Enums
- **`enums/role.enum.ts`** - Role definitions (EMPLOYEE, ADMIN, SUPER_ADMIN)

---

## Configuration

**Location:** `src/config/`

- **`database.config.ts`** - Database configuration (PostgreSQL connection settings)
- **`redis.config.ts`** - Redis cache configuration
- **`data-source.ts`** - TypeORM DataSource configuration for migrations
- **`typeorm.config.ts`** - TypeORM configuration (alternative)
- **`dayjs.config.ts`** - Day.js timezone configuration
- **`default-users.config.ts`** - Default user seeding configuration

---

## Database

### Migrations
**Location:** `src/migrations/`

All migration files follow pattern: `{timestamp}-{Description}.ts`

Key migrations:
- `1709082000000-AddTimestampsToSuperAdmin.ts` - Adds timestamps to super admin
- `1709126212000-CreateTokenBlacklistTable.ts` - Creates token blacklist table
- `1710000000000-CreateSyncAndStudentTables.ts` - Creates sync and student tables
- `1710100000000-CreateReportsTable.ts` - Creates reports table
- `1710669185432-CreateInitialTables.ts` - Initial database schema
- `1745432754545-AddDeviceColumnToReport.ts` - Adds device column to reports

### Data Source
- **`src/data-source.ts`** - TypeORM DataSource (used by migrations)

---

## Shared Utilities

### Services
**Location:** `src/services/`

- **`cache.service.ts`** - Redis cache service wrapper, provides cache operations

### Interceptors
**Location:** `src/interceptors/`

- **`cache.interceptor.ts`** - HTTP cache interceptor, automatically caches GET requests

### Decorators
**Location:** `src/decorators/`

- **`cache-control.decorator.ts`** - Cache control decorators (`@CacheTTL()`, `@NoCache()`)

### Common DTOs
**Location:** `src/common/dto/`

- **`base-pagination.dto.ts`** - Base pagination DTO (page, limit)
- **`pagination-query.dto.ts`** - Pagination query DTO

---

## Common Patterns

### Module Structure Pattern
Every feature module follows this structure:
```
src/{module-name}/
├── {module-name}.module.ts      # Module definition
├── {module-name}.controller.ts  # HTTP endpoints
├── {module-name}.service.ts     # Business logic
├── dto/                         # Data transfer objects
│   ├── create-{entity}.dto.ts
│   ├── update-{entity}.dto.ts
│   └── {entity}-pagination.dto.ts
└── entities/                     # TypeORM entities
    └── {entity}.entity.ts
```

### File Naming Conventions
- **Modules:** `{name}.module.ts`
- **Controllers:** `{name}.controller.ts`
- **Services:** `{name}.service.ts`
- **DTOs:** `{action}-{entity}.dto.ts` (e.g., `create-employee.dto.ts`)
- **Entities:** `{name}.entity.ts`
- **Migrations:** `{timestamp}-{Description}.ts`

---

## Quick Reference: Finding Files by Task

### Need to add a new endpoint?
1. Find the relevant module in `src/{module}/`
2. Add method to `{module}.controller.ts`
3. Add business logic to `{module}.service.ts`
4. Create/update DTOs in `{module}/dto/`

### Need to modify authentication?
- Guards: `src/auth/guards/`
- Strategy: `src/auth/strategies/jwt.strategy.ts`
- Decorators: `src/auth/decorators/`
- Token management: `src/auth/token-blacklist.service.ts`

### Need to change database schema?
1. Modify entity in `src/{module}/entities/{entity}.entity.ts`
2. Generate migration: `npm run migration:generate`
3. Migration files in `src/migrations/`

### Need to add caching?
- Decorators: `src/decorators/cache-control.decorator.ts`
- Service: `src/services/cache.service.ts`
- Interceptor: `src/interceptors/cache.interceptor.ts`

### Need to configure something?
- Database: `src/config/database.config.ts`
- Redis: `src/config/redis.config.ts`
- TypeORM: `src/config/data-source.ts`

### Need to add a new feature module?
1. Create directory: `src/{module-name}/`
2. Follow module structure pattern above
3. Register in `src/app.module.ts`

### Need to modify database sync?
- Main service: `src/database-sync/database-sync.service.ts` (large file, ~2300 lines)
- Queue service: `src/database-sync/database-sync-queue.service.ts`
- Controller: `src/database-sync/database-sync.controller.ts`

### Need to check health/monitoring?
- Health endpoints: `src/health/health.controller.ts`

### Need to modify reports?
- Service: `src/reports/reports.service.ts`
- Controller: `src/reports/reports.controller.ts`
- WebSocket: `src/reports/reports.gateway.ts`
- Entity: `src/reports/entities/report.entity.ts`

---

## Special Files

### Large/Complex Files
- **`src/database-sync/database-sync.service.ts`** - Very large file (~2300+ lines), handles:
  - External API synchronization
  - CSV processing
  - Image processing
  - Batch operations
  - Scheduled sync jobs

### Configuration Files (Root)
- **`package.json`** - Dependencies and scripts
- **`tsconfig.json`** - TypeScript configuration
- **`nest-cli.json`** - NestJS CLI configuration
- **`ecosystem.config.js`** - PM2 process manager configuration

### Documentation
- **`.cursor/`** - AI assistant rules and commands
- **`README.md`** - Project documentation
- **`.cursor/docs/`** - Auto-generated documentation

---

## Module Registration Order

Modules are registered in `src/app.module.ts` in this order:
1. ConfigModule (global)
2. TypeOrmModule (database)
3. JwtModule (authentication)
4. Feature modules (Employee, Reports, Login, Admin, Users, SuperAdmin, Health, DatabaseSync)
5. CacheModule (Redis)
6. AuthModule (authentication setup)

---

## Testing Files

Test files follow the pattern: `{name}.spec.ts`
- Located alongside the files they test
- Example: `employee.controller.spec.ts` tests `employee.controller.ts`

---

## Important Notes

1. **Database:** Uses TypeORM with PostgreSQL
2. **Cache:** Uses Redis via `@nestjs/cache-manager`
3. **Auth:** JWT with Passport, role-based access control
4. **API Docs:** Swagger/OpenAPI (configured in `main.ts`)
5. **Migrations:** Never use `synchronize: true` in production, always use migrations
6. **Caching:** GET requests are automatically cached via `HttpCacheInterceptor`
7. **File Structure:** Follows NestJS module pattern strictly

---

## When You Need Help Finding Something

1. **Feature/Module code:** Look in `src/{module-name}/`
2. **Shared utilities:** Look in `src/services/`, `src/interceptors/`, `src/decorators/`
3. **Configuration:** Look in `src/config/`
4. **Database:** Look in `src/migrations/` and entity files
5. **Authentication:** Look in `src/auth/`
6. **Common patterns:** Look in `src/common/`

This index is maintained to reflect the current project structure. When adding new modules or significant files, update this index accordingly.

