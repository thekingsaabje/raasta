// Free automatic checker: re-reads each scholarship's official page(s) and checks that the word-for-word
// quotes we store are still there. Deterministic text matching, no AI. It NEVER changes a status: it records
// when the page was last checked and opens a review task if the quotes have disappeared.
// Page content is untrusted data: it is normalised and searched, never interpreted.
import { now } from "./util";

const UA = "RaastaSourceCheck/1.0 (+checks official scholarship pages for quoted text)";
const MAX_BYTES = 600_000;
const MAX_URLS = 2; // per scholarship per run, to stay inside free-plan CPU and subrequest limits

export type CheckResult = "matches" | "partly" | "changed" | "unreadable";

/** Lower-case text with tags removed and quotes, dashes and spaces unified, so formatting can't hide a match. */
export function normalise(s: string): string {
  return s
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&euro;/gi, "€").replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/** Classify how many stored quotes were found on the pages that could be read. */
export function classifyCheck(found: number, total: number, readable: boolean): CheckResult {
  if (!readable || total === 0) return "unreadable";
  if (found === total) return "matches";
  return found > 0 ? "partly" : "changed";
}

export async function checkScholarship(db: D1Database, id: string, fetcher: typeof fetch = fetch) {
  const s = await db.prepare("SELECT id, name, official_url FROM scholarships WHERE id = ?").bind(id).first<{ id: string; name: string; official_url: string }>();
  if (!s) return null;
  const { results: reqs } = await db
    .prepare("SELECT excerpt, source_url FROM requirements WHERE scholarship_id = ? AND excerpt IS NOT NULL AND length(excerpt) >= 12")
    .bind(id)
    .all<{ excerpt: string; source_url: string | null }>();
  // Quotes grouped by the page they came from; the most-quoted pages first.
  const byUrl = new Map<string, string[]>();
  for (const r of reqs) byUrl.set(r.source_url ?? s.official_url, [...(byUrl.get(r.source_url ?? s.official_url) ?? []), r.excerpt]);
  const urls = [...byUrl.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_URLS);

  let found = 0, total = 0, readable = false;
  for (const [url, quotes] of urls) {
    try {
      const res = await fetcher(url, { headers: { "user-agent": UA, accept: "text/html,*/*;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !/html|text\/plain/i.test(type)) { await res.body?.cancel(); continue; } // PDFs and blocked pages: not readable here
      const text = normalise((await res.text()).slice(0, MAX_BYTES));
      if (text.length < 200) continue;
      readable = true;
      total += quotes.length;
      found += quotes.filter((q) => text.includes(normalise(q))).length;
    } catch {
      /* timeout or network error: counts as unreadable for this page */
    }
  }
  const result = classifyCheck(found, total, readable);
  const t = now();
  await db.prepare("UPDATE scholarships SET source_checked_at = ?, source_check = ? WHERE id = ?").bind(t, JSON.stringify({ result, found, total }), id).run();
  if (result === "changed")
    await db
      .prepare("INSERT OR IGNORE INTO review_tasks (kind, scholarship_id, detail, dedupe_key, created_at) VALUES ('source_changed', ?, ?, ?, ?)")
      .bind(id, `${s.name}: the stored official quotes were not found on the page any more (${t.slice(0, 10)}). Re-check the record.`, `quotes:${id}:${t.slice(0, 10)}`, t)
      .run();
  return { id, result, found, total };
}

/** Checks the records that were checked longest ago. Bounded per run. */
export async function runQuoteChecks(db: D1Database, limit = 4, fetcher: typeof fetch = fetch) {
  const { results } = await db
    .prepare("SELECT id FROM scholarships WHERE is_test_data = 0 ORDER BY COALESCE(source_checked_at, '') LIMIT ?")
    .bind(limit)
    .all<{ id: string }>();
  const out = [];
  for (const r of results) out.push(await checkScholarship(db, r.id, fetcher));
  return out;
}
