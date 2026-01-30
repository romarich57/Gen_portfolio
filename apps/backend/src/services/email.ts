import nodemailer from 'nodemailer';
import { env } from '../config/env';

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

type EmailTemplateParams = {
  title: string;
  preview: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  secondaryActionLabel?: string;
  secondaryActionUrl?: string;
  outro: string;
};

export function buildEmailHtml(params: EmailTemplateParams): string {
  const { title, preview, intro, actionLabel, actionUrl, secondaryActionLabel, secondaryActionUrl, outro } = params;
  const secondaryCta = secondaryActionLabel && secondaryActionUrl
    ? `<p style="margin-top: 10px;"><a class="cta secondary" href="${secondaryActionUrl}">${secondaryActionLabel}</a></p>`
    : '';
  return `
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 0; background: #f5f3f0; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #0f172a; }
      .wrapper { width: 100%; padding: 40px 16px; background: #f5f3f0; }
      .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 22px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 18px 50px rgba(15, 23, 42, 0.08); }
      .brand { padding: 24px 28px; background: linear-gradient(135deg, #0f766e, #0e7490); color: #f8fafc; }
      .brand h1 { margin: 0; font-size: 20px; letter-spacing: 0.06em; text-transform: uppercase; }
      .brand p { margin: 6px 0 0; font-size: 12px; opacity: 0.85; }
      .content { padding: 28px; }
      .title { font-size: 24px; margin: 0 0 12px; }
      .text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
      .cta { display: inline-block; padding: 12px 22px; border-radius: 999px; background: #0f766e; color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 14px; }
      .cta.secondary { background: #0f172a; }
      .notice { margin-top: 18px; padding: 14px 16px; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
      .muted { font-size: 12px; color: #64748b; margin-top: 18px; }
      .footer { padding: 18px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
      .link { word-break: break-all; color: #0f766e; text-decoration: none; }
      .preview { display: none; max-height: 0; overflow: hidden; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <span class="preview">${preview}</span>
      <div class="card">
        <div class="brand">
          <h1>SaaS Builder</h1>
          <p>Plateforme securisee &amp; moderne</p>
        </div>
        <div class="content">
          <h2 class="title">${title}</h2>
          <p class="text">${intro}</p>
          <p><a class="cta" href="${actionUrl}">${actionLabel}</a></p>
          ${secondaryCta}
          <div class="notice">
            Pour votre securite, ce lien est personnel et expire automatiquement.
          </div>
          <p class="muted">${outro}</p>
          <p class="muted">Lien direct : <a class="link" href="${actionUrl}">${actionUrl}</a></p>
        </div>
        <div class="footer">
          Besoin d'aide ? Repondez a cet email ou contactez le support.
        </div>
      </div>
    </div>
  </body>
</html>
`.trim();
}

export function buildEmailText(params: EmailTemplateParams): string {
  const { title, intro, actionLabel, actionUrl, secondaryActionLabel, secondaryActionUrl, outro } = params;
  const secondaryLine = secondaryActionLabel && secondaryActionUrl
    ? `\n${secondaryActionLabel}: ${secondaryActionUrl}\n`
    : '\n';
  return `${title}\n\n${intro}\n\n${actionLabel}: ${actionUrl}${secondaryLine}\n${outro}`;
}
