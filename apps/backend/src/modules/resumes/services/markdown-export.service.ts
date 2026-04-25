import type { Prisma } from '@prisma/client';

export function renderResumeMarkdown(title: string, data: Prisma.JsonValue): string {
  const value = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const basic = value.basic && typeof value.basic === 'object' ? (value.basic as Record<string, unknown>) : {};
  return [`# ${title}`, '', `## ${String(basic.title ?? 'CV')}`, '', JSON.stringify(value, null, 2)].join('\n');
}
