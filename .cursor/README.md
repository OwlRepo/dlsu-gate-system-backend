# Cursor Rules and Commands Guide

This guide explains how to efficiently use the rules and commands files in `.cursor/rules/` and `.cursor/commands/` to streamline development with AI assistance.

## Table of Contents

- [Overview](#overview)
- [Understanding Rules vs Commands](#understanding-rules-vs-commands)
- [How to Use Rules](#how-to-use-rules)
- [How to Use Commands](#how-to-use-commands)
- [Example Scenarios](#example-scenarios)
- [Prompt Construction Guide](#prompt-construction-guide)
- [Model Selection Guide](#model-selection-guide)
- [Best Practices](#best-practices)

## Overview

The `.cursor/` directory contains:

- **Rules** (`.cursor/rules/`) - Best practices, patterns, and standards that AI should always follow
- **Commands** (`.cursor/commands/`) - Step-by-step workflows for specific tasks
- **Docs** (`.cursor/docs/`) - Auto-generated documentation and context files
- **FILE_INDEX.md** - Comprehensive file index and project structure map (always reference this to find files)

Rules are automatically applied (`alwaysApply: true`), while commands are invoked when you need to perform specific tasks.

**Important:** Always reference `FILE_INDEX.md` when you need to locate files or understand the project structure. It provides a complete map of all modules, files, and their purposes.

## Understanding Rules vs Commands

### Rules
- **Purpose:** Define coding standards, patterns, and best practices
- **When:** Always active - AI follows these automatically
- **Examples:** `coding-practice.mdc`, `dto-patterns.mdc`, `controller-patterns.mdc`
- **Use:** No action needed - they're always applied
- **Smart Application:** When you use a command, all related rules are automatically applied

### Commands
- **Purpose:** Provide step-by-step workflows for specific tasks
- **When:** Invoked explicitly when performing a task
- **Examples:** `implement-feature.mdc`, `implement-bugfix.mdc`, `add-endpoint.mdc`
- **Use:** Reference in your prompts - rules are automatically applied
- **Smart Feature:** Each command lists all applicable rules in its "Related Rules" section, so you don't need to specify them individually

## How to Use Rules

Rules are automatically applied, but you can reference them in prompts:

### Example Prompt:
```
I need to create a new DTO. Please follow the patterns in dto-patterns.mdc
```

### When Rules Are Most Useful:
- **Code Review:** "Does this code follow coding-practice.mdc?"
- **Learning Patterns:** "Show me how to create an entity following entity-patterns.mdc"
- **Ensuring Consistency:** "Make sure this follows controller-patterns.mdc"

## How to Use Commands

Commands provide structured workflows. **When you reference a command, all related rules are automatically applied** - you don't need to list them!

### Basic Usage Pattern (Simplified):
```
Follow the workflow in implement-feature.mdc to add a new "Notifications" module
```

The AI automatically applies all rules listed in `implement-feature.mdc`'s "Related Rules" section:
- coding-practice.mdc
- debugging-practice.mdc
- feature-implementation.mdc
- entity-patterns.mdc
- dto-patterns.mdc
- service-patterns.mdc
- controller-patterns.mdc
- authentication-patterns.mdc
- database-migrations.mdc
- documentation-patterns.mdc
- caching-patterns.mdc (if needed)

### Step-by-Step Usage:
```
I'm going to add a new endpoint. Let's follow add-endpoint.mdc step by step
```

All rules are automatically applied at each step - no need to specify them!

## Example Scenarios

### Scenario 1: Adding a New API Endpoint

**Task:** Add a `GET /notifications` endpoint to list user notifications

**Prompt Construction (Simplified - Rules Auto-Applied):**
```
Add GET /notifications endpoint following add-endpoint.mdc.

Requirements:
- Endpoint: GET /notifications
- Requires authentication
- Supports pagination
- Cache for 30 minutes
```

**What Happens Automatically:**
When you reference `add-endpoint.mdc`, the AI automatically applies ALL these rules:
- coding-practice.mdc (code style)
- debugging-practice.mdc (error handling)
- controller-patterns.mdc (controller structure)
- service-patterns.mdc (service implementation)
- authentication-patterns.mdc (guards)
- dto-patterns.mdc (if creating DTO)
- caching-patterns.mdc (caching)
- documentation-patterns.mdc (documentation)

**You don't need to list them - they're applied automatically!**

**Model Recommendation:** Use Composer (default) - it can follow multi-step workflows well

**Expected Output:**
- New DTO file created
- Service method implemented
- Controller endpoint added
- Swagger docs added
- Guards applied
- Caching configured

---

### Scenario 2: Implementing a Bugfix

**Task:** Fix issue where employee creation fails when email is null

**Prompt Construction:**
```
I found a bug where employee creation fails when email is null. Let's follow implement-bugfix.mdc:

1. The bug is in EmployeeService.create() method
2. Root cause: No validation for required email field
3. Please:
   - Add @IsNotEmpty() and @IsEmail() to CreateEmployeeDto following dto-patterns.mdc
   - Update error handling in service following debugging-practice.mdc
   - Test the fix
   - Document the change using document-changes.mdc

The fix should return a 400 Bad Request with a clear error message when email is missing or invalid.
```

**Model Recommendation:** Use Composer - good at debugging and fixing issues

**Expected Output:**
- DTO validation updated
- Error handling improved
- Test cases added/updated
- Changelog entry created

---

### Scenario 3: Creating a New Feature Module

**Task:** Create a complete "Notifications" module with CRUD operations

**Prompt Construction:**
```
I need to create a new Notifications module. Please follow implement-feature.mdc completely:

1. Create Notification entity following entity-patterns.mdc
2. Create DTOs (CreateNotificationDto, UpdateNotificationDto, NotificationPaginationDto) following dto-patterns.mdc
3. Create NotificationService with CRUD methods following service-patterns.mdc
4. Create NotificationController with all endpoints following controller-patterns.mdc
5. Create NotificationModule and register in AppModule
6. Generate migration following create-migration.mdc
7. Add Swagger documentation
8. Apply authentication/authorization following authentication-patterns.mdc
9. Add caching where appropriate following caching-patterns.mdc
10. Document everything using document-changes.mdc

Requirements:
- Entity should have: id (uuid), user_id, title, message, is_read, created_at, updated_at
- Endpoints: GET /notifications (paginated), GET /notifications/:id, POST /notifications, PATCH /notifications/:id, DELETE /notifications/:id
- All endpoints require authentication
- Only admins can create/update/delete
- GET endpoints should be cached for 30 minutes
```

**Model Recommendation:** Use Composer - excellent for multi-file, multi-step implementations

**Expected Output:**
- Complete module structure
- All CRUD operations
- Migration file
- Swagger documentation
- Documentation generated

---

### Scenario 4: Performance Optimization

**Task:** Optimize slow employee list endpoint (currently takes 3 seconds)

**Prompt Construction:**
```
The GET /employee endpoint is slow (3 seconds). Let's optimize it following implement-optimization.mdc:

1. Analyze the current implementation
2. Identify bottlenecks (likely database queries)
3. Optimize following service-patterns.mdc:
   - Add database indexes if needed
   - Optimize queries
   - Add caching following caching-patterns.mdc
4. Measure improvements
5. Document the optimization using document-changes.mdc

Current implementation uses:
- employeeRepository.find() with no pagination
- No caching
- No indexes on searchable fields

Target: Reduce response time to under 500ms
```

**Model Recommendation:** Use Composer - can analyze code and suggest optimizations

**Expected Output:**
- Optimized queries
- Database indexes added
- Caching implemented
- Performance improvements documented

---

### Scenario 5: Database Migration

**Task:** Add a "phone_number" column to the employee table

**Prompt Construction:**
```
I need to add a phone_number column to the employee table. Follow create-migration.mdc:

1. Update Employee entity following entity-patterns.mdc:
   - Add @Column({ type: 'varchar', length: 20, nullable: true })
   - Property name: phoneNumber
2. Generate migration: npm run migration:generate -- src/migrations/AddPhoneNumberToEmployee
3. Review the generated migration
4. Test migration up and down
5. Update CreateEmployeeDto and UpdateEmployeeDto following dto-patterns.mdc
6. Document the change using document-changes.mdc

The column should be:
- Type: varchar(20)
- Nullable: true
- Optional field
```

**Model Recommendation:** Use Composer - good at following structured workflows

**Expected Output:**
- Entity updated
- Migration generated
- DTOs updated
- Migration tested
- Documentation updated

---

### Scenario 6: Update Packages

**Task:** Update all packages to latest versions, focusing on security updates

**Prompt Construction (Simplified - Rules Auto-Applied):**
```
Update packages following update-packages.mdc.

Focus: Security updates and patch versions
```

**What Happens Automatically:**
The AI automatically applies:
- coding-practice.mdc
- debugging-practice.mdc
- dependency-management.mdc
- documentation-patterns.mdc (for documenting updates)

**Expected Output:**
- Security vulnerabilities fixed
- Packages updated within version ranges
- Tests run and verified
- Lock file updated
- Changes documented

---

### Scenario 7: Refactoring Code

**Task:** Refactor large EmployeeService (500+ lines) by extracting report logic

**Prompt Construction:**
```
The EmployeeService is too large (500+ lines). Let's refactor following refactor-module.mdc:

1. Identify code to extract (report-related methods)
2. Create a new ReportService following service-patterns.mdc
3. Move report logic to ReportService
4. Update EmployeeService to use ReportService
5. Update EmployeeController if needed following controller-patterns.mdc
6. Ensure backward compatibility
7. Update tests
8. Document the refactoring using document-changes.mdc

Current EmployeeService has:
- Employee CRUD methods
- Report creation methods
- Report query methods

Goal: Extract all report-related methods to ReportService
```

**Model Recommendation:** Use Composer - excellent for refactoring and code organization

**Expected Output:**
- New ReportService created
- EmployeeService simplified
- Dependencies updated
- Tests updated
- Documentation updated

---

## Prompt Construction Guide

### General Prompt Structure

```
[Context] + [Task] + [Reference to Command] + [Reference to Rules] + [Specific Requirements]
```

### Components:

1. **Context:** What you're working on
   - "I'm working on the Employee module..."
   - "There's a bug in the login flow..."

2. **Task:** What you want to accomplish
   - "I need to add a new endpoint..."
   - "I need to fix the validation issue..."

3. **Command Reference:** Which workflow to follow
   - "Follow implement-feature.mdc..."
   - "Use add-endpoint.mdc workflow..."

4. **Rules Reference:** Which patterns to follow
   - "Following dto-patterns.mdc..."
   - "Use controller-patterns.mdc..."

5. **Specific Requirements:** Details about your task
   - "The endpoint should require admin role..."
   - "Cache for 1 hour..."

### Prompt Templates

#### Template 1: Feature Implementation (Simplified)
```
I need to [feature description]. Please follow [command-file].mdc.

Requirements:
- [Requirement 1]
- [Requirement 2]
```

**Note:** All rules are automatically applied - no need to list them!

#### Template 2: Bugfix
```
I found a bug: [bug description]. Let's follow implement-bugfix.mdc:

1. Root cause: [suspected cause]
2. Fix: [proposed fix] following [rule-file].mdc
3. Test: [test approach]
4. Document: Use document-changes.mdc

Expected behavior: [what should happen]
```

#### Template 3: Optimization
```
[Component] is slow/inefficient. Let's optimize following implement-optimization.mdc:

Current issues:
- [Issue 1]
- [Issue 2]

Optimization plan:
- [Plan 1] following [rule-file].mdc
- [Plan 2] following [rule-file].mdc

Target: [performance goal]
```

## Model Selection Guide

### Composer (Default - Recommended for Most Tasks)

**Best For:**
- Multi-step workflows (feature implementation, refactoring)
- Code generation across multiple files
- Following structured commands
- Complex tasks requiring context

**When to Use:**
- ✅ Implementing features
- ✅ Adding endpoints
- ✅ Creating migrations
- ✅ Refactoring modules
- ✅ Following command workflows

**Example:**
```
Follow implement-feature.mdc to create a Notifications module
```

### Chat (For Quick Questions)

**Best For:**
- Quick questions about patterns
- Understanding rules
- Code review questions
- Simple clarifications

**When to Use:**
- ✅ "What does dto-patterns.mdc say about validation?"
- ✅ "How should I structure this controller?"
- ✅ "Does this code follow coding-practice.mdc?"

**Example:**
```
Quick question: According to controller-patterns.mdc, should I use @Public() or @UseGuards(JwtAuthGuard) for a login endpoint?
```

### Codebase Search (For Finding Examples)

**Best For:**
- Finding existing implementations
- Understanding current patterns
- Locating similar code

**When to Use:**
- ✅ "Show me how employee endpoints are structured"
- ✅ "Find examples of pagination DTOs"
- ✅ "How are migrations currently implemented?"

## Best Practices

### 1. Always Reference Commands for Structured Tasks

**Good (Simplified):**
```
Follow implement-feature.mdc to create the Notifications module
```

**Bad:**
```
Create a Notifications module
```

**Why:** The command automatically applies all relevant rules.

### 2. Don't List Rules - They're Auto-Applied

**Good (Simplified):**
```
Add GET /notifications endpoint following add-endpoint.mdc
```

**Unnecessary (but still works):**
```
Add GET /notifications endpoint following add-endpoint.mdc, dto-patterns.mdc, controller-patterns.mdc...
```

**Why:** The command's "Related Rules" section lists all applicable rules automatically.

### 3. Be Specific About Requirements

**Good:**
```
Add GET /notifications endpoint following add-endpoint.mdc.

Requirements:
- Requires authentication
- Supports pagination
- Caches for 30 minutes
- Returns user's notifications only
```

**Bad:**
```
Add a notifications endpoint
```

### 4. Trust the Command to Apply Rules

**Good:**
```
Create the DTO following add-endpoint.mdc (dto-patterns.mdc is automatically applied)
```

**Unnecessary:**
```
Create the DTO following dto-patterns.mdc, coding-practice.mdc, debugging-practice.mdc...
```

**Why:** The command knows which rules apply to each step.

### 5. Use document-changes.mdc After Every Change

**Good:**
```
After implementing the feature, run document-changes.mdc to update documentation
```

**Bad:**
```
(No documentation step)
```

### 6. Break Down Complex Tasks

**Good:**
```
Step 1: Follow add-endpoint.mdc to add the GET endpoint
Step 2: Follow add-endpoint.mdc to add the POST endpoint
Step 3: Follow document-changes.mdc to document both
```

**Bad:**
```
Add all endpoints at once
```

## Quick Reference

### Common Command + Rule Combinations

| Task | Command | Rules to Reference |
|------|---------|-------------------|
| Add endpoint | `add-endpoint.mdc` | `controller-patterns.mdc`, `dto-patterns.mdc`, `authentication-patterns.mdc` |
| Create feature | `implement-feature.mdc` | All pattern rules |
| Fix bug | `implement-bugfix.mdc` | `debugging-practice.mdc`, `service-patterns.mdc` |
| Optimize | `implement-optimization.mdc` | `caching-patterns.mdc`, `service-patterns.mdc` |
| Create migration | `create-migration.mdc` | `entity-patterns.mdc`, `database-migrations.mdc` |
| Refactor | `refactor-module.mdc` | `coding-practice.mdc`, `service-patterns.mdc` |
| Update packages | `update-packages.mdc` | `dependency-management.mdc` |
| Maintain repository | `maintain-repository.mdc` | `dependency-management.mdc`, `database-migrations.mdc` |

### File Locations

- **Rules:** `.cursor/rules/*.mdc`
- **Commands:** `.cursor/commands/*.mdc`
- **Documentation:** `.cursor/docs/`
- **Context:** `.cursor/docs/context/`
- **File Index:** `.cursor/FILE_INDEX.md` - **Use this to find any file in the project**

## Troubleshooting

### AI Not Following Patterns

**Problem:** AI generates code that doesn't follow your patterns

**Solution:**
```
Please review [rule-file].mdc and ensure this code follows those patterns exactly
```

### Missing Steps in Workflow

**Problem:** AI skips steps in a command workflow

**Solution:**
```
Please follow [command-file].mdc step by step. Let's go through each step:
1. [First step]
2. [Second step]
...
```

### Inconsistent Code Style

**Problem:** Code doesn't match project style

**Solution:**
```
Please review coding-practice.mdc and ensure this code follows all the conventions listed there
```

## Getting Help

If you're unsure which command or rule to use:

1. **Check the command file** - Each command has a clear purpose
2. **Review rule files** - Rules explain patterns and best practices
3. **Ask AI:** "Which command should I use for [task]?"
4. **Check examples** - See scenarios above

## Summary

- **Rules** = Always active patterns and standards
- **Commands** = Step-by-step workflows for tasks
- **Reference both** in your prompts for best results
- **Use Composer** for most development tasks
- **Document changes** after every modification
- **Be specific** about requirements and patterns

Happy coding! 🚀

