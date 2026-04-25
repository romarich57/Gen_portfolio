const ALLOWED_TAGS = new Set(['p', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i', 'u', 'br', 'a', 'span', 'div']);

function sanitizeHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
    .replace(/<\/?([a-z0-9-]+)(\s[^>]*)?>/gi, (match, tagName: string) => {
      const normalized = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(normalized)) return '';
      if (normalized !== 'a') return match.replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '');
      return match
        .replace(/\sstyle\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\starget\s*=\s*(['"]).*?\1/gi, '')
        .replace(/\srel\s*=\s*(['"]).*?\1/gi, '');
    });
}

export function sanitizeResumeData<T>(value: T): T {
  if (typeof value === 'string') {
    return sanitizeHtml(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeResumeData(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      output[key] = sanitizeResumeData(entry);
    }
    return output as T;
  }

  return value;
}
