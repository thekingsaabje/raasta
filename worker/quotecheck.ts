// Free automatic checker ("Auto-checked" badge): re-reads each scholarship's official page(s) and checks that the
// word-for-word quotes we store, and the deadline date, are still there. Deterministic text matching, no AI. It NEVER
// changes a status (founder decision 2026-10-29: the badge is separate from "Confirmed", which only a reviewer sets):
// it records when the page was last checked and opens a review task if the quotes have disappeared.
// Page content is untrusted data: it is normalised and searched, never interpreted.
import { now } from "./util";

const UA = "RaastaSourceCheck/1.0 (+checks official scholarship pages for quoted text)";
const MAX_BYTES = 600_000;
const MAX_URLS = 2; // per scholarship per run, to stay inside free-plan CPU and subrequest limits

export type CheckResult = "matches" | "partly" | "changed" | "unreadable";
export type DeadlineCheck = "found" | "missing" | "none";

const MONTHS: Record<string, string[]> = {
  en: ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"],
  de: ["januar", "februar", "märz", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "dezember"],
  it: ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"],
};

/** The ways an official page may write a date (already normalised: lower case, single spaces). */
export function dateVariants(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return [];
  const dd = String(d).padStart(2, "0"), mm = String(m).padStart(2, "0");
  const en = MONTHS.en[m - 1], short = en.slice(0, 3);
  const th = d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th";
  return [
    `${d} ${en} ${y}`, `${d}${th} ${en} ${y}`, `${d}${th} of ${en} ${y}`, `${en} ${d}, ${y}`, `${en} ${d}${th}, ${y}`, `${en} ${d} ${y}`,
    `${d} ${short} ${y}`, `${short} ${d}, ${y}`, `${short}. ${d}, ${y}`,
    `${d}. ${MONTHS.de[m - 1]} ${y}`, `${d} ${MONTHS.de[m - 1]} ${y}`, `${d} ${MONTHS.it[m - 1]} ${y}`,
    `${dd}.${mm}.${y}`, `${d}.${m}.${y}`, `${dd}/${mm}/${y}`, `${y}-${mm}-${dd}`, `${y}.${mm}.${dd}`, `${y}. ${m}. ${d}`, `${y}/${mm}/${dd}`,
    `${y}年${m}月${d}日`, `${y}年${mm}月${dd}日`, `${y}년 ${m}월 ${d}일`,
  ];
}

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
  const s = await db
    .prepare("SELECT id, name, official_url, COALESCE(deadline_date, proposed_deadline) AS deadline FROM scholarships WHERE id = ?")
    .bind(id)
    .first<{ id: string; name: string; official_url: string; deadline: string | null }>();
  if (!s) return null;
  const { results: reqs } = await db
    .prepare("SELECT excerpt, source_url FROM requirements WHERE scholarship_id = ? AND excerpt IS NOT NULL AND length(excerpt) >= 12")
    .bind(id)
    .all<{ excerpt: string; source_url: string | null }>();
  // Quotes grouped by the page they came from; the most-quoted pages first.
  const byUrl = new Map<string, string[]>();
  for (const r of reqs) byUrl.set(r.source_url ?? s.official_url, [...(byUrl.get(r.source_url ?? s.official_url) ?? []), r.excerpt]);
  if (!byUrl.has(s.official_url)) byUrl.set(s.official_url, []); // the deadline may be on the official page alone
  const urls = [...byUrl.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_URLS);
  const dates = s.deadline ? dateVariants(s.deadline) : [];

  let found = 0, total = 0, readable = false, dateSeen = false;
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
      if (dates.some((v) => text.includes(v))) dateSeen = true;
    } catch {
      /* timeout or network error: counts as unreadable for this page */
    }
  }
  const result = classifyCheck(found, total, readable);
  const deadline: DeadlineCheck = !s.deadline ? "none" : dateSeen ? "found" : "missing";
  const t = now();
  await db.prepare("UPDATE scholarships SET source_checked_at = ?, source_check = ? WHERE id = ?").bind(t, JSON.stringify({ result, found, total, deadline }), id).run();
  if (result === "changed")
    await db
      .prepare("INSERT OR IGNORE INTO review_tasks (kind, scholarship_id, detail, dedupe_key, created_at) VALUES ('source_changed', ?, ?, ?, ?)")
      .bind(id, `${s.name}: the stored official quotes were not found on the page any more (${t.slice(0, 10)}). Re-check the record.`, `quotes:${id}:${t.slice(0, 10)}`, t)
      .run();
  return { id, result, found, total, deadline };
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
