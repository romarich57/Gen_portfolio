import fs from 'fs';
import path from 'path';
import { isIP } from 'node:net';

export function findDuplicateEnvKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) {
      duplicates.add(key);
      continue;
    }
    seen.add(key);
  }

  return Array.from(duplicates);
}

export function findDuplicateEnvKeysInEnvSource(source: string): string[] {
  const keys: string[] = [];

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const normalized = line.startsWith('export ') ? line.slice('export '.length).trim() : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    keys.push(key);
  }

  return findDuplicateEnvKeys(keys);
}

export function resolveDotenvPath(explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  return path.resolve(process.cwd(), '.env');
}

export function loadEnvFileSource(filePath: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath, 'utf8');
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIpOrCidr(value: string): boolean {
  const [rawAddress, rawPrefix] = value.split('/');
  const address = rawAddress?.trim() ?? '';
  if (!address) {
    return false;
  }

  const family = isIP(address);
  if (!family) {
    return false;
  }

  if (rawPrefix === undefined) {
    return true;
  }

  if (!/^\d+$/u.test(rawPrefix)) {
    return false;
  }

  const prefix = Number(rawPrefix);
  const max = family === 4 ? 32 : 128;
  return prefix >= 0 && prefix <= max;
}
