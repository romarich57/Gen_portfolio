import { prisma } from '../../../db/prisma';
import { env } from '../../../config/env';
import { writeAuditLog } from '../../../services/audit';
import { getOAuthRedirectUri, buildOAuthStart } from '../../../services/oauth';
import { verifyAccessToken } from '../../../utils/jwt';

export function startOAuthFlow(provider: 'google' | 'github') {
  return buildOAuthStart(provider);
}

export async function writeOAuthStartAudit(provider: 'google' | 'github', ip: string | null, requestId: string) {
  await writeAuditLog({
    actorUserId: null,
    actorIp: ip,
    action: 'OAUTH_START',
    targetType: 'oauth',
    targetId: provider,
    metadata: {},
    requestId
  });
}

export function getOAuthDebugData(requestIp: string, requestId: string) {
  const normalizeIp = (value: string) => (value.startsWith('::ffff:') ? value.slice(7) : value);
  const allowlist = new Set(env.oauthDebugIpAllowlist.map(normalizeIp));
  const normalizedRequestIp = normalizeIp(requestIp);

  if (env.isProduction || !env.oauthDebugEnabled || !allowlist.has(normalizedRequestIp)) {
    throw new Error('NOT_FOUND');
  }

  return {
    google: {
      redirect_uri: getOAuthRedirectUri('google'),
      client_id: env.oauthGoogleClientId
    },
    github: {
      redirect_uri: getOAuthRedirectUri('github'),
      client_id: env.oauthGithubClientId
    },
    oauth_redirect_base_url: env.oauthRedirectBaseUrl,
    app_base_url: env.appBaseUrl,
    request_id: requestId
  };
}

export function getAuthenticatedOAuthUserId(accessToken: string | undefined) {
  if (!accessToken) {
    throw new Error('AUTH_REQUIRED');
  }

  try {
    const payload = verifyAccessToken(accessToken);
    return payload.sub;
  } catch {
    throw new Error('AUTH_REQUIRED');
  }
}

export async function unlinkOAuthProvider(
  userId: string,
  provider: 'google' | 'github',
  ip: string | null,
  requestId: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      emailVerifiedAt: true,
      oauthAccounts: { select: { provider: true } }
    }
  });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const oauthProviders = user.oauthAccounts.map((account) => account.provider);
  if (!oauthProviders.includes(provider)) {
    throw new Error('PROVIDER_NOT_LINKED');
  }

  const otherProvidersCount = oauthProviders.filter((linkedProvider) => linkedProvider !== provider).length;
  if (otherProvidersCount === 0 && !user.passwordHash) {
    throw new Error('NEED_PASSWORD_FIRST');
  }
  if (otherProvidersCount === 0 && !user.emailVerifiedAt) {
    throw new Error('NEED_EMAIL_VERIFIED');
  }

  await prisma.oAuthAccount.deleteMany({
    where: {
      userId,
      provider
    }
  });

  await writeAuditLog({
    actorUserId: userId,
    actorIp: ip,
    action: 'OAUTH_UNLINKED',
    targetType: 'oauth',
    targetId: provider,
    metadata: {},
    requestId
  });
}
