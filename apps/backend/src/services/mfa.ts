import { authenticator } from 'otplib';

const ISSUER = 'CV Genius';

authenticator.options = {
  window: 1
};

export function generateTotpSecret(email: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(email, ISSUER, secret);
  return { secret, otpauthUrl };
}

export function verifyTotpCode(code: string, secret: string): boolean {
  return authenticator.check(code, secret);
}
