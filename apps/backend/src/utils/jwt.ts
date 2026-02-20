import jwt, { type Algorithm } from 'jsonwebtoken';
import { env } from '../config/env';

const JWT_ISSUER = 'saas-builder';
const JWT_ALGORITHM: Algorithm = 'HS256';

export type AccessTokenPayload = {
  sub: string;
  roles: string[];
};

export type ChallengeTokenPayload = {
  sub: string;
  type: 'mfa' | 'onboarding';
  stage?: 'phone' | 'mfa';
};

export type EmailChangeTokenPayload = {
  sub: string;
  newEmail: string;
  type: 'email_change';
};

export type ActionConfirmationType =
  | 'email_verify'
  | 'recovery_email_verify'
  | 'security_revoke_sessions'
  | 'security_acknowledge_alert'
  | 'email_change_verify';

export type ActionConfirmationPayload = {
  sub: string;
  type: 'action_confirmation';
  action: ActionConfirmationType;
  sourceTokenHash: string;
  newEmail?: string;
};

export function signAccessToken(payload: AccessTokenPayload, expiresInMinutes: number): string {
  return jwt.sign(payload, env.accessTokenSecret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.accessTokenSecret, {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALGORITHM]
  }) as AccessTokenPayload;
}

/**
 * @deprecated Refresh sessions are now opaque random tokens hashed in DB.
 * Keep this type only for backward compatibility during transition.
 */
export type RefreshTokenPayload = {
  sub: string;
};

/**
 * @deprecated Refresh sessions are now opaque random tokens hashed in DB.
 * Kept for backward compatibility only.
 */
export function signRefreshToken(payload: RefreshTokenPayload, expiresInDays: number): string {
  return jwt.sign(payload, env.refreshTokenSecret, {
    expiresIn: `${expiresInDays}d`,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM
  });
}

/**
 * @deprecated Refresh sessions are now opaque random tokens hashed in DB.
 * Kept for backward compatibility only.
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.refreshTokenSecret, {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALGORITHM]
  }) as RefreshTokenPayload;
}

export function signChallengeToken(payload: ChallengeTokenPayload, expiresInMinutes: number): string {
  return jwt.sign(payload, env.mfaChallengeSecret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM
  });
}

export function signEmailChangeToken(payload: EmailChangeTokenPayload, expiresInMinutes: number): string {
  return jwt.sign(payload, env.mfaChallengeSecret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM
  });
}

export function verifyEmailChangeToken(token: string): EmailChangeTokenPayload {
  return jwt.verify(token, env.mfaChallengeSecret, {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALGORITHM]
  }) as EmailChangeTokenPayload;
}

export function signActionConfirmationToken(
  payload: ActionConfirmationPayload,
  expiresInMinutes: number
): string {
  return jwt.sign(payload, env.mfaChallengeSecret, {
    expiresIn: `${expiresInMinutes}m`,
    issuer: JWT_ISSUER,
    algorithm: JWT_ALGORITHM
  });
}

export function verifyActionConfirmationToken(token: string): ActionConfirmationPayload {
  return jwt.verify(token, env.mfaChallengeSecret, {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALGORITHM]
  }) as ActionConfirmationPayload;
}

export function verifyChallengeToken(token: string): ChallengeTokenPayload {
  return jwt.verify(token, env.mfaChallengeSecret, {
    issuer: JWT_ISSUER,
    algorithms: [JWT_ALGORITHM]
  }) as ChallengeTokenPayload;
}
