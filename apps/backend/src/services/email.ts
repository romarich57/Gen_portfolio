import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { buildEmailHtml, buildEmailText, type EmailTemplateParams } from './emailTemplates';

const transporter = env.isTest
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass
      }
    });

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await transporter.sendMail({
    from: env.smtpFrom,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html
  });
}

export async function checkSmtpConnection(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  if (env.isTest) {
    return { ok: true, latencyMs: 0 };
  }

  const start = Date.now();
  try {
    await transporter.verify();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP_UNAVAILABLE';
    return { ok: false, latencyMs: Date.now() - start, error: message.slice(0, 160) };
  }
}

export function buildEmailVerificationLink(token: string): string {
  return `${env.appBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildPasswordResetLink(token: string): string {
  return `${env.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export { buildEmailHtml, buildEmailText, type EmailTemplateParams };
