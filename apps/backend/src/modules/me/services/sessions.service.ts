import { prisma } from '../../../db/prisma';
import { revokeAllSessions, revokeSession } from '../../../services/session';
import { getIpLocation } from '../../../utils/ipLocation';
import { getCurrentSession } from '../shared/service-helpers';

export async function listActiveSessionsForUser(params: {
  userId: string;
  refreshToken?: string | undefined;
}) {
  const currentSession = await getCurrentSession(params.refreshToken);
  const sessions = await prisma.session.findMany({
    where: { userId: params.userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastUsedAt: 'desc' }
  });

  return sessions.map((session) => ({
    id: session.id,
    created_at: session.createdAt,
    last_used_at: session.lastUsedAt,
    expires_at: session.expiresAt,
    ip: session.ip,
    user_agent: session.userAgent,
    location: getIpLocation(session.ip),
    current: currentSession?.id === session.id
  }));
}

export async function listSessionHistoryForUser(params: {
  userId: string;
  refreshToken?: string | undefined;
}) {
  const currentSession = await getCurrentSession(params.refreshToken);
  const sessions = await prisma.session.findMany({
    where: { userId: params.userId },
    orderBy: { lastUsedAt: 'desc' },
    take: 25
  });

  const now = Date.now();
  return sessions.map((session) => {
    let status: 'active' | 'revoked' | 'expired' = 'active';
    if (session.revokedAt) status = 'revoked';
    else if (session.expiresAt.getTime() <= now) status = 'expired';

    return {
      id: session.id,
      created_at: session.createdAt,
      last_used_at: session.lastUsedAt,
      expires_at: session.expiresAt,
      revoked_at: session.revokedAt,
      rotated_at: session.rotatedAt,
      replaced_by_session_id: session.replacedBySessionId,
      ip: session.ip,
      user_agent: session.userAgent,
      device_fingerprint: session.deviceFingerprint,
      location: getIpLocation(session.ip),
      current: currentSession?.id === session.id,
      status
    };
  });
}

export async function revokeSingleSessionForUser(params: {
  userId: string;
  sessionId: string;
  refreshToken?: string | undefined;
}) {
  const session = await prisma.session.findFirst({
    where: { id: params.sessionId, userId: params.userId }
  });

  if (!session) {
    throw new Error('NOT_FOUND');
  }

  await revokeSession(session.id);
  const currentSession = await getCurrentSession(params.refreshToken);

  return {
    sessionId: session.id,
    clearCookies: currentSession?.id === session.id
  };
}

export async function revokeAllSessionsForUser(params: {
  userId: string;
  includeCurrent: boolean;
  refreshToken?: string | undefined;
}) {
  const currentSession = await getCurrentSession(params.refreshToken);

  if (params.includeCurrent) {
    await revokeAllSessions(params.userId);
    return { clearCookies: true };
  }

  if (currentSession) {
    await prisma.session.updateMany({
      where: { userId: params.userId, revokedAt: null, id: { not: currentSession.id } },
      data: { revokedAt: new Date() }
    });
    return { clearCookies: false };
  }

  await revokeAllSessions(params.userId);
  return { clearCookies: false };
}
