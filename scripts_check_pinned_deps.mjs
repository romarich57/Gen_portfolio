import fs from 'fs';
import path from 'path';

const files = [
  'apps/backend/package.json',
  'apps/frontend/package.json',
  'frontends_admin/package.json'
];

const isPinned = (value) =>
  typeof value === 'string' && !value.startsWith('^') && !value.startsWith('~') && !value.includes('*') && !value.includes('x');

const violations = [];

for (const rel of files) {
  const full = path.resolve(process.cwd(), rel);
  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const deps = data[section] || {};
    for (const [name, version] of Object.entries(deps)) {
      if (!isPinned(version)) {
        violations.push(`${rel} :: ${section} :: ${name}=${version}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Unpinned dependency versions detected:');
  for (const item of violations) console.error(`- ${item}`);
  process.exit(1);
}

console.log('All dependency versions are pinned exactly.');
