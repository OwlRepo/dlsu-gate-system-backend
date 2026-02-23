/**
 * Setup/regenerate .cursor integration files based on project detection.
 * Detects: backend NestJS, TypeORM, modules from src/
 * Creates minimal .mdc stubs so indexer and pre-commit work immediately.
 * Usage: bun run scripts/setup-cursor-integration.ts
 * Hard Rule A: All .cursor docs use .mdc extension only.
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function detectModules(): string[] {
  const srcDir = path.join(ROOT, 'src');
  if (!fs.existsSync(srcDir)) return [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name)
    .sort();
}

function detectTechStack(pkg: Record<string, unknown>): Record<string, string> {
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>;
  return {
    nest: deps['@nestjs/core'] || '',
    typeorm: deps['typeorm'] || deps['@nestjs/typeorm'] || '',
    pg: deps['pg'] || '',
    redis: deps['ioredis'] || deps['redis'] || '',
    socketio: deps['socket.io'] || deps['@nestjs/platform-socket.io'] || '',
  };
}

function writeStub(filePath: string, title: string, body: string): void {
  const fullPath = path.join(ROOT, '.cursor', filePath);
  const dir = path.dirname(fullPath);
  ensureDir(dir);
  const content = `# ${title}

Last updated: ${TODAY}

${body}
`;
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log('  Created:', filePath);
}

function main(): void {
  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('No package.json found');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>;
  const hasNest = !!deps['@nestjs/core'];
  const hasTypeorm = !!(deps['typeorm'] || deps['@nestjs/typeorm']);

  const projectType = 'backend';
  const modules = detectModules();
  const tech = detectTechStack(pkg);

  console.log('Project type:', projectType);
  console.log('Tech: NestJS, TypeORM, PostgreSQL, Redis, Socket.io');
  console.log('Modules:', modules.join(', '));

  ensureDir(path.join(ROOT, '.cursor'));
  ensureDir(path.join(ROOT, '.cursor/architecture'));
  ensureDir(path.join(ROOT, '.cursor/file-index'));
  ensureDir(path.join(ROOT, '.cursor/debugging'));
  ensureDir(path.join(ROOT, '.cursor/rules'));
  ensureDir(path.join(ROOT, '.cursor/commands'));
  ensureDir(path.join(ROOT, '.cursor/maintenance'));

  console.log('\nCreating .mdc stubs...');

  // Core files (do not overwrite CURSOR_INTEGRATION.mdc)
  const entryPointPath = path.join(ROOT, '.cursor', 'rules', 'entry-point.mdc');
  ensureDir(path.dirname(entryPointPath));
  fs.writeFileSync(
    entryPointPath,
    `---
alwaysApply: true
---

# Entry Point

Last updated: ${TODAY}

Primary entry point. Load @.cursor/rules/entry-point.mdc first (Hard Rule B). Intent detection, file discovery, rule routing, planning gate.
`,
    'utf-8'
  );
  console.log('  Created: rules/entry-point.mdc');
  writeStub('README.mdc', 'Cursor Integration Overview', 'System overview and usage. See CURSOR_INTEGRATION.mdc for full spec.');
  writeStub('CURSOR_USAGE_GUIDE.mdc', 'Cursor Usage Guide', 'Project-tailored handbook. Regenerate with: "Analyze the codebase and regenerate all .cursor/ files according to @.cursor/CURSOR_INTEGRATION.mdc"');

  // Architecture (backend)
  writeStub('architecture/overview.mdc', 'Architecture Overview', 'System architecture, module relationships, data flow. Add mermaid diagrams.');
  writeStub('architecture/tech-stack.mdc', 'Tech Stack', `NestJS ${tech.nest}, TypeORM ${tech.typeorm}, PostgreSQL, Redis, Socket.io.`);
  writeStub('architecture/api-integration.mdc', 'API Integration', 'REST patterns, Swagger, auth, error handling.');
  writeStub('architecture/module-structure.mdc', 'Module Structure', `Modules: ${modules.join(', ')}.`);
  writeStub('architecture/database.mdc', 'Database', 'TypeORM, entities, migrations, data-source.');
  writeStub('architecture/service-patterns.mdc', 'Service Patterns', 'NestJS services, dependency injection, module boundaries.');

  // File indexes (backend)
  writeStub('file-index/src-index.mdc', 'Source Index', 'Full src/ directory tree. Update when structure changes.');
  writeStub('file-index/utils-index.mdc', 'Utils Index', 'config, common, decorators, interceptors.');
  writeStub('file-index/controllers-index.mdc', 'Controllers Index', 'All *.controller.ts files.');
  writeStub('file-index/services-index.mdc', 'Services Index', 'All *.service.ts and services/*.ts files.');
  writeStub('file-index/models-index.mdc', 'Models Index', 'All entities/*.entity.ts files.');

  // Debugging
  writeStub('debugging/workflow.mdc', 'Debugging Workflow', 'Reproduce → identify → RCA → fix → test.');
  writeStub('debugging/root-cause-analysis.mdc', 'Root Cause Analysis', 'RCA template: problem, affected areas, root cause, impact, solution.');
  writeStub('debugging/common-issues.mdc', 'Common Issues', 'Known issues database with solutions.');
  writeStub('debugging/fix-plan-template.mdc', 'Fix Plan Template', 'Standardized fix plan format.');

  // Rules
  writeStub('rules/bug-fix.mdc', 'Bug Fix Rules', 'Reproduce first, use RCA, test thoroughly.');
  writeStub('rules/feature-implementation.mdc', 'Feature Implementation Rules', 'Follow architecture, use patterns, create types, error handling.');
  writeStub('rules/enhancement.mdc', 'Enhancement Rules', 'Understand current, identify improvements, maintain compatibility.');
  writeStub('rules/refactoring.mdc', 'Refactoring Rules', 'Maintain functionality, follow style, update related files.');
  writeStub('rules/code-review.mdc', 'Code Review Rules', 'Check patterns, error handling, performance.');
  writeStub('rules/testing.mdc', 'Testing Rules', 'Happy paths, error cases, edge cases.');
  writeStub('rules/automation-guidelines.mdc', 'Automation Guidelines', 'When to proceed automatically vs ask questions.');

  // Commands (optional templates)
  writeStub('commands/bug-report.mdc', 'Bug Report Template', 'Description, steps, expected/actual, environment.');
  writeStub('commands/new-feature.mdc', 'New Feature Template', 'Description, requirements, acceptance criteria.');
  writeStub('commands/enhancement.mdc', 'Enhancement Template', 'Current behavior, desired improvement, benefits.');
  writeStub('commands/refactor.mdc', 'Refactor Template', 'Code, reason, scope.');
  writeStub('commands/code-review.mdc', 'Code Review Template', 'Files, focus areas.');

  // Maintenance
  writeStub('maintenance/update-workflow.mdc', 'Update Workflow', 'When and how to update .cursor files.');
  writeStub('maintenance/update-checklist.mdc', 'Update Checklist', 'Maintenance checklist.');
  writeStub('maintenance/auto-update-guide.mdc', 'Auto-Update Guide', 'AI auto-update instructions.');

  // AGENTS.md (Cursor built-in trigger)
  const agentsPath = path.join(ROOT, 'AGENTS.md');
  fs.writeFileSync(agentsPath, 'For any task, load @.cursor/rules/entry-point.mdc first and follow its workflow.\n', 'utf-8');
  console.log('  Created: AGENTS.md');

  console.log('\nDone. Run "bun run scripts/update-cursor-indexes.ts --dry-run" to verify indexer.');
}

main();
