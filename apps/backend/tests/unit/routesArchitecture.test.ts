import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const routesRoot = path.resolve(__dirname, '../../src/routes');
const srcRoot = path.resolve(__dirname, '../../src');

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

test('routes do not import db/prisma directly', () => {
  const files = walk(routesRoot);
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('db/prisma')) {
      offenders.push(path.relative(routesRoot, file));
    }
  }

  assert.deepEqual(offenders, []);
});

test('routes do not reference prisma client directly', () => {
  const files = walk(routesRoot);
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (/\bprisma\./.test(content)) {
      offenders.push(path.relative(routesRoot, file));
    }
  }

  assert.deepEqual(offenders, []);
});

test('routes do not reference legacy router artifacts', () => {
  const files = walk(routesRoot);
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('legacy.router') || content.includes('createLegacyRouteProxy')) {
      offenders.push(path.relative(routesRoot, file));
    }
  }

  assert.deepEqual(offenders, []);
});

test('source does not reference legacy route proxy artifacts', () => {
  const files = walk(srcRoot);
  const offenders: string[] = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('legacy.router') || content.includes('createLegacyRouteProxy')) {
      offenders.push(path.relative(srcRoot, file));
    }
  }

  assert.deepEqual(offenders, []);
});
