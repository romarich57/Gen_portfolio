import { prisma } from '../db/prisma';

export type MfaPolicy = {
  requiredGlobal: boolean;
};

const CACHE_TTL_MS = 60 * 1000;
let cached: { value: MfaPolicy; fetchedAt: number } | null = null;

export async function getMfaPolicy(): Promise<MfaPolicy> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const globalFlag = await prisma.featureFlag.findUnique({ where: { key: 'mfa_required_global' } });
  const policy: MfaPolicy = { requiredGlobal: globalFlag?.valueBoolean ?? false };
  cached = { value: policy, fetchedAt: now };
  return policy;
}

export function isMfaRequired(
  user: { mfaRequiredOverride: boolean | null; mfaEnabled: boolean },
  policy: MfaPolicy
): boolean {
  if (user.mfaRequiredOverride !== null && user.mfaRequiredOverride !== undefined) {
    return user.mfaRequiredOverride;
  }
  return policy.requiredGlobal;
}

export function resetMfaPolicyCache() {
  cached = null;
}
