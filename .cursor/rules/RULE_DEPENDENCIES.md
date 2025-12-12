---
alwaysApply: false
---

# Rule Dependencies and Relationships

This file maps tasks to required rules and shows relationships between rules. Use this as a reference to understand which rules automatically apply to each task.

**📁 File Navigation:** Always reference `.cursor/FILE_INDEX.md` to find files and understand project structure before starting any task.

## Rule Categories

### Core Rules (Always Apply)
These rules apply to almost every task:
- **coding-practice.mdc** - Code style, naming conventions, TypeScript best practices
- **debugging-practice.mdc** - Error handling, exception patterns, logging

### Data Layer Rules
Rules for working with data:
- **entity-patterns.mdc** - TypeORM entity definitions
- **dto-patterns.mdc** - Data transfer objects and validation
- **database-migrations.mdc** - Database schema changes

### API Layer Rules
Rules for building APIs:
- **controller-patterns.mdc** - HTTP endpoints and routing
- **service-patterns.mdc** - Business logic and data access
- **authentication-patterns.mdc** - JWT auth and role-based access control

### Performance Rules
Rules for optimization:
- **caching-patterns.mdc** - Redis caching strategies
- **service-patterns.mdc** - Query optimization (also in API Layer)

### Workflow Rules
Rules for development workflows:
- **feature-implementation.mdc** - Module structure and organization
- **documentation-patterns.mdc** - Auto-documentation standards
- **dependency-management.mdc** - Package management and versioning

## Task → Rules Mapping

### Task: Add Endpoint (`add-endpoint.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc

**Task-Specific (Always):**
- controller-patterns.mdc
- service-patterns.mdc
- authentication-patterns.mdc

**Task-Specific (Conditional):**
- dto-patterns.mdc (if creating/updating DTO)
- caching-patterns.mdc (if endpoint should be cached)
- entity-patterns.mdc (if entity needs changes)
- database-migrations.mdc (if schema changes needed)

### Task: Create Feature (`implement-feature.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc
- feature-implementation.mdc

**Task-Specific (Always):**
- entity-patterns.mdc
- dto-patterns.mdc
- service-patterns.mdc
- controller-patterns.mdc
- authentication-patterns.mdc
- database-migrations.mdc
- documentation-patterns.mdc

**Task-Specific (Conditional):**
- caching-patterns.mdc (if caching is needed)

### Task: Fix Bug (`implement-bugfix.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc

**Task-Specific (Context-Dependent):**
- service-patterns.mdc (if bug is in service)
- controller-patterns.mdc (if bug is in controller)
- dto-patterns.mdc (if bug is in validation)
- authentication-patterns.mdc (if bug is in auth)
- entity-patterns.mdc (if bug is in entity)
- database-migrations.mdc (if bug requires schema fix)

### Task: Optimize Performance (`implement-optimization.mdc`)

**Always Applies:**
- coding-practice.mdc

**Task-Specific (Always):**
- caching-patterns.mdc
- service-patterns.mdc

**Task-Specific (Conditional):**
- database-migrations.mdc (if adding indexes)
- entity-patterns.mdc (if optimizing entity structure)

### Task: Create Migration (`create-migration.mdc`)

**Always Applies:**
- coding-practice.mdc

**Task-Specific (Always):**
- entity-patterns.mdc
- database-migrations.mdc

### Task: Refactor Module (`refactor-module.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc

**Task-Specific (Context-Dependent):**
- service-patterns.mdc (if refactoring services)
- controller-patterns.mdc (if refactoring controllers)
- feature-implementation.mdc (if restructuring modules)
- dto-patterns.mdc (if refactoring DTOs)

### Task: Document Changes (`document-changes.mdc`)

**Always Applies:**
- documentation-patterns.mdc

**Task-Specific (Context-Dependent):**
- All other rules (to understand what to document)

### Task: Update Packages (`update-packages.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc

**Task-Specific (Always Apply):**
- dependency-management.mdc

**Task-Specific (Conditional):**
- documentation-patterns.mdc (when documenting updates)

### Task: Maintain Repository (`maintain-repository.mdc`)

**Always Applies:**
- coding-practice.mdc
- debugging-practice.mdc

**Task-Specific (Context-Dependent):**
- dependency-management.mdc (for package checks)
- database-migrations.mdc (for migration checks)
- documentation-patterns.mdc (for documentation updates)

## Rule → Related Rules Mapping

### coding-practice.mdc
**Related Rules:**
- All other rules (coding standards apply everywhere)

**When Used With:**
- Every task and every other rule

### debugging-practice.mdc
**Related Rules:**
- service-patterns.mdc (error handling in services)
- controller-patterns.mdc (error handling in controllers)
- dto-patterns.mdc (validation error handling)

**When Used With:**
- Any task involving error handling
- Bug fixes
- Feature implementation

### entity-patterns.mdc
**Related Rules:**
- coding-practice.mdc (naming conventions)
- database-migrations.mdc (migrations for entity changes)
- service-patterns.mdc (using entities in services)
- dto-patterns.mdc (mapping between entities and DTOs)

**When Used With:**
- Creating features
- Creating migrations
- Database schema changes

### dto-patterns.mdc
**Related Rules:**
- coding-practice.mdc (naming conventions, code style)
- debugging-practice.mdc (validation error handling)
- controller-patterns.mdc (how DTOs are used in controllers)
- service-patterns.mdc (how DTOs are used in services)

**When Used With:**
- Adding endpoints
- Creating features
- API changes

### controller-patterns.mdc
**Related Rules:**
- coding-practice.mdc (code style)
- dto-patterns.mdc (DTO usage)
- service-patterns.mdc (calling services)
- authentication-patterns.mdc (guards and authorization)
- caching-patterns.mdc (caching decorators)
- debugging-practice.mdc (error handling)

**When Used With:**
- Adding endpoints
- Creating features
- API development

### service-patterns.mdc
**Related Rules:**
- coding-practice.mdc (code style)
- entity-patterns.mdc (working with entities)
- debugging-practice.mdc (error handling)
- caching-patterns.mdc (cache operations)
- dto-patterns.mdc (using DTOs)

**When Used With:**
- Adding endpoints
- Creating features
- Business logic implementation
- Performance optimization

### authentication-patterns.mdc
**Related Rules:**
- controller-patterns.mdc (applying guards)
- debugging-practice.mdc (auth error handling)
- coding-practice.mdc (code style)

**When Used With:**
- Adding endpoints
- Creating features
- Security implementation

### caching-patterns.mdc
**Related Rules:**
- controller-patterns.mdc (caching decorators)
- service-patterns.mdc (cache operations)
- debugging-practice.mdc (cache error handling)

**When Used With:**
- Adding endpoints (GET endpoints)
- Performance optimization
- Feature implementation

### database-migrations.mdc
**Related Rules:**
- entity-patterns.mdc (entity changes require migrations)
- coding-practice.mdc (code style)
- debugging-practice.mdc (migration error handling)

**When Used With:**
- Creating features
- Entity changes
- Schema updates

### feature-implementation.mdc
**Related Rules:**
- All other rules (features use all patterns)
- entity-patterns.mdc
- dto-patterns.mdc
- service-patterns.mdc
- controller-patterns.mdc
- authentication-patterns.mdc
- database-migrations.mdc
- documentation-patterns.mdc

**When Used With:**
- Creating new modules
- Major feature development

### documentation-patterns.mdc
**Related Rules:**
- All other rules (to document what was implemented)

**When Used With:**
- After any change
- Feature implementation
- Bug fixes
- Optimizations

### dependency-management.mdc
**Related Rules:**
- coding-practice.mdc (package.json formatting)
- debugging-practice.mdc (handling dependency errors)

**When Used With:**
- Updating packages
- Adding dependencies
- Removing dependencies
- Managing versions

## Quick Reference Matrix

| Task | Core Rules | Data Layer | API Layer | Performance | Workflow |
|------|-----------|------------|-----------|-------------|----------|
| Add Endpoint | ✅ | ⚠️ | ✅ | ⚠️ | - |
| Create Feature | ✅ | ✅ | ✅ | ⚠️ | ✅ |
| Fix Bug | ✅ | ⚠️ | ⚠️ | - | - |
| Optimize | ✅ | ⚠️ | ✅ | ✅ | - |
| Create Migration | ✅ | ✅ | - | - | - |
| Refactor | ✅ | ⚠️ | ⚠️ | - | ⚠️ |
| Document | - | - | - | - | ✅ |
| Update Packages | ✅ | - | - | - | ⚠️ |
| Maintain Repository | ✅ | ⚠️ | - | - | ⚠️ |

**Legend:**
- ✅ Always applies
- ⚠️ Context-dependent
- - Not applicable

## Usage Guidelines

1. **When using a command**, all rules listed in that command's "Related Rules" section are automatically applied
2. **When working with a rule**, check its "Related Rules" section to see what else applies
3. **Core rules** (coding-practice, debugging-practice) almost always apply
4. **Context-dependent rules** apply based on the specific task requirements

## How AI Uses This

When you reference a command (e.g., "follow add-endpoint.mdc"), the AI:
1. Reads the command's "Related Rules" section
2. Automatically applies all listed rules
3. Cross-references related rules from each rule file
4. Ensures no rules are missed

You don't need to list rules manually - they're applied automatically!

