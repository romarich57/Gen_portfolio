import test from 'node:test';
import assert from 'node:assert/strict';

import '../setupEnv';

import { buildEmailHtml } from '../../src/services/emailTemplates';

test('buildEmailHtml escapes interpolated html content', () => {
  const html = buildEmailHtml({
    title: '<b>unsafe</b>',
    preview: '<script>alert(1)</script>',
    intro: 'Click <here>',
    actionLabel: 'Open "secure" link',
    actionUrl: 'https://example.com/reset?token=abc',
    outro: 'Bye & thanks'
  });

  assert.ok(html.includes('&lt;b&gt;unsafe&lt;/b&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Click &lt;here&gt;'));
  assert.ok(html.includes('Open &quot;secure&quot; link'));
  assert.ok(html.includes('Bye &amp; thanks'));
});

test('buildEmailHtml rejects non-http urls', () => {
  assert.throws(
    () =>
      buildEmailHtml({
        title: 'Unsafe URL',
        preview: 'Preview',
        intro: 'Intro',
        actionLabel: 'Click',
        actionUrl: 'javascript:alert(1)',
        outro: 'Outro'
      }),
    /EMAIL_TEMPLATE_URL_INVALID/
  );
});
