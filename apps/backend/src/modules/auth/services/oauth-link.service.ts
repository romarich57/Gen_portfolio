import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import {
  sendOAuthLinkApprovedNotification,
  sendOAuthLinkRequestNotification
} from '../../../services/accountChangeNotifications';
import { generateRandomToken, hashToken } from '../../../utils/crypto';
import {
  signActionConfirmationToken,
  verifyActionConfirmationToken
} from '../../../utils/jwt';

type OAuthLinkMeta = {
  ip?: string | null | undefined;
};

function assertRequestUsable(request: { expiresAt: Date; completedAt: Date | null }) {
  if (request.completedAt) {
    throw new Error('TOKEN_INVALID');
  }
  if (request.expiresAt < new Date()) {
    throw new Error('TOKEN_EXPIRED');
  }
}

export async function requestOAuthLinkApproval(params: {
  userId: string;
  email: string;
  provider: 'google' | 'github';
  providerUserId: string;
  emailAtProvider: string;
  requestedIp?: string | null | undefined;
}) {
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  const request = await prisma.$transaction(async (tx) => {
    await tx.oAuthLinkRequest.deleteMany({
      where: {
        OR: [
          { userId: params.userId, provider: params.provider },
          { provider: params.provider, providerUserId: params.providerUserId }
        ],
        completedAt: null
      }
    });

    return tx.oAuthLinkRequest.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        providerUserId: params.providerUserId,
        emailAtProvider: params.emailAtProvider,
        tokenHash,
        requestedIp: params.requestedIp ?? null,
        expiresAt
      }
    });
  });

  try {
    await sendOAuthLinkRequestNotification({
      email: params.email,
      provider: params.provider,
      verifyUrl: `${env.appBaseUrl}/verify-oauth-link?token=${encodeURIComponent(rawToken)}`
    });
  } catch (error) {
    await prisma.oAuthLinkRequest.delete({ where: { id: request.id } });
    throw error;
  }

  return { rawToken };
}

export async function createOAuthLinkConfirmation(token: string, requestId: string) {
  const tokenHash = hashToken(token);
  const request = await prisma.oAuthLinkRequest.findUnique({ where: { tokenHash } });
  if (!request) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  const confirmationToken = signActionConfirmationToken(
    {
      sub: request.userId,
      type: 'action_confirmation',
      action: 'oauth_link_verify',
      sourceTokenHash: tokenHash
    },
    5
  );

  return { confirmationToken, requestId };
}

export async function confirmOAuthLink(confirmationToken: string, meta: OAuthLinkMeta, requestId: string) {
  let payload;
  try {
    payload = verifyActionConfirmationToken(confirmationToken);
  } catch {
    throw new Error('TOKEN_INVALID');
  }

  if (payload.type !== 'action_confirmation' || payload.action !== 'oauth_link_verify') {
    throw new Error('TOKEN_INVALID');
  }

  const request = await prisma.oAuthLinkRequest.findUnique({
    where: { tokenHash: payload.sourceTokenHash }
  });
  if (!request || request.userId !== payload.sub) {
    throw new Error('TOKEN_INVALID');
  }

  assertRequestUsable(request);

  await prisma.$transaction(async (tx) => {
    await tx.oAuthAccount.upsert({
      where: {
        oauth_accounts_provider_provider_user_id_key: {
          provider: request.provider,
          providerUserId: request.providerUserId
        }
      },
      update: {
        userId: request.userId,
        emailAtProvider: request.emailAtProvider
      },
      create: {
        provider: request.provider,
        providerUserId: request.providerUserId,
        userId: request.userId,
        emailAtProvider: request.emailAtProvider
      }
    });

    await tx.oAuthLinkRequest.update({
      where: { id: request.id },
      data: { completedAt: new Date() }
    });
  });

  await writeAuditLog({
    actorUserId: request.userId,
    actorIp: meta.ip ?? null,
    action: 'OAUTH_LINKED',
    targetType: 'user',
    targetId: request.userId,
    metadata: { provider: request.provider, approved_via_email: true },
    requestId
  });

  const user = await prisma.user.findUnique({ where: { id: request.userId } });
  if (user) {
    await sendOAuthLinkApprovedNotification({
      email: user.email,
      provider: request.provider
    }).catch(() => undefined);
  }
}
