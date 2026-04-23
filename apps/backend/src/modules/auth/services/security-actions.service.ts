import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { signActionConfirmationToken, verifyActionConfirmationToken } from '../../../utils/jwt';
import { hashToken } from '../../../utils/crypto';

type SecurityMeta = {
  ip?: string | null | undefined;
};

type SecurityAction = 'REVOKE_SESSIONS' | 'ACK_ALERT';

const actionConfig: Record<
  SecurityAction,
  { confirmationAction: 'security_revoke_sessions' | 'security_acknowledge_alert'; successAudit: string }
> = {
  REVOKE_SESSIONS: {
    confirmationAction: 'security_revoke_sessions',
    successAudit: 'SESSIONS_REVOKED_FROM_ALERT'
  },
  ACK_ALERT: {
    confirmationAction: 'security_acknowledge_alert',
    successAudit: 'SECURITY_ALERT_ACKNOWLEDGED'
  }
};

export async function createSecurityActionConfirmation(
  token: string,
  action: SecurityAction,
  requestId: string
) {
  const tokenHash = hashToken(token);
  const record = await prisma.securityActionToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date() || record.action !== action) {
    throw new Error('TOKEN_INVALID');
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: record.userId,
      type: 'action_confirmation',
      action: actionConfig[action].confirmationAction,
      sourceTokenHash: tokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function confirmSecurityAction(
  confirmationToken: string,
  action: SecurityAction,
  meta: SecurityMeta,
  requestId: string
) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== actionConfig[action].confirmationAction) {
    throw new Error('TOKEN_INVALID');
  }

  const record = await prisma.securityActionToken.findUnique({ where: { tokenHash: payload.sourceTokenHash } });
  if (!record || record.userId !== payload.sub || record.usedAt || record.expiresAt < new Date() || record.action !== action) {
    throw new Error('TOKEN_INVALID');
  }

  const now = new Date();
  if (action === 'REVOKE_SESSIONS') {
    await prisma.$transaction([
      prisma.securityActionToken.update({
        where: { id: record.id },
        data: { usedAt: now }
      }),
      prisma.session.updateMany({
        where: { userId: record.userId },
        data: { revokedAt: now }
      })
    ]);
  } else {
    await prisma.securityActionToken.update({
      where: { id: record.id },
      data: { usedAt: now }
    });
  }

  await writeAuditLog({
    actorUserId: record.userId,
    actorIp: meta.ip ?? null,
    action: actionConfig[action].successAudit,
    targetType: 'user',
    targetId: record.userId,
    metadata: {},
    requestId
  });
}
