import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function readKey(label: string, value: string | undefined): Buffer {
  if (!value) {
    throw new Error(`${label}_MISSING`);
  }

  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) {
    throw new Error(`${label}_INVALID`);
  }

  return key;
}

function decryptSecretWithKey(payload: string, key: Buffer): string {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

function encryptSecretWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

async function main() {
  const prisma = new PrismaClient();
  const oldKey = readKey('OLD_MFA_MASTER_KEY', process.env.OLD_MFA_MASTER_KEY);
  const newKey = readKey('MFA_MASTER_KEY', process.env.MFA_MASTER_KEY);
  const dryRun = process.argv.includes('--dry-run');

  const factors = await prisma.mfaFactor.findMany({
    select: {
      id: true,
      secretEncrypted: true
    }
  });

  let rotated = 0;
  let alreadyRotated = 0;

  try {
    for (const factor of factors) {
      try {
        const plaintext = decryptSecretWithKey(factor.secretEncrypted, oldKey);
        const reencrypted = encryptSecretWithKey(plaintext, newKey);
        const verification = decryptSecretWithKey(reencrypted, newKey);
        if (verification !== plaintext) {
          throw new Error(`REENCRYPT_VERIFY_FAILED:${factor.id}`);
        }

        if (!dryRun) {
          await prisma.mfaFactor.update({
            where: { id: factor.id },
            data: { secretEncrypted: reencrypted }
          });
        }
        rotated += 1;
      } catch (error) {
        try {
          decryptSecretWithKey(factor.secretEncrypted, newKey);
          alreadyRotated += 1;
        } catch {
          throw error;
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }

  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        dry_run: dryRun,
        total_factors: factors.length,
        rotated,
        already_rotated: alreadyRotated
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
