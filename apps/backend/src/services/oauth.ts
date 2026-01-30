import { env } from '../config/env';
import { pkceChallenge, generateRandomToken } from '../utils/crypto';

export type OAuthProvider = 'google' | 'github';

type OAuthProviderConfig = {
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientId: string;
  clientSecret: string;
};

function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
  if (provider === 'google') {
    return {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
      scope: 'openid email profile',
      clientId: env.oauthGoogleClientId,
      clientSecret: env.oauthGoogleClientSecret
    };
  }

  return {
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'read:user user:email',
    clientId: env.oauthGithubClientId,
    clientSecret: env.oauthGithubClientSecret
  };
}

export function getOAuthRedirectUri(provider: OAuthProvider): string {
  if (provider === 'google' && env.oauthGoogleRedirectUri) {
    return env.oauthGoogleRedirectUri;
  }
  if (provider === 'github' && env.oauthGithubRedirectUri) {
    return env.oauthGithubRedirectUri;
  }
  return `${env.oauthRedirectBaseUrl}/auth/oauth/${provider}/callback`;
}

export function buildOAuthStart(provider: OAuthProvider) {
  const state = generateRandomToken(16);
  const verifier = generateRandomToken(32);
  const nonce = generateRandomToken(16);
  const challenge = pkceChallenge(verifier);
  const config = getProviderConfig(provider);
  const redirectUri = getOAuthRedirectUri(provider);

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scope,
    state: `${state}.${nonce}`,
    nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  return {
    state: `${state}.${nonce}`,
    nonce,
    verifier,
    redirectUri,
    authorizationUrl: `${config.authUrl}?${params.toString()}`
  };
}

export async function exchangeOAuthCode(params: {
  provider: OAuthProvider;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<{ accessToken: string }> {
  const config = getProviderConfig(params.provider);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: params.code,
    grant_type: 'authorization_code',
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier
  });

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body
  });

  if (!res.ok) {
    throw new Error('OAUTH_TOKEN_EXCHANGE_FAILED');
  }

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('OAUTH_TOKEN_MISSING');
  }

  return { accessToken: data.access_token };
}

export async function fetchOAuthProfile(params: {
  provider: OAuthProvider;
  accessToken: string;
}): Promise<{ providerUserId: string; email: string | null; emailVerified: boolean }> {
  if (params.provider === 'google') {
    const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${params.accessToken}` }
    });
    if (!res.ok) throw new Error('OAUTH_PROFILE_FAILED');
    const data = (await res.json()) as { sub: string; email?: string; email_verified?: boolean };
    return {
      providerUserId: data.sub,
      email: data.email ?? null,
      emailVerified: Boolean(data.email_verified)
    };
  }

  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/vnd.github+json'
    }
  });
  if (!res.ok) throw new Error('OAUTH_PROFILE_FAILED');
  const data = (await res.json()) as { id: number; email?: string | null };

  // Always fetch /user/emails to get accurate email and verification status
  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/vnd.github+json'
    }
  });

  let email = data.email ?? null;
  let emailVerified = false;

  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    const primary = emails.find((entry) => entry.primary) ?? emails[0];
    if (primary) {
      email = primary.email;
      emailVerified = primary.verified;
    }
  }

  return {
    providerUserId: String(data.id),
    email,
    emailVerified
  };
}
