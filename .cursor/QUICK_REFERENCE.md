# Quick Reference Guide

A cheat sheet for quickly constructing prompts and selecting the right tools.

## 🎯 Common Scenarios - Copy & Paste Prompts

**Note:** All rules are automatically applied when you reference a command. You don't need to list them!

### Add New API Endpoint (Simplified)
```
Add [GET/POST/PATCH/DELETE] endpoint at [path] following add-endpoint.mdc.

Requirements:
- [List requirements]
```

**Auto-Applied Rules:** coding-practice, debugging-practice, controller-patterns, service-patterns, authentication-patterns, dto-patterns (if creating DTO), caching-patterns (if caching)

### Fix a Bug (Simplified)
```
Bug: [description]
Follow implement-bugfix.mdc to fix it.

Root cause: [cause]
```

**Auto-Applied Rules:** coding-practice, debugging-practice, plus context-specific rules (service-patterns, controller-patterns, dto-patterns, etc. based on where the bug is)

### Create New Feature Module (Simplified)
```
Create [ModuleName] module following implement-feature.mdc.

Requirements:
- Entity: [description]
- DTOs: [list]
- Endpoints: [list]
- Auth: [requirements]
```

**Auto-Applied Rules:** All feature rules (coding-practice, debugging-practice, feature-implementation, entity-patterns, dto-patterns, service-patterns, controller-patterns, authentication-patterns, database-migrations, documentation-patterns, caching-patterns)

### Optimize Performance (Simplified)
```
Optimize [component] following implement-optimization.mdc.

Current issue: [problem]
Target: [goal]
```

**Auto-Applied Rules:** coding-practice, caching-patterns, service-patterns, plus database-migrations (if adding indexes)

### Create Database Migration (Simplified)
```
Add [change] to [entity] following create-migration.mdc.

Change: [description]
```

**Auto-Applied Rules:** coding-practice, entity-patterns, database-migrations

## 📋 Command + Rule Matrix

| What You're Doing | Command | Key Rules |
|------------------|---------|-----------|
| Adding endpoint | `add-endpoint.mdc` | `controller-patterns`, `dto-patterns`, `authentication-patterns` |
| Creating feature | `implement-feature.mdc` | All pattern rules |
| Fixing bug | `implement-bugfix.mdc` | `debugging-practice`, `service-patterns` |
| Optimizing | `implement-optimization.mdc` | `caching-patterns`, `service-patterns` |
| Migration | `create-migration.mdc` | `entity-patterns`, `database-migrations` |
| Refactoring | `refactor-module.mdc` | `coding-practice`, `service-patterns` |
| Documenting | `document-changes.mdc` | `documentation-patterns` |

## 🔧 Model Selection

- **Composer** (default): Use for all development tasks
- **Chat**: Use for quick questions about patterns
- **Codebase Search**: Use to find examples

## 📝 Prompt Template (Simplified)

```
[Context] + [Task] + [Command] + [Requirements]

Example:
I'm working on the Employee module. Add GET /employee/export endpoint following add-endpoint.mdc.
The endpoint should require authentication and export CSV data.
```

**Note:** Rules are automatically applied - no need to list them!

## 🎨 Rule Files Quick Guide

| Rule File | When to Reference |
|-----------|------------------|
| `coding-practice.mdc` | Always - coding standards |
| `dto-patterns.mdc` | Creating/updating DTOs |
| `entity-patterns.mdc` | Creating/updating entities |
| `controller-patterns.mdc` | Creating/updating controllers |
| `service-patterns.mdc` | Creating/updating services |
| `authentication-patterns.mdc` | Adding auth/authorization |
| `caching-patterns.mdc` | Adding caching |
| `database-migrations.mdc` | Creating migrations |
| `debugging-practice.mdc` | Error handling |
| `feature-implementation.mdc` | Module structure |
| `documentation-patterns.mdc` | Documenting changes |

## ✅ Checklist: Adding an Endpoint

- [ ] Reference `add-endpoint.mdc`
- [ ] Create/update DTO (`dto-patterns.mdc`)
- [ ] Add service method (`service-patterns.mdc`)
- [ ] Add controller method (`controller-patterns.mdc`)
- [ ] Add Swagger docs (`controller-patterns.mdc`)
- [ ] Add guards (`authentication-patterns.mdc`)
- [ ] Add caching if needed (`caching-patterns.mdc`)
- [ ] Test endpoint
- [ ] Document (`document-changes.mdc`)

## ✅ Checklist: Creating a Feature

- [ ] Reference `implement-feature.mdc`
- [ ] Create entity (`entity-patterns.mdc`)
- [ ] Create DTOs (`dto-patterns.mdc`)
- [ ] Create service (`service-patterns.mdc`)
- [ ] Create controller (`controller-patterns.mdc`)
- [ ] Create module
- [ ] Register in AppModule
- [ ] Generate migration (`create-migration.mdc`)
- [ ] Add auth (`authentication-patterns.mdc`)
- [ ] Add caching (`caching-patterns.mdc`)
- [ ] Test everything
- [ ] Document (`document-changes.mdc`)

## 🚀 Quick Start Examples

### Example 1: Add GET /notifications (Simplified)
```
Add GET /notifications endpoint following add-endpoint.mdc.
Requires auth, supports pagination, cache 30min.
```

**All rules auto-applied!**

### Example 2: Fix validation bug (Simplified)
```
Fix: Employee creation accepts null email.
Follow implement-bugfix.mdc.
Root cause: Missing validation in CreateEmployeeDto.
```

**All rules auto-applied!**

### Example 3: Create Notifications module (Simplified)
```
Create Notifications module following implement-feature.mdc.
All CRUD operations, requires auth, admin can create/update/delete.
Cache GET endpoints 30min.
```

**All rules auto-applied!**

## 💡 Pro Tips

1. **Always reference commands** - They provide structure and auto-apply rules
2. **Don't list rules manually** - Commands automatically apply all relevant rules
3. **Be specific** - Include requirements and constraints
4. **Document after** - Always run `document-changes.mdc`
5. **One step at a time** - Break complex tasks down
6. **Trust the system** - Rules are intelligently applied based on the command

## 📚 Full Documentation

See `.cursor/README.md` for complete guide with detailed examples.

