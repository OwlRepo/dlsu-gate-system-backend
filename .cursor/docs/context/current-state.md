# Current System State

**Last Updated:** {Will be auto-updated}

## Overview

This file maintains the current state of the DLSU Gate System Backend for AI context. It should be updated automatically when changes are made.

## Modules

### Core Modules
- **Employee** - Employee management and authentication
- **Admin** - Admin user management
- **SuperAdmin** - Super admin user management
- **Users** - Unified user management
- **Students** - Student data management
- **Reports** - Access reports and logging
- **Login** - Authentication services
- **Auth** - JWT authentication and authorization
- **DatabaseSync** - Database synchronization with external systems
- **Health** - Health check endpoints
- **Screensaver** - Screensaver functionality

## Key Endpoints

### Authentication
- `POST /auth/login` - Employee login (Public)
- `POST /auth/admin-login` - Admin login (Public)
- `POST /auth/super-admin-login` - Super admin login (Public)

### Employee
- `GET /employee` - List employees (Authenticated)
- `POST /employee` - Create employee (Admin/Super Admin)
- `GET /employee/:id` - Get employee by ID (Authenticated)
- `PATCH /employee/:id` - Update employee (Admin/Super Admin)
- `DELETE /employee/:id` - Delete employee (Super Admin)

### Reports
- `GET /reports` - List reports with pagination (Authenticated)
- `POST /reports` - Create report (Authenticated)
- `GET /reports/export` - Export reports as CSV (Authenticated)

### Users
- `GET /users` - List users (Authenticated)
- `POST /users/bulk-deactivate` - Bulk deactivate users (Admin/Super Admin)
- `POST /users/bulk-reactivate` - Bulk reactivate users (Admin/Super Admin)

## Database Schema

### Tables
- `employee` - Employee records
- `admin` - Admin user records
- `super-admin` - Super admin records
- `students` - Student records
- `reports` - Access reports
- `sync_queue` - Database sync queue
- `sync_schedule` - Sync schedule configuration
- `token_blacklist` - Blacklisted JWT tokens

### Recent Migrations
- Migrations are tracked in `src/migrations/`

## Configuration

### Key Settings
- JWT expiration: 2 days
- Database: PostgreSQL
- Cache: Redis
- Port: 3000 (configurable via PORT env var)
- Environment: Development/Production

## Authentication

- JWT-based authentication
- Role-based access control (Employee, Admin, Super Admin)
- Token blacklist support
- Public endpoints marked with `@Public()` decorator

## Caching

- Redis caching for GET endpoints
- Cache TTL configurable per endpoint
- Automatic cache invalidation on mutations

## Recent Changes

See `recent-changes.md` for detailed change history.

