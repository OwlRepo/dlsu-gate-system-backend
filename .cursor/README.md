# Cursor AI Integration - DLSU Gate System Backend

## Overview

This directory contains the Cursor AI integration system for the DLSU Gate System Backend—a NestJS + TypeORM API server. The system provides automated context, file discovery, rules, and planning workflows for AI-assisted development.

## Project Type

- **Backend** (NestJS, TypeORM, PostgreSQL, Redis)
- **Non-monorepo** (single package at repository root)

## Key Files

- **entry-point.md** — Primary entry point; routes prompts by intent and applies relevant rules
- **CURSOR_INTEGRATION.md** — Master regeneration prompt and file specifications
- **CURSOR_USAGE_GUIDE.md** — Project-tailored usage handbook and prompt examples

## Directory Structure

```
.cursor/
├── README.md
├── CURSOR_INTEGRATION.md
├── CURSOR_USAGE_GUIDE.md
├── entry-point.md
├── architecture/
├── file-index/
├── debugging/
├── rules/
├── commands/
└── maintenance/
```

## Usage

Reference `@.cursor/entry-point.md` or simply describe what you need—the system detects intent and applies appropriate rules automatically. No need to reference command files or rules explicitly.

## Maintenance

- File indexes are updated on commit via pre-commit hook (when configured)
- Manual update: `npm run cursor:update-indexes` or `bun run scripts/update-cursor-indexes.ts`
- Regenerate all files: `npm run cursor:setup` or `bun run scripts/setup-cursor-integration.ts`
