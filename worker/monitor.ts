// Scheduled source checks: fetch a bounded number of official pages, hash the text, flag changes for
// human review. Page content is treated as untrusted data: it is hashed, never interpreted or executed.
import { now, sha256Hex } from "./util";

const UA = "RaastaSourceMonitor/0.1 (+official-source freshness check)";

function normalise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runSourceChecks(db: D1Database, limit = 10, fetcher: typeof fetch = fetch) {
  const { results } = await db
    .prepare("SELECT id, url, content_hash, fail_count FROM sources WHERE review_status != 'inaccessible' OR fail_count < 5 ORDER BY COALESCE(last_checked_at, '') LIMIT ?")
    .bind(limit)
    .all<{ id: string; url: string; content_hash: string | null; fail_count: number }>();

  const out: { id: string; ok: boolean; changed: boolean; status?: number }[] = [];
  for (const s of results) {
    const t = now();
    try {
      const res = await fetcher(s.url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const text = res.ok ? normalise((await res.text()).slice(0, 2_000_000)) : "";
      const hash = res.ok ? await sha256Hex(text) : null;
      const changed = !!(res.ok && s.content_hash && hash !== s.content_hash);
      await db.batch([
        db.prepare("INSERT INTO source_checks (source_id, checked_at, ok, http_status, content_hash, changed) VALUES (?, ?, ?, ?, ?, ?)").bind(s.id, t, res.ok ? 1 : 0, res.status, hash, changed ? 1 : 0),
        res.ok
          ? db.prepare(`UPDATE sources SET last_checked_at = ?, last_success_at = ?, content_hash = ?, fail_count = 0,
              review_status = CASE WHEN ? THEN 'outstanding' ELSE review_status END WHERE id = ?`).bind(t, t, hash, changed ? 1 : 0, s.id)
          : db.prepare(`UPDATE sources SET last_checked_at = ?, fail_count = fail_count + 1,
              review_status = CASE WHEN fail_count + 1 >= 3 THEN 'inaccessible' ELSE review_status END WHERE id = ?`).bind(t, s.id),
      ]);
      out.push({ id: s.id, ok: res.ok, changed, status: res.status });
    } catch (e) {
      await db.batch([
        db.prepare("INSERT INTO source_checks (source_id, checked_at, ok, error) VALUES (?, ?, 0, ?)").bind(s.id, t, e instanceof Error ? e.message.slice(0, 200) : "error"),
        db.prepare("UPDATE sources SET last_checked_at = ?, fail_count = fail_count + 1, review_status = CASE WHEN fail_count + 1 >= 3 THEN 'inaccessible' ELSE review_status END WHERE id = ?").bind(t, s.id),
      ]);
      out.push({ id: s.id, ok: false, changed: false });
    }
  }
  return { checked: out.length, results: out };
}
