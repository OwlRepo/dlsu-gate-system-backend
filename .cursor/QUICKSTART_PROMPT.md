# Quickstart Prompt for NestJS Projects

Use this prompt in Cursor to automatically generate all `.cursor` rules and commands files for your NestJS project. **This prompt is context-aware** - it will analyze your current project structure and adapt the rules accordingly.

## Copy & Paste This Prompt

```
I need to set up a comprehensive Cursor rules and commands system for my NestJS backend project. 

## Step 1: Analyze Current Project (Context-Aware)

BEFORE creating any files, please:

1. **Analyze the project structure:**
   - Review `src/` directory structure
   - Identify existing modules and their patterns
   - Check `package.json` for dependencies (TypeORM, Swagger, Redis, etc.)
   - Review `app.module.ts` for module registration patterns
   - Check existing entity, DTO, service, and controller files

2. **Extract project-specific patterns:**
   - File naming conventions (check existing files)
   - Import organization patterns (check existing imports)
   - Module structure patterns (check existing modules)
   - Authentication patterns (check auth guards, JWT setup)
   - Caching patterns (check cache decorators, CacheService usage)
   - Error handling patterns (check exception usage)
   - Database patterns (check entity definitions, migration structure)

3. **Identify technology stack:**
   - Database ORM (TypeORM, Prisma, etc.)
   - Authentication library (Passport, JWT, etc.)
   - Caching solution (Redis, in-memory, etc.)
   - API documentation (Swagger, etc.)
   - Testing framework (Jest, etc.)

4. **Note project-specific conventions:**
   - Naming conventions (snake_case vs camelCase for database)
   - Module organization
   - Service patterns
   - Controller patterns
   - Any custom decorators or utilities

## Step 2: Create Rules and Commands

Based on the analysis above, create the following structure in the `.cursor/` directory, **adapting all patterns to match the current project**:

## Directory Structure
- `.cursor/rules/` - Best practices and patterns
- `.cursor/commands/` - Step-by-step workflows
- `.cursor/FILE_INDEX.md` - **CRITICAL:** Comprehensive file index and project structure map (must be created to help AI navigate codebase)
- `.cursor/docs/` - Auto-generated documentation

## Rules Files to Create (in `.cursor/rules/`)

1. **coding-practice.mdc** - TypeScript/NestJS coding standards, file naming, import organization, code formatting
2. **dto-patterns.mdc** - DTO creation, validation decorators, Swagger documentation, naming conventions
3. **entity-patterns.mdc** - TypeORM entity definitions, column types, relationships, migration considerations
4. **controller-patterns.mdc** - Controller structure, route decorators, Swagger docs, authentication/authorization
5. **service-patterns.mdc** - Service layer standards, repository injection, business logic, error handling
6. **database-migrations.mdc** - Migration generation, schema changes, rollback strategies, safety guidelines
7. **authentication-patterns.mdc** - JWT authentication, role-based access control, guards, public routes
8. **caching-patterns.mdc** - Redis caching strategies, cache decorators, invalidation, TTL management
9. **debugging-practice.mdc** - Error handling, exception patterns, logging standards, error response formats
10. **feature-implementation.mdc** - Module structure, NestJS patterns, dependency injection, feature checklist
11. **documentation-patterns.mdc** - Auto-documentation standards, templates, context file maintenance
12. **dependency-management.mdc** - Package management, version strategies, dependency patterns
13. **RULE_DEPENDENCIES.md** - Central mapping of tasks to rules, rule relationships, quick reference

Each rule file should:
- Have `alwaysApply: true` in frontmatter (except RULE_DEPENDENCIES.md)
- Include "Related Rules" section with cross-references
- Include "When to Use" section
- **Use actual patterns from the analyzed project** (not generic examples)
- **Include code examples that match the project's existing code style**
- Follow the project's specific conventions (naming, structure, etc.)

## Commands Files to Create (in `.cursor/commands/`)

1. **implement-feature.mdc** - Complete feature implementation workflow (entity, DTOs, service, controller, module, migration)
2. **implement-bugfix.mdc** - Bug fixing workflow (identify, isolate, fix, verify, document)
3. **implement-optimization.mdc** - Performance optimization workflow (identify bottlenecks, optimize, measure)
4. **add-endpoint.mdc** - Add new API endpoint workflow (DTO, service, controller, Swagger, auth, caching)
5. **create-migration.mdc** - Database migration workflow (modify entity, generate, review, test)
6. **refactor-module.mdc** - Module refactoring workflow (identify needs, plan, refactor, test, document)
7. **document-changes.mdc** - Auto-documentation workflow (analyze changes, generate docs, update context)
8. **update-packages.mdc** - Package update workflow (check outdated, update safely, test, document)
9. **maintain-repository.mdc** - Repository maintenance workflow (health checks, updates, cleanup)

Each command file should:
- Have `alwaysApply: true` in frontmatter
- Include comprehensive "Related Rules" section listing ALL applicable rules
- Add explicit rule references to each step (e.g., "**Applies Rules:** dto-patterns.mdc, coding-practice.mdc")
- Provide step-by-step workflows **that match the project's actual structure**
- Include checklists
- **Reference actual file paths and patterns from the analyzed project**

## Documentation Structure (in `.cursor/docs/`)

Create directory structure:
- `features/` - Feature documentation
- `changelog/` - Change history
- `api/` - API endpoint documentation
- `architecture/` - ADRs
- `context/` - AI context files

Create index files and templates for each directory.

## Key Requirements

1. **Context-Aware**: All patterns must match the analyzed project structure and conventions
2. **Smart Rule Application**: Commands should list ALL related rules so AI automatically applies them without user specifying each one
3. **Cross-References**: Rules should reference related rules to create a knowledge graph
4. **Project-Specific**: Use actual patterns from the project, not generic examples
5. **Technology Stack**: Adapt to the project's actual stack (TypeORM/Prisma, JWT/Passport, Redis/in-memory, etc.)
6. **Naming Conventions**: Match the project's actual naming (snake_case vs camelCase, etc.)
7. **Module Structure**: Match the project's actual module organization
8. **Error Handling**: Use the project's actual error handling patterns
9. **Documentation**: Auto-documentation system for keeping AI context updated

## Patterns to Include (Adapt to Project)

Based on the project analysis, include patterns for:
- Module structure (match the project's actual structure)
- DTO validation (use the project's validation library and patterns)
- API documentation (match the project's documentation setup)
- Entity patterns (match the project's ORM and entity structure)
- Repository/data access patterns (match the project's approach)
- Controller patterns (match the project's controller structure)
- Service patterns (match the project's service layer)
- Error handling (match the project's error handling approach)
- Database migrations (match the project's migration setup)
- Authentication flows (match the project's auth implementation)
- Authorization patterns (match the project's role/permission system)
- Caching strategies (match the project's caching implementation)
- Auto-documentation workflows

## Step 3: Generate Files

Please create all these files with comprehensive content that:
1. **Matches the analyzed project structure** - Use actual file paths, module names, and patterns from the project
2. **Follows project conventions** - Use the project's naming, organization, and style
3. **Includes project-specific examples** - Reference actual entities, DTOs, services, and controllers from the project
4. **Adapts to technology stack** - Match the actual libraries and frameworks used

The system should be intelligent enough that when a user says "add an endpoint", the AI automatically knows to apply all relevant rules without the user having to list them individually.

**Important**: All code examples should be based on actual patterns found in the project, not generic NestJS examples.
```

## How to Use

1. **Copy the prompt above**
2. **Paste it into Cursor Chat/Composer**
3. **AI will automatically:**
   - Analyze your project structure
   - Extract existing patterns
   - Adapt rules to match your project
   - Generate context-aware files
4. **Review the generated files** - They should already match your project patterns
5. **Customize if needed** - Fine-tune for any project-specific requirements

## What Gets Created

- ✅ 13 rule files with cross-references (including dependency-management.mdc)
- ✅ 9 command files with comprehensive rule lists (including update-packages.mdc and maintain-repository.mdc)
- ✅ Documentation structure
- ✅ Smart rule application system
- ✅ Quick reference guides
- ✅ Package update workflows

## After Generation

1. **Review the generated files** - They should already match your project patterns
2. **Verify examples** - Check that code examples match your actual codebase
3. **Test with a simple prompt** like "add an endpoint"
4. **Verify rules are automatically applied**

## What Makes This Context-Aware

The prompt instructs the AI to:
- ✅ Analyze your actual project structure before generating files
- ✅ Extract patterns from your existing code
- ✅ Use your actual file paths and module names
- ✅ Match your naming conventions
- ✅ Adapt to your technology stack
- ✅ Include examples from your codebase

**Result**: Generated files are tailored to your project, not generic templates!

## Customization Tips

If you need to customize after generation:
- Add project-specific patterns not detected
- Include additional team conventions
- Add more examples from your codebase
- Customize documentation templates
- Add project-specific rules

## Next Steps

Once files are generated:
1. Read `.cursor/README.md` for usage guide
2. Check `.cursor/QUICK_REFERENCE.md` for quick prompts
3. Start using commands like "follow add-endpoint.mdc to add GET /users"
4. Rules will be automatically applied!

