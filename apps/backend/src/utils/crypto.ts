import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { env } from '../config/env';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const BACKUP_CODE_BYTES = 8;

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function generateBackupCode(): string {
  return generateRandomToken(BACKUP_CODE_BYTES);
}

export function hashToken(token: string): string {
  return createHmac('sha256', env.tokenHashSecret).update(token).digest('hex');
}

export function hashBackupCode(code: string): string {
  return createHmac('sha256', env.backupCodePepper).update(code).digest('hex');
}

export function encryptSecret(plaintext: string): string {
  const key = Buffer.from(env.mfaMasterKey, 'base64');
  if (key.length !== 32) {
    throw new Error('INVALID_MFA_MASTER_KEY');
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const key = Buffer.from(env.mfaMasterKey, 'base64');
  if (key.length !== 32) {
    throw new Error('INVALID_MFA_MASTER_KEY');
  }
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

export function base64UrlEncode(input: Buffer): string {
  return input.toString('base64url');
}

export function pkceChallenge(verifier: string): string {
  const digest = createHash('sha256').update(verifier).digest();
  return base64UrlEncode(digest);
}
