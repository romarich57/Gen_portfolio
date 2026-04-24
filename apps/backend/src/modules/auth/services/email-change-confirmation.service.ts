import { Prisma } from '@prisma/client';
import { prisma } from '../../../db/prisma';
import { writeAuditLog } from '../../../services/audit';
import { sendEmailChangedNotification } from '../../../services/accountChangeNotifications';
import { revokeAllSessions } from '../../../services/session';
import { hashToken } from '../../../utils/crypto';
import {
  signActionConfirmationToken,
  verifyActionConfirmationToken
} from '../../../utils/jwt';

type EmailActionMeta = {
  ip?: string | null | undefined;
};

function assertRequestUsable(request: {
  expiresAt: Date;
  completedAt: Date | null;
  cancelledAt: Date | null;
}) {
  if (request.completedAt || request.cancelledAt) {
    throw new Error('TOKEN_INVALID');
  }
  if (request.expiresAt < new Date()) {
    throw new Error('TOKEN_EXPIRED');
  }
}

export async function createEmailChangeConfirmation(token: string, requestId: string) {
  const verifyTokenHash = hashToken(token);
  const request = await prisma.emailChangeRequest.findUnique({
    where: { verifyTokenHash }
  });
  if (!request) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  const user = await prisma.user.findUnique({ where: { id: request.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: request.newEmail, mode: 'insensitive' },
      id: { not: request.userId }
    }
  });
  if (existing) {
    throw new Error('EMAIL_UNAVAILABLE');
  }

  const confirmationToken = signActionConfirmationToken(
    {
      sub: request.userId,
      type: 'action_confirmation',
      action: 'email_change_verify',
      sourceTokenHash: verifyTokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function confirmEmailChange(confirmationToken: string, meta: EmailActionMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_change_verify') {
    throw new Error('TOKEN_INVALID');
  }

  const request = await prisma.emailChangeRequest.findUnique({
    where: { verifyTokenHash: payload.sourceTokenHash }
  });
  if (!request || request.userId !== payload.sub) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: request.newEmail, mode: 'insensitive' },
      id: { not: request.userId }
    }
  });
  if (existing) {
    throw new Error('EMAIL_UNAVAILABLE');
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: request.userId },
        data: {
          email: request.newEmail,
          emailVerifiedAt: new Date()
        }
      });

      await tx.emailChangeRequest.update({
        where: { id: request.id },
        data: { completedAt: new Date() }
      });

      await tx.emailChangeRequest.deleteMany({
        where: {
          userId: request.userId,
          id: { not: request.id }
        }
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('EMAIL_UNAVAILABLE');
    }
    throw error;
  }

  await revokeAllSessions(request.userId);

  await writeAuditLog({
    actorUserId: request.userId,
    actorIp: meta.ip ?? null,
    action: 'EMAIL_CHANGED',
    targetType: 'user',
    targetId: request.userId,
    metadata: { old_email: request.oldEmail, new_email: request.newEmail },
    requestId
  });

  await sendEmailChangedNotification({
    oldEmail: request.oldEmail,
    newEmail: request.newEmail
  }).catch(() => undefined);
}

export async function createEmailChangeCancelConfirmation(token: string, requestId: string) {
  const cancelTokenHash = hashToken(token);
  const request = await prisma.emailChangeRequest.findUnique({
    where: { cancelTokenHash }
  });
  if (!request) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  const confirmationToken = signActionConfirmationToken(
    {
      sub: request.userId,
      type: 'action_confirmation',
      action: 'email_change_cancel',
      sourceTokenHash: cancelTokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function cancelEmailChange(confirmationToken: string, meta: EmailActionMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'email_change_cancel') {
    throw new Error('TOKEN_INVALID');
  }

  const request = await prisma.emailChangeRequest.findUnique({
    where: { cancelTokenHash: payload.sourceTokenHash }
  });
  if (!request || request.userId !== payload.sub) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  await prisma.emailChangeRequest.update({
    where: { id: request.id },
    data: { cancelledAt: new Date() }
  });

  await writeAuditLog({
    actorUserId: request.userId,
    actorIp: meta.ip ?? null,
    action: 'EMAIL_CHANGE_CANCELLED',
    targetType: 'user',
    targetId: request.userId,
    metadata: { old_email: request.oldEmail, new_email: request.newEmail },
    requestId
  });
}
