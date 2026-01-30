import { env } from '../config/env';

const HCAPTCHA_VERIFY_URL = 'https://hcaptcha.com/siteverify';
const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

export async function verifyCaptchaToken(token: string | undefined, ip?: string): Promise<boolean> {
  if (env.isTest || env.captchaProvider === 'none') {
    return true;
  }
  if (!token || !env.captchaSecret) {
    return false;
  }

  const url = env.captchaProvider === 'recaptcha' ? RECAPTCHA_VERIFY_URL : HCAPTCHA_VERIFY_URL;
  const body = new URLSearchParams({
    secret: env.captchaSecret,
    response: token,
    ...(ip ? { remoteip: ip } : {})
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!res.ok) {
    return false;
  }

  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}
