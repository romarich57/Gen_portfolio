import { readFileSync } from 'node:fs';

const files = [
  'apps/backend/.env.example',
  'apps/backend/.env.prod.expected'
];

function parseEnvKeys(source) {
  const seen = new Set();
  const duplicates = [];
  const invalid = [];

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      invalid.push(line);
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    const value = normalized.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      invalid.push(line);
      continue;
    }

    if (seen.has(key) && !duplicates.includes(key)) {
      duplicates.push(key);
    }
    seen.add(key);
  }

  return { duplicates, invalid };
}

const failures = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const { duplicates, invalid } = parseEnvKeys(source);

  if (duplicates.length > 0) {
    failures.push(`${file}: duplicate keys -> ${duplicates.join(', ')}`);
  }
  if (invalid.length > 0) {
    failures.push(`${file}: invalid lines -> ${invalid.join(' | ')}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated env examples: ${files.join(', ')}`);
