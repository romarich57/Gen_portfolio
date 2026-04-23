import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const srcRoot = path.resolve(__dirname, '../../src');
const routesRoot = path.resolve(srcRoot, 'routes');
const modulesRoot = path.resolve(srcRoot, 'modules');
const legacyDomainsRoot = path.resolve(srcRoot, 'domains');

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function read(filePath: string) {
  return fs.readFileSync(filePath, 'utf8');
}

function relativeFromSrc(filePath: string) {
  return path.relative(srcRoot, filePath);
}

function countLines(filePath: string) {
  return read(filePath).split('\n').length;
}

test('source outside legacy domains does not import legacy domains', () => {
  const offenders = walk(srcRoot)
    .filter((filePath) => !filePath.includes(`${path.sep}domains${path.sep}`))
    .filter((filePath) => /from\s+['"][^'"]*domains\//.test(read(filePath)))
    .map(relativeFromSrc);

  assert.deepEqual(offenders, []);
});

test('legacy domains directory does not contain source files anymore', () => {
  const legacyDomainFiles = walk(legacyDomainsRoot).map(relativeFromSrc);
  assert.deepEqual(legacyDomainFiles, []);
});

test('route files are not one-line re-exports', () => {
  const offenders = walk(routesRoot)
    .filter((filePath) => {
      const content = read(filePath).trim();
      return /^export\s+\{[^}]+\}\s+from\s+['"][^'"]+['"];?$/.test(content);
    })
    .map(relativeFromSrc);

  assert.deepEqual(offenders, []);
});

test('routes and handlers do not import prisma client directly', () => {
  const candidateRoots = [routesRoot, path.resolve(srcRoot, 'modules')];
  const offenders: string[] = [];

  for (const root of candidateRoots) {
    for (const filePath of walk(root)) {
      const relativePath = relativeFromSrc(filePath);
      const isRouteOrHandler =
        relativePath.includes('/routes/') ||
        relativePath.startsWith('routes/') ||
        relativePath.includes('/handlers/');

      if (!isRouteOrHandler) continue;

      const content = read(filePath);
      if (content.includes('db/prisma') || /\bprisma\./.test(content)) {
        offenders.push(relativePath);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test('routes and modules files stay under 400 lines', () => {
  const candidateRoots = [routesRoot, modulesRoot];
  const offenders: Array<{ file: string; lines: number }> = [];

  for (const root of candidateRoots) {
    for (const filePath of walk(root)) {
      const lines = countLines(filePath);
      if (lines > 400) {
        offenders.push({
          file: relativeFromSrc(filePath),
          lines
        });
      }
    }
  }

  assert.deepEqual(offenders, []);
});
