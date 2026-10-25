export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);
export const newId = () => crypto.randomUUID();

export function parseJsonCols<T extends Record<string, unknown>>(row: T, cols: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const c of cols) if (typeof out[c] === "string") out[c] = JSON.parse(out[c] as string);
  return out as T;
}

export async function audit(db: D1Database, actorId: string | null, action: string, entity: string, entityId: string | null, detail?: unknown) {
  await db
    .prepare("INSERT INTO audit_log (actor_id, action, entity, entity_id, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(actorId, action, entity, entityId, detail === undefined ? null : JSON.stringify(detail), now())
    .run();
}

/** Fixed-window rate limit stored in D1. Returns false when the limit is exceeded. */
export async function rateLimit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const t = Math.floor(Date.now() / 1000);
  const start = t - (t % windowSec);
  const row = await db.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").bind(key).first<{ window_start: number; count: number }>();
  if (!row || row.window_start !== start) {
    await db.prepare("INSERT OR REPLACE INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)").bind(key, start).run();
    return true;
  }
  if (row.count >= limit) return false;
  await db.prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").bind(key).run();
  return true;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
