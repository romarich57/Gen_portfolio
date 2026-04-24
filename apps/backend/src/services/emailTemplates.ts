export type EmailTemplateParams = {
  title: string;
  preview: string;
  intro: string;
  actionLabel: string;
  actionUrl: string;
  secondaryActionLabel?: string;
  secondaryActionUrl?: string;
  outro: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeEmailUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('EMAIL_TEMPLATE_URL_INVALID');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('EMAIL_TEMPLATE_URL_INVALID');
  }

  return escapeHtml(parsed.toString());
}

export function buildEmailHtml(params: EmailTemplateParams): string {
  const title = escapeHtml(params.title);
  const preview = escapeHtml(params.preview);
  const intro = escapeHtml(params.intro);
  const actionLabel = escapeHtml(params.actionLabel);
  const actionUrl = sanitizeEmailUrl(params.actionUrl);
  const outro = escapeHtml(params.outro);
  const secondaryActionLabel = params.secondaryActionLabel
    ? escapeHtml(params.secondaryActionLabel)
    : undefined;
  const secondaryActionUrl = params.secondaryActionUrl
    ? sanitizeEmailUrl(params.secondaryActionUrl)
    : undefined;
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
  const secondaryLine = params.secondaryActionLabel && params.secondaryActionUrl
    ? `\n${params.secondaryActionLabel}: ${params.secondaryActionUrl}\n`
    : '\n';

  return `${params.title}\n\n${params.intro}\n\n${params.actionLabel}: ${params.actionUrl}${secondaryLine}\n${params.outro}`;
}
