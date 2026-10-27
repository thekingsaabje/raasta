// Scheduled source checks. Fetches a bounded number of official pages, hashes their main content and
// opens review tasks on change or repeated failure. It NEVER changes a scholarship's status: failures and
// changes only create work for a reviewer. Page content is untrusted data: it is hashed, never interpreted.
import { now, sha256Hex, today } from "./util";

const UA = "RaastaSourceMonitor/0.2 (+official-source freshness check)";
const MAX_BYTES = 400_000; // bounds CPU per page on the free plan
const FAIL_LIMIT = 3;

/** Main textual content without scripts, styles and site chrome, so menus/counters don't trigger changes. */
export function mainContent(html: string): string {
  let s = html.slice(0, MAX_BYTES);
  const main = s.match(/<main[\s\S]*?<\/main>/i) ?? s.match(/<article[\s\S]*?<\/article>/i);
  if (main) s = main[0];
  return s
    .replace(/<(script|style|noscript|nav|header|footer|form|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function openTask(db: D1Database, kind: string, dedupe: string, detail: string, sourceId: string | null, scholarshipId: string | null) {
  const r = await db
    .prepare("INSERT OR IGNORE INTO review_tasks (kind, source_id, scholarship_id, detail, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(kind, sourceId, scholarshipId, detail, dedupe, now())
    .run();
  return (r.meta.changes ?? 0) > 0;
}

export async function runSourceChecks(db: D1Database, limit = 10, fetcher: typeof fetch = fetch) {
  const { results } = await db
    .prepare("SELECT id, url, content_hash, fail_count FROM sources ORDER BY COALESCE(last_checked_at, '') LIMIT ?")
    .bind(limit)
    .all<{ id: string; url: string; content_hash: string | null; fail_count: number }>();

  const out: { id: string; ok: boolean; changed: boolean; status?: number; taskOpened?: boolean }[] = [];
  for (const s of results) {
    const t = now();
    let ok = false;
    let status: number | undefined;
    let hash: string | null = null;
    let error: string | null = null;
    try {
      const res = await fetcher(s.url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      status = res.status;
      ok = res.ok;
      if (ok) {
        const text = mainContent(await res.text());
        hash = text.length > 50 ? await sha256Hex(text) : null; // near-empty pages are treated as failures
        if (!hash) (ok = false), (error = "empty content");
      } else await res.body?.cancel();
    } catch (e) {
      error = e instanceof Error ? e.message.slice(0, 200) : "error";
    }

    const changed = ok && !!s.content_hash && hash !== s.content_hash;
    const fails = ok ? 0 : s.fail_count + 1;
    await db.batch([
      db.prepare("INSERT INTO source_checks (source_id, checked_at, ok, http_status, content_hash, changed, error) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(s.id, t, ok ? 1 : 0, status ?? null, hash, changed ? 1 : 0, error),
      ok
        ? db.prepare(`UPDATE sources SET last_checked_at = ?, last_success_at = ?, content_hash = ?, fail_count = 0,
            review_status = CASE WHEN ? THEN 'outstanding' WHEN review_status = 'inaccessible' THEN 'discovered' ELSE review_status END WHERE id = ?`).bind(t, t, hash, changed ? 1 : 0, s.id)
        : db.prepare(`UPDATE sources SET last_checked_at = ?, fail_count = ?,
            review_status = CASE WHEN ? >= ? THEN 'inaccessible' ELSE review_status END WHERE id = ?`).bind(t, fails, fails, FAIL_LIMIT, s.id),
    ]);

    let taskOpened = false;
    if (changed) taskOpened = await openTask(db, "source_changed", `changed:${s.id}`, `Official page content changed (${t}). Re-check linked scholarships.`, s.id, null);
    else if (!ok && fails >= FAIL_LIMIT)
      taskOpened = await openTask(db, "source_failing", `failing:${s.id}`, `Fetch failed ${fails} times (last: ${status ?? error}). Check manually.`, s.id, null);
    out.push({ id: s.id, ok, changed, status, taskOpened });
  }

  // Verified-open/upcoming records past their checked deadline need a human status update.
  const { results: stale } = await db
    .prepare(
      `SELECT id, name, COALESCE(deadline_date, proposed_deadline) AS deadline_date FROM scholarships
       WHERE (status IN ('VERIFIED_OPEN','VERIFIED_UPCOMING') OR cycle_state IN ('open','upcoming'))
       AND COALESCE(deadline_date, proposed_deadline) IS NOT NULL AND COALESCE(deadline_date, proposed_deadline) < ?`,
    )
    .bind(today())
    .all<{ id: string; name: string; deadline_date: string }>();
  for (const s of stale) await openTask(db, "deadline_passed", `deadline:${s.id}:${s.deadline_date}`, `${s.name}: deadline ${s.deadline_date} has passed.`, null, s.id);

  return { checked: out.length, results: out, deadlinePassed: stale.length };
}
