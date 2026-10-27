// Live discovery API. Search providers only PROPOSE URLs; the Worker fetches each official page itself,
// extracts values with verbatim quotes (shared/discovery.ts) and stores them as unverified evidence for review.
// Page content is untrusted data: it is quoted and hashed, never followed as instructions.
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "./env";
import { requireAdmin, requireUser } from "./auth";
import {
  askOfficeEmail, buildQueries, classifyHost, countryOfHost, evaluateDiscovery, extractPage, findConflicts, LISTED_DOMAINS, moiRequestEmail,
  pageText, pageTitle, unverifiableQuotes, type Conflict, type Extract, type HostTier,
} from "../shared/discovery";
import { profileSchema, type Profile } from "../shared/profile";
import type { Country } from "../shared/types";
import { audit, newId, now, rateLimit, sha256Hex, today } from "./util";

const UA = "RaastaDiscovery/0.1 (+official-source reader for students; low volume)";
const MAX_PAGES = 6;
const MAX_HTML = 250_000; // bounds CPU per page on the free plan
const MAX_PDF = 5_000_000;
const MAX_TEXT = 150_000;
const REUSE_DAYS = 7;
const CACHE_DAYS = 7;
const LINK_WORDS = /scholar|stipend|fellowship|funding|bursar|borsa|borse|bando|stipendi|奖学金|admission|apply|application|master|graduate|postgrad|phd|doctoral|tuition|fees|international/i;

export interface SearchHit { url: string; title: string | null }
export interface SearchProvider { name: string; search(query: string, domains: string[]): Promise<SearchHit[]> }

/* ───────────────────────── Providers ───────────────────────── */

/** Tavily search, with a hard monthly stop (never rolls into pay-as-you-go) and a 7-day cache. */
export function tavilyProvider(db: D1Database, key: string, monthlyCap: number, fetcher: typeof fetch = fetch): SearchProvider {
  return {
    name: "tavily",
    async search(query, domains) {
      const cacheKey = await sha256Hex(`tavily|${query}|${domains.join(",")}`);
      const cached = await db.prepare("SELECT results, created_at FROM search_cache WHERE key = ?").bind(cacheKey).first<{ results: string; created_at: string }>();
      if (cached && Date.now() - Date.parse(cached.created_at) < CACHE_DAYS * 86400000) return JSON.parse(cached.results);
      const month = today().slice(0, 7);
      // Reserve one search before calling, so concurrent runs can't pass the cap.
      const r = await db
        .prepare("INSERT INTO search_usage (month, provider, count) VALUES (?, 'tavily', 1) ON CONFLICT(month, provider) DO UPDATE SET count = count + 1 WHERE count < ?")
        .bind(month, monthlyCap)
        .run();
      if (!(r.meta.changes ?? 0)) throw new QuotaError();
      const res = await fetcher("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ api_key: key, query, search_depth: "basic", max_results: 5, include_domains: domains }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`search provider returned ${res.status}`);
      const data = (await res.json()) as { results?: { url?: string; title?: string }[] };
      const hits: SearchHit[] = (data.results ?? []).filter((h) => typeof h.url === "string").map((h) => ({ url: h.url!, title: h.title?.slice(0, 200) ?? null }));
      await db.prepare("INSERT OR REPLACE INTO search_cache (key, provider, results, created_at) VALUES (?, 'tavily', ?, ?)").bind(cacheKey, JSON.stringify(hits), now()).run();
      return hits;
    },
  };
}

export class QuotaError extends Error {
  constructor() {
    super("monthly search quota reached");
  }
}

/** Official-source crawl: reads registered official pages and the same-site links on them. Finds nothing outside known domains. */
async function crawlCandidates(sources: { id: string; url: string }[], fetcher: typeof fetch): Promise<{ hits: SearchHit[]; notes: string[] }> {
  const hits: SearchHit[] = [];
  const notes: string[] = [];
  await Promise.all(
    sources.map(async (s) => {
      hits.push({ url: s.url, title: null });
      if (/\.pdf($|\?)/i.test(s.url)) return;
      try {
        const res = await fetcher(s.url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(8_000) });
        if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) {
          await res.body?.cancel();
          notes.push(`${new URL(s.url).hostname}: page could not be read (HTTP ${res.status}).`);
          return;
        }
        const html = (await res.text()).slice(0, MAX_HTML);
        const base = new URL(res.url || s.url);
        let n = 0;
        for (const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
          if (n >= 3) break;
          let u: URL;
          try {
            u = new URL(m[1], base);
          } catch {
            continue;
          }
          if (u.hostname !== base.hostname || u.href === base.href) continue;
          const anchor = m[2].replace(/<[^>]+>/g, " ");
          if (!LINK_WORDS.test(anchor) && !LINK_WORDS.test(u.pathname)) continue;
          hits.push({ url: u.href, title: anchor.replace(/\s+/g, " ").trim().slice(0, 200) || null });
          n++;
        }
      } catch {
        notes.push(`${new URL(s.url).hostname}: page did not respond.`);
      }
    }),
  );
  return { hits, notes };
}

/* ───────────────────────── Pipeline ───────────────────────── */

interface DiscoveryRow {
  id: string; url: string; host: string; host_tier: HostTier; country: string | null; title: string | null; kind: string; provider: string;
  fetched_at: string; extract: string; conflicts: string; review_state: string; review_note: string | null; reviewed_at: string | null; content_hash: string | null;
}

const hostOf = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\d?\./, "");
/** Worth showing: about a scholarship or programme AND states at least one concrete thing (level, date, fee or documents). */
const useful = (x: Extract) => x.kind !== "unknown" && (x.levels.length > 0 || x.deadlines.length > 0 || x.fees.length > 0 || x.documents.length > 1);

type PageRead = { ok: true; text: string; title: string | null; format: "html" | "pdf"; status: number; finalUrl: string } | { ok: false; reason: string };

/** HTML is reduced to text here; a PDF is converted to plain text by Cloudflare's Markdown Conversion (no AI model is used for PDFs). */
async function readPage(url: string, fetcher: typeof fetch, ai?: Ai): Promise<PageRead> {
  try {
    const res = await fetcher(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(10_000) });
    const type = res.headers.get("content-type") ?? "";
    const finalUrl = res.url || url;
    if (!res.ok) return await res.body?.cancel(), { ok: false, reason: `HTTP ${res.status}` };
    if (type.includes("pdf") || (/\.pdf($|\?)/i.test(finalUrl) && type.includes("octet-stream"))) {
      if (!ai) return await res.body?.cancel(), { ok: false, reason: "PDF (not read automatically here: open the link)" };
      if (Number(res.headers.get("content-length") ?? 0) > MAX_PDF) return await res.body?.cancel(), { ok: false, reason: "PDF too large to read automatically (open the link)" };
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_PDF) return { ok: false, reason: "PDF too large to read automatically (open the link)" };
      const name = decodeURIComponent(new URL(finalUrl).pathname.split("/").pop() || "call.pdf").slice(0, 120);
      const out = await ai.toMarkdown({ name, blob: new Blob([buf], { type: "application/pdf" }) });
      if (out.format === "error" || !("data" in out)) return { ok: false, reason: "PDF could not be converted (open the link)" };
      // Markdown → plain lines: drop the metadata block and heading marks, keep the words exactly as converted.
      const body = out.data.includes("## Contents") ? out.data.slice(out.data.indexOf("## Contents") + 11) : out.data;
      const text = body.replace(/^#{1,6} +/gm, "").replace(/[ \t\r\f\v]+/g, " ").replace(/ ?\n[ \n]*/g, "\n").trim().slice(0, MAX_TEXT);
      if (text.length < 200) return { ok: false, reason: "PDF has no readable text, probably a scan (open the link)" };
      return { ok: true, text, title: name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " "), format: "pdf", status: res.status, finalUrl };
    }
    if (!type.includes("html") && !type.includes("text")) return await res.body?.cancel(), { ok: false, reason: `unsupported content (${type.split(";")[0] || "unknown"})` };
    const html = (await res.text()).slice(0, MAX_HTML);
    return { ok: true, text: pageText(html), title: pageTitle(html), format: "html", status: res.status, finalUrl };
  } catch (e) {
    if (!(e instanceof Error && e.name === "TimeoutError")) console.error(JSON.stringify({ job: "discovery_read", host: new URL(url).hostname, error: e instanceof Error ? e.message.slice(0, 300) : "unknown" }));
    return { ok: false, reason: e instanceof Error && e.name === "TimeoutError" ? "timed out" : "could not be read" };
  }
}

export async function runDiscovery(env: Env, profile: Profile, countries: Country[], userId: string, fetcher: typeof fetch = fetch) {
  const db = env.DB;
  const notes: string[] = [];
  const providers: string[] = ["official-crawl"];
  const { results: sources } = await db
    .prepare(`SELECT id, url, country FROM sources WHERE country IN (${countries.map(() => "?").join(",")}, 'PK') AND review_status != 'inaccessible'
              ORDER BY CASE WHEN last_success_at IS NULL THEN 1 ELSE 0 END, last_success_at DESC`)
    .bind(...countries)
    .all<{ id: string; url: string; country: string }>();
  const { results: allSources } = await db.prepare("SELECT url FROM sources").all<{ url: string }>();
  const allRegistered = [...new Set(allSources.map((s) => hostOf(s.url)))];

  // 1. Candidates. Open-web search and the official-source crawl run at the same time, then take turns
  //    so neither fills every page slot (registered PDFs used to be crowded out).
  const queries: string[] = [];
  const webTask = (async () => {
    if (!env.TAVILY_API_KEY) {
      notes.push("Open-web search isn't connected yet, so only Raasta's registered official sources (and links on them) were read.");
      return [] as (SearchHit & { provider: string; query: string | null })[];
    }
    providers.unshift("tavily");
    const search = tavilyProvider(db, env.TAVILY_API_KEY, Math.min(1000, Number(env.SEARCH_MONTHLY_CAP) || 900), fetcher);
    const jobs = countries.flatMap((c) => {
      const domains = [...new Set([...LISTED_DOMAINS.filter((d) => countryOfHost(d) === c), ...allRegistered.filter((h) => countryOfHost(h) === c), ...(c === "CN" ? ["edu.cn"] : [])])];
      return buildQueries(profile, c).slice(0, 2).map((q) => ({ q, domains }));
    });
    queries.push(...jobs.map((j) => j.q));
    const out = await Promise.allSettled(jobs.map((j) => search.search(j.q, j.domains).then((hits) => hits.map((h) => ({ ...h, provider: "tavily", query: j.q })))));
    const failed = out.filter((o) => o.status === "rejected") as PromiseRejectedResult[];
    if (failed.some((f) => f.reason instanceof QuotaError)) notes.push("Open-web search paused: this month's free search quota is used up. Showing official-source results only.");
    else if (failed.length) notes.push("Open-web search failed for some queries this time.");
    return out.flatMap((o) => (o.status === "fulfilled" ? o.value : []));
  })();
  const countrySources = sources.filter((s) => countries.includes(s.country as Country));
  const picked = countrySources.map((s) => ({ s, k: Math.random() })).sort((x, y) => x.k - y.k).slice(0, 4).map((x) => x.s); // rotate through the registry
  const [web, crawl] = await Promise.all([webTask, crawlCandidates(picked, fetcher)]);
  notes.push(...crawl.notes);
  const crawlHits = crawl.hits.map((h) => ({ ...h, provider: "official-crawl", query: null as string | null }));
  const candidates: (SearchHit & { provider: string; query: string | null })[] = [];
  for (let i = 0; i < Math.max(web.length, crawlHits.length); i++) {
    if (crawlHits[i]) candidates.push(crawlHits[i]);
    if (web[i]) candidates.push(web[i]);
  }

  // 2. Official-domain gate + dedupe.
  const seen = new Set<string>();
  const gated = candidates
    .map((c) => ({ ...c, url: c.url.split("#")[0], tier: classifyHost(c.url, allRegistered) }))
    .filter((c) => {
      if (!c.tier || seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });
  const dropped = candidates.length - gated.length;
  if (dropped > 0) notes.push(`${dropped} result(s) skipped: duplicates or not an official source.`);

  // 3. Reuse fresh discoveries; fetch the rest (bounded).
  const urls = gated.map((g) => g.url);
  const existing = urls.length
    ? (await db.prepare(`SELECT * FROM discoveries WHERE url IN (${urls.map(() => "?").join(",")})`).bind(...urls).all<DiscoveryRow>()).results
    : [];
  const byUrl = new Map(existing.map((r) => [r.url, r]));
  const fresh = (r?: DiscoveryRow) => !!r && Date.now() - Date.parse(r.fetched_at) < REUSE_DAYS * 86400000;
  const toFetch = gated.filter((g) => !fresh(byUrl.get(g.url))).slice(0, MAX_PAGES);
  const { results: catalogue } = await db.prepare("SELECT name, official_url, COALESCE(deadline_date, proposed_deadline) AS date FROM scholarships WHERE is_test_data = 0").all<{ name: string; official_url: string; date: string | null }>();

  const writes: D1PreparedStatement[] = [];
  const t = now();
  await Promise.all(
    toFetch.map(async (g) => {
      const page = await readPage(g.url, fetcher, env.AI);
      if (!page.ok) return void notes.push(`${hostOf(g.url)}: ${page.reason}.`);
      // Redirects are followed, so the page we actually read must also be on an official host.
      if (page.finalUrl !== g.url && !classifyHost(page.finalUrl, allRegistered)) return void notes.push(`${hostOf(g.url)}: skipped (redirected to a non-official site).`);
      const text = page.text;
      const hc = countryOfHost(hostOf(g.url));
      const x = extractPage(text, { dayFirst: hc === "IT" || hc === "DE" || hc === "PK" });
      x.sourceFormat = page.format;
      if (unverifiableQuotes(x, text).length) return void notes.push(`${hostOf(g.url)}: skipped (quote check failed).`);
      if (!useful(x)) return;
      const cat = catalogue.find((s) => s.official_url.split("#")[0] === g.url) ?? null;
      const conflicts = findConflicts(x, cat ? { name: cat.name, date: cat.date } : null);
      const hash = await sha256Hex(text);
      const prev = byUrl.get(g.url);
      const id = prev?.id ?? newId();
      // A reviewed page that changed goes back to review; an unchanged one keeps its review.
      const changed = !!prev && prev.content_hash !== hash;
      const state = !prev || changed ? (conflicts.length ? "CONFLICTING" : "NEEDS_REVIEW") : prev.review_state;
      const row: DiscoveryRow = {
        id, url: g.url, host: hostOf(g.url), host_tier: g.tier!, country: countryOfHost(hostOf(g.url)), title: (page.format === "pdf" ? g.title : null) ?? page.title ?? g.title, kind: x.kind,
        provider: g.provider, fetched_at: t, extract: JSON.stringify(x), conflicts: JSON.stringify(conflicts), review_state: state,
        review_note: changed && prev?.review_state === "REVIEWER_CONFIRMED" ? `Page changed on ${t.slice(0, 10)} after review. Needs a new check.` : (prev?.review_note ?? null),
        reviewed_at: changed ? null : (prev?.reviewed_at ?? null), content_hash: hash,
      };
      byUrl.set(g.url, row);
      writes.push(
        db.prepare(
          `INSERT INTO discoveries (id, url, host, host_tier, country, title, kind, provider, query, content_hash, fetched_at, http_status, extract, conflicts, review_state, review_note, reviewed_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(url) DO UPDATE SET title = excluded.title, kind = excluded.kind, content_hash = excluded.content_hash, fetched_at = excluded.fetched_at,
             http_status = excluded.http_status, extract = excluded.extract, conflicts = excluded.conflicts,
             -- Race-safe: an unchanged page keeps its review even if another search wrote it first.
             review_state = CASE WHEN discoveries.content_hash = excluded.content_hash THEN discoveries.review_state ELSE excluded.review_state END,
             review_note = CASE WHEN discoveries.content_hash = excluded.content_hash THEN discoveries.review_note ELSE excluded.review_note END,
             reviewed_at = CASE WHEN discoveries.content_hash = excluded.content_hash THEN discoveries.reviewed_at ELSE excluded.reviewed_at END,
             updated_at = excluded.updated_at`,
        ).bind(id, row.url, row.host, row.host_tier, row.country, row.title, row.kind, row.provider, g.query, hash, t, page.status, row.extract, row.conflicts, state, row.review_note, row.reviewed_at, t, t),
      );
    }),
  );

  if (writes.length) await db.batch(writes);
  // Read back what is stored: a parallel search of the same page may have saved it first (its id and review win).
  const keep = gated.map((g) => g.url).filter((u) => byUrl.has(u));
  const stored = keep.length
    ? (await db.prepare(`SELECT * FROM discoveries WHERE url IN (${keep.map(() => "?").join(",")})`).bind(...keep).all<DiscoveryRow>()).results
    : [];
  const found = keep
    .map((u) => stored.find((r) => r.url === u))
    .filter((r): r is DiscoveryRow => !!r && r.review_state !== "REJECTED" && useful(JSON.parse(r.extract)));
  // Text a reviewer pasted from pages that block automated reading (e.g. campuschina.org) is shown for its country.
  const { results: pasted } = await db
    .prepare(`SELECT * FROM discoveries WHERE provider = 'manual' AND review_state != 'REJECTED' AND country IN (${countries.map(() => "?").join(",")}) ORDER BY updated_at DESC LIMIT 5`)
    .bind(...countries)
    .all<DiscoveryRow>();
  for (const r of pasted) if (!found.some((f) => f.id === r.id)) found.push(r);
  const runId = newId();
  await db.prepare("INSERT INTO discovery_runs (id, user_id, profile, providers, queries, discovery_ids, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(runId, userId, JSON.stringify(profile), JSON.stringify(providers), JSON.stringify(queries), JSON.stringify(found.map((f) => f.id)), JSON.stringify(notes), t)
    .run();
  return { runId, providers, queries, notes, items: found.map((r) => present(r, profile)), createdAt: t };
}

/** Student view of one discovery: the stored evidence plus a fresh personal evaluation. */
function present(r: DiscoveryRow, profile: Profile, detail = false) {
  const x = JSON.parse(r.extract) as Extract;
  // Recomputed from the stored evidence so rule fixes apply at once; catalogue comparisons are kept from fetch time.
  const conflicts = [...findConflicts(x), ...(JSON.parse(r.conflicts) as Conflict[]).filter((c) => c.field === "deadline_vs_catalogue")];
  const evaluation = evaluateDiscovery(x, profile, today(), { state: r.review_state, conflicts });
  const base = {
    id: r.id, url: r.url, host: r.host, hostTier: r.host_tier, country: r.country, title: r.title ?? r.host, kind: r.kind, provider: r.provider,
    fetchedAt: r.fetched_at, sourceFormat: x.sourceFormat ?? "html", reviewState: r.review_state, reviewedAt: r.reviewed_at, conflicts, evaluation,
  };
  if (!detail) return base;
  return {
    ...base,
    extract: x,
    emails: {
      moiRequest: moiRequestEmail({}),
      askOffice: askOfficeEmail(r.title ?? r.host, r.url),
    },
  };
}

/* ───────────────────────── Routes ───────────────────────── */

/** The profile of the student's latest search (falls back to the saved profile). */
async function searchProfile(db: D1Database, userId: string): Promise<Profile> {
  const run = await db.prepare("SELECT profile FROM discovery_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(userId).first<{ profile: string }>();
  const p = run ? (JSON.parse(run.profile) as Profile) : null;
  if (p && Object.keys(p).length) return p;
  const prof = await db.prepare("SELECT data FROM profiles WHERE user_id = ?").bind(userId).first<{ data: string }>();
  return prof ? (JSON.parse(prof.data) as Profile) : {};
}

export const discoveryRoutes = new Hono<AppEnv>();
const me = new Hono<AppEnv>();
me.use("*", requireUser);

me.get("/discover/status", async (c) => {
  const usage = await c.env.DB.prepare("SELECT count FROM search_usage WHERE month = ? AND provider = 'tavily'").bind(today().slice(0, 7)).first<{ count: number }>();
  return c.json({
    openWebSearch: !!c.env.TAVILY_API_KEY,
    provider: c.env.TAVILY_API_KEY ? "Tavily (free plan)" : null,
    monthlyCap: Math.min(1000, Number(c.env.SEARCH_MONTHLY_CAP) || 900),
    usedThisMonth: usage?.count ?? 0,
  });
});

me.post("/discover", async (c) => {
  const user = c.get("user")!;
  const perDay = user.role === "admin" ? 50 : 5;
  if (!(await rateLimit(c.env.DB, `discover:${user.id}`, perDay, 86400))) return c.json({ error: `You can run ${perDay} searches a day. Your earlier results are kept below.` }, 429);
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  const b = z.object({ profile: profileSchema, countries: z.array(z.enum(["CN", "DE", "IT"])).min(1).max(3) }).parse(raw);
  return c.json(await runDiscovery(c.env, b.profile, b.countries, user.id));
});

me.get("/discover/latest", async (c) => {
  const db = c.env.DB;
  const run = await db.prepare("SELECT * FROM discovery_runs WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").bind(c.get("user")!.id).first<Record<string, string>>();
  if (!run) return c.json({ run: null });
  const ids = JSON.parse(run.discovery_ids) as string[];
  const rows = ids.length ? (await db.prepare(`SELECT * FROM discoveries WHERE id IN (${ids.map(() => "?").join(",")}) AND review_state != 'REJECTED'`).bind(...ids).all<DiscoveryRow>()).results : [];
  const profile = await searchProfile(db, c.get("user")!.id);
  return c.json({
    run: { runId: run.id, providers: JSON.parse(run.providers), queries: JSON.parse(run.queries), notes: JSON.parse(run.notes), createdAt: run.created_at },
    items: ids.map((id) => rows.find((r) => r.id === id)).filter((r): r is DiscoveryRow => !!r).map((r) => present(r, profile)),
  });
});

me.get("/discoveries/:id", async (c) => {
  const db = c.env.DB;
  const r = await db.prepare("SELECT * FROM discoveries WHERE id = ? AND review_state != 'REJECTED'").bind(c.req.param("id")).first<DiscoveryRow>();
  if (!r) return c.json({ error: "Not found" }, 404);
  return c.json({ discovery: present(r, await searchProfile(db, c.get("user")!.id), true) });
});

// Save to roadmap: one application (marked as an unverified lead) plus timeline and document tasks. Idempotent.
me.post("/discoveries/:id/roadmap", async (c) => {
  const db = c.env.DB;
  const uid = c.get("user")!.id;
  const r = await db.prepare("SELECT * FROM discoveries WHERE id = ? AND review_state != 'REJECTED'").bind(c.req.param("id")).first<DiscoveryRow>();
  if (!r) return c.json({ error: "Not found" }, 404);
  const existing = await db.prepare("SELECT id FROM applications WHERE user_id = ? AND discovery_id = ?").bind(uid, r.id).first<{ id: string }>();
  if (existing) return c.json({ applicationId: existing.id, created: false });
  const p = present(r, await searchProfile(db, uid));
  const ev = p.evaluation;
  const t = now();
  const appId = newId();
  const reason = "From a discovery on an official page. Not verified by Raasta. Check the official page.";
  const tasks = [
    ...ev.timeline.map((s) => ({ title: s.title, instructions: s.why + (s.buffer ? " (Date is a Raasta planning buffer, not an official date.)" : ""), due: s.due, type: "recommended" as const, docs: [] as string[] })),
    ...ev.checklist.map((d) => ({ title: `Prepare: ${d.label}`, instructions: `${d.what} Issuer: ${d.issuer}. ${d.how} Found on the page: "${d.foundQuote.slice(0, 200)}"`, due: null, type: "mandatory" as const, docs: [d.label] })),
  ];
  try {
    await db.batch([
      db.prepare("INSERT INTO applications (id, user_id, scholarship_id, discovery_id, title, institution, mode, deadline_date, deadline_confirmed, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, 'guided', ?, 0, ?, ?)")
        .bind(appId, uid, r.id, `[Unverified lead] ${p.title}`.slice(0, 200), r.host, ev.cycle.deadline?.date ?? null, t, t),
      ...tasks.map((k, i) =>
        db.prepare(
          `INSERT INTO tasks (id, user_id, application_id, title, instructions, reason, requirement_type, due_date, due_confirmed, source_url, documents, sort, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        ).bind(newId(), uid, appId, k.title.slice(0, 160), k.instructions, reason, k.type, k.due, r.url, JSON.stringify(k.docs), i, t, t),
      ),
    ]);
  } catch {
    // Lost a race with a parallel save: the unique index kept one copy.
    const again = await db.prepare("SELECT id FROM applications WHERE user_id = ? AND discovery_id = ?").bind(uid, r.id).first<{ id: string }>();
    if (again) return c.json({ applicationId: again.id, created: false });
    throw new Error("could not save");
  }
  return c.json({ applicationId: appId, created: true, tasks: tasks.length }, 201);
});

const admin = new Hono<AppEnv>();
admin.use("*", requireAdmin);

admin.get("/discoveries", async (c) => {
  const state = c.req.query("state");
  const { results } = await c.env.DB
    .prepare(`SELECT * FROM discoveries ${state ? "WHERE review_state = ?" : ""} ORDER BY CASE review_state WHEN 'CONFLICTING' THEN 0 WHEN 'NEEDS_REVIEW' THEN 1 ELSE 2 END, updated_at DESC LIMIT 200`)
    .bind(...(state ? [state] : []))
    .all<DiscoveryRow>();
  return c.json({ discoveries: results.map((r) => ({ ...r, extract: JSON.parse(r.extract), conflicts: JSON.parse(r.conflicts) })) });
});

// Evidence pasted by a reviewer from an official page that blocks automated reading. Same rules as fetched pages:
// official host only, every quote comes from this exact text, and it starts as NEEDS_REVIEW (or CONFLICTING).
admin.post("/discoveries/manual", async (c) => {
  const b = z.object({
    url: z.url().max(600),
    title: z.string().trim().min(3).max(200),
    text: z.string().min(200, "Paste at least a few paragraphs of the official page.").max(100_000),
  }).parse(await c.req.json());
  const db = c.env.DB;
  const actor = c.get("user")!;
  const { results: srcs } = await db.prepare("SELECT url FROM sources").all<{ url: string }>();
  const url = b.url.split("#")[0];
  const tier = classifyHost(url, [...new Set(srcs.map((s) => hostOf(s.url)))]);
  if (!tier) return c.json({ error: "That address isn't an official source Raasta recognises. Paste text only from official university, government or scholarship-provider pages." }, 400);
  const text = b.text.replace(/\r\n?/g, "\n").replace(/[ \t\f\v]+/g, " ").replace(/ ?\n[ \n]*/g, "\n").trim();
  const host = hostOf(url);
  const hc = countryOfHost(host);
  const x = extractPage(text, { dayFirst: hc === "IT" || hc === "DE" || hc === "PK" });
  x.sourceFormat = "pasted";
  if (unverifiableQuotes(x, text).length) return c.json({ error: "Could not check the quotes in this text." }, 400);
  if (!useful(x)) return c.json({ error: "No level, date, fee or document list was found in this text. Paste the part of the page with the call details." }, 400);
  const conflicts = findConflicts(x);
  const t = now();
  const id = newId();
  const note = `Text pasted by ${actor.name} from the official page on ${t.slice(0, 10)}.`;
  await db
    .prepare(
      `INSERT INTO discoveries (id, url, host, host_tier, country, title, kind, provider, query, content_hash, fetched_at, http_status, extract, conflicts, review_state, review_note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET title = excluded.title, kind = excluded.kind, provider = 'manual', content_hash = excluded.content_hash, fetched_at = excluded.fetched_at,
         extract = excluded.extract, conflicts = excluded.conflicts, review_state = excluded.review_state, review_note = excluded.review_note,
         reviewed_by = NULL, reviewed_at = NULL, updated_at = excluded.updated_at`,
    )
    .bind(id, url, host, tier, hc, b.title, x.kind, await sha256Hex(text), t, JSON.stringify(x), JSON.stringify(conflicts), conflicts.length ? "CONFLICTING" : "NEEDS_REVIEW", note, t, t)
    .run();
  const row = await db.prepare("SELECT id FROM discoveries WHERE url = ?").bind(url).first<{ id: string }>();
  await audit(db, actor.id, "discovery_pasted", "discovery", row!.id, { url, chars: text.length });
  return c.json({ id: row!.id, found: { levels: x.levels.length, deadlines: x.deadlines.length, fees: x.fees.length, documents: x.documents.length } }, 201);
});

admin.post("/discoveries/:id/review", async (c) => {
  const b = z.object({ decision: z.enum(["REVIEWER_CONFIRMED", "REJECTED", "CONFLICTING", "NEEDS_REVIEW"]), note: z.string().trim().min(5).max(1000) }).parse(await c.req.json());
  const db = c.env.DB;
  const id = c.req.param("id");
  const actor = c.get("user")!;
  const r = await db.prepare("UPDATE discoveries SET review_state = ?, review_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?").bind(b.decision, b.note, actor.id, now(), now(), id).run();
  if (!(r.meta.changes ?? 0)) return c.json({ error: "Not found" }, 404);
  await audit(db, actor.id, "discovery_review", "discovery", id, b);
  return c.json({ ok: true });
});

discoveryRoutes.route("/me", me);
discoveryRoutes.route("/admin", admin);
