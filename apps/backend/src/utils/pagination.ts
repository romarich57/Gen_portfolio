export type CursorPayload = { createdAt: Date; id: string };

export function encodeCursor(payload: CursorPayload): string {
  const raw = `${payload.createdAt.toISOString()}|${payload.id}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string | null): CursorPayload | null {
  if (!cursor) return null;
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const [dateRaw, id] = raw.split('|');
    if (!dateRaw || !id) return null;
    const createdAt = new Date(dateRaw);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}
