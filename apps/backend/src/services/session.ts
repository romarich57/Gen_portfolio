import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { hashToken, generateRandomToken } from '../utils/crypto';
import { signAccessToken } from '../utils/jwt';

export async function createSession(params: {
  userId: string;
  roles: string[];
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}) {
  const refreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(refreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      refreshTokenHash,
      expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      deviceFingerprint: params.deviceFingerprint ?? null,
      lastUsedAt: now
    }
  });

  const accessToken = signAccessToken(
    { sub: params.userId, roles: params.roles },
    env.accessTokenTtlMinutes
  );

  return { session, accessToken, refreshToken };
}

export async function rotateSession(params: {
  sessionId: string;
  userId: string;
  roles: string[];
  ip?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
}) {
  const refreshToken = generateRandomToken(48);
  const refreshTokenHash = hashToken(refreshToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  const newSession = await prisma.session.create({
    data: {
      userId: params.userId,
      refreshTokenHash,
      expiresAt,
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      deviceFingerprint: params.deviceFingerprint ?? null,
      lastUsedAt: now
    }
  });

  await prisma.session.update({
    where: { id: params.sessionId },
    data: {
      rotatedAt: now,
      replacedBySessionId: newSession.id,
      lastUsedAt: now
    }
  });

  const accessToken = signAccessToken(
    { sub: params.userId, roles: params.roles },
    env.accessTokenTtlMinutes
  );

  return { session: newSession, accessToken, refreshToken };
}

export async function revokeSession(sessionId: string) {
  return prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() }
  });
}

export async function revokeAllSessions(userId: string) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
