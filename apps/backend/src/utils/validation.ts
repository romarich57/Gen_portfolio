import type { ZodError } from 'zod';

export type ValidationIssue = {
  field: string;
  message: string;
};

export function formatZodError(error: ZodError): { fields: string[]; issues: ValidationIssue[] } {
  const fields = new Set<string>();
  const issues = error.issues.map((issue) => {
    const field = issue.path.length ? issue.path.join('.') : 'root';
    fields.add(field);
    return { field, message: issue.message };
  });
  return { fields: Array.from(fields), issues };
}
