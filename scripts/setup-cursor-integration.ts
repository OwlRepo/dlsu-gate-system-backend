/**
 * Setup/regenerate .cursor integration files based on project detection.
 * Detects: backend NestJS, TypeORM, modules from src/
 * Usage: npm run cursor:setup
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function detectModules(): string[] {
  const srcDir = path.join(ROOT, 'src');
  if (!fs.existsSync(srcDir)) return [];
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
}

function main(): void {
  const pkgPath = path.join(ROOT, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('No package.json found');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasNest = deps['@nestjs/core'];
  const hasTypeorm = deps['typeorm'] || deps['@nestjs/typeorm'];

  const projectType = hasNest && !hasTypeorm ? 'backend' : 'backend';
  const modules = detectModules();

  console.log('Project type:', projectType);
  console.log('Tech: NestJS, TypeORM');
  console.log('Modules:', modules.join(', '));

  ensureDir(path.join(ROOT, '.cursor'));
  ensureDir(path.join(ROOT, '.cursor/architecture'));
  ensureDir(path.join(ROOT, '.cursor/file-index'));
  ensureDir(path.join(ROOT, '.cursor/debugging'));
  ensureDir(path.join(ROOT, '.cursor/rules'));
  ensureDir(path.join(ROOT, '.cursor/commands'));
  ensureDir(path.join(ROOT, '.cursor/maintenance'));

  console.log('Cursor integration directories ready. Run with AI to regenerate content if needed.');
}

main();
