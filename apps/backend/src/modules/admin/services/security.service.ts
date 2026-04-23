import { UserStatus } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { buildEmailHtml, buildEmailText, buildPasswordResetLink, sendEmail } from '../../../services/email';
import { revokeAllSessions } from '../../../services/session';
import { generateRandomToken, hashToken } from '../../../utils/crypto';

type ActorContext = {
  actorUserId?: string | null | undefined;
  actorIp?: string | null | undefined;
};

export async function triggerAdminPasswordReset(
  userId: string,
  mode: 'force_reset' | 'send_link',
  actor: ActorContext,
  requestId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt
    }
  });

  if (mode === 'force_reset') {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: null }
    });
    await revokeAllSessions(user.id);
  }

  let emailSent = false;
  try {
    const resetLink = buildPasswordResetLink(rawToken);
    await sendEmail({
      to: user.email,
      subject: 'Reinitialisation de mot de passe',
      text: buildEmailText({
        title: 'Reinitialisation de mot de passe',
        intro: 'Cliquez sur le lien pour reinitialiser votre mot de passe.',
        actionLabel: 'Reinitialiser',
        actionUrl: resetLink,
        preview: 'Reinitialisation du mot de passe.',
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      }),
      html: buildEmailHtml({
        title: 'Reinitialisation de mot de passe',
        intro: 'Cliquez sur le lien pour reinitialiser votre mot de passe.',
        actionLabel: 'Reinitialiser',
        actionUrl: resetLink,
        preview: 'Reinitialisation du mot de passe.',
        outro: 'Si vous n’etes pas a l’origine de cette demande, ignorez cet email.'
      })
    });
    emailSent = true;
  } catch {
    emailSent = false;
  }

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_PASSWORD_RESET_TRIGGERED',
    targetType: 'user',
    targetId: user.id,
    metadata: { mode, email_sent: emailSent },
    requestId
  });
}

export async function forceEmailVerification(userId: string, actor: ActorContext, requestId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: new Date(), status: user.status === UserStatus.banned ? user.status : UserStatus.active }
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_FORCE_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
  });
}

export async function revokeEmailVerification(userId: string, actor: ActorContext, requestId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifiedAt: null, status: user.status === UserStatus.banned ? user.status : UserStatus.pending_email }
  });

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_REVOKE_EMAIL_VERIFIED',
    targetType: 'user',
    targetId: user.id,
    metadata: {},
    requestId
  });
}

export async function revokeUserSessions(
  userId: string,
  mode: 'all' | 'current',
  actor: ActorContext,
  requestId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error('NOT_FOUND');
  }

  if (mode === 'current') {
    const latest = await prisma.session.findFirst({
      where: { userId: user.id, revokedAt: null },
      orderBy: { lastUsedAt: 'desc' }
    });
    if (latest) {
      await prisma.session.update({ where: { id: latest.id }, data: { revokedAt: new Date() } });
    }
  } else {
    await revokeAllSessions(user.id);
  }

  await writeAuditLog({
    actorUserId: actor.actorUserId ?? null,
    actorIp: actor.actorIp ?? null,
    action: 'ADMIN_SESSIONS_REVOKED',
    targetType: 'user',
    targetId: user.id,
    metadata: { mode },
    requestId
  });
}
