// Study-route assessment API: public evaluation (no account needed) and an idempotent roadmap for signed-in students.
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "./env";
import { requireUser } from "./auth";
import { listRequirements, SCH_JSON } from "./data";
import { getRates } from "./planner";
import { generateChecklist } from "../shared/checklist";
import { profileSchema } from "../shared/profile";
import { evaluateRoute } from "../shared/route";
import type { Country, Scholarship } from "../shared/types";
import { newId, now, parseJsonCols, rateLimit, today } from "./util";

const YEARS: Record<string, number> = { bachelor: 4, master: 2, phd: 3 };
const PER_YEAR = { once: 1, month: 12, semester: 2, year: 1 } as const;
const LEVEL_WORDS: Record<string, RegExp> = { bachelor: /bachelor|undergrad/i, master: /master|graduate|postgrad/i, phd: /phd|doctora/i };

interface Ref { id: string; country: string; kind: string; category: string; label: string; amount: number | null; amount_max: number | null; currency: string; unit: keyof typeof PER_YEAR; applies_to: string | null; source_url: string | null; authority: string | null; status: string }

/** Indicative yearly cost from official references (upper ends, level-matched). Clearly an estimate. */
function estimate(refs: Ref[], country: Country, level: string | undefined, pkrPer: Record<string, number>) {
  const pick = (category: string) => {
    const cands = refs
      .filter((r) => r.country === country && r.kind === "cost" && r.category === category && r.amount !== null && r.status !== "NEEDS_REVIEW")
      .filter((r) => {
        if (!level) return true;
        const named = Object.entries(LEVEL_WORDS).filter(([, re]) => re.test(`${r.label} ${r.applies_to ?? ""}`)).map(([k]) => k);
        return named.length === 0 || named.includes(level);
      })
      .filter((r) => r.unit !== "once"); // whole-programme totals don't fit a yearly estimate
    const yearly = (r: Ref) => (r.amount_max ?? r.amount!) * PER_YEAR[r.unit];
    return cands.sort((a, b) => yearly(b) - yearly(a))[0];
  };
  const parts = (["tuition", "accommodation", "living"] as const).map((cat) => {
    const r = pick(cat);
    if (!r) return { category: cat, pkr: null as number | null, ref: null };
    const rate = r.currency === "PKR" ? 1 : pkrPer[r.currency];
    const yearly = (r.amount_max ?? r.amount!) * PER_YEAR[r.unit];
    return { category: cat, pkr: rate ? Math.round(yearly * rate) : null, ref: { id: r.id, label: r.label, url: r.source_url, authority: r.authority, status: r.status, yearly, currency: r.currency } };
  });
  const known = parts.filter((p) => p.pkr !== null);
  return { perYearPkr: known.reduce((a, p) => a + (p.pkr ?? 0), 0), parts, complete: known.length === parts.length };
}

export const routeRoutes = new Hono<AppEnv>();

routeRoutes.post("/route/evaluate", async (c) => {
  if (!(await rateLimit(c.env.DB, `route:${c.req.header("cf-connecting-ip") ?? "local"}`, 60, 3600))) return c.json({ error: "Too many requests. Try again later." }, 429);
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  const { profile } = z.object({ profile: profileSchema }).parse(raw);
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT * FROM scholarships").all<Record<string, unknown>>();
  const scholarships = results.map((r) => parseJsonCols(r, SCH_JSON) as unknown as Scholarship);
  const reqs = await listRequirements(db);
  const result = evaluateRoute(profile, scholarships, reqs, today());

  const rates = await getRates(db);
  const { results: refs } = await db.prepare("SELECT * FROM cost_references").all<Ref>();
  const years = YEARS[profile.targetLevel ?? "master"];
  const finance = result.routes.map((r) => {
    const e = estimate(refs, r.country, profile.targetLevel, rates.rates);
    const total = e.perYearPkr * years;
    return {
      country: r.country,
      years,
      perYearPkr: e.perYearPkr,
      totalPkr: total,
      gapPkr: profile.budgetPkr !== undefined ? Math.max(0, total - profile.budgetPkr) : null,
      complete: e.complete,
      parts: e.parts,
    };
  });
  return c.json({ ...result, finance, rates: { source: rates.source, date: rates.date } });
});

const me = new Hono<AppEnv>();
me.use("*", requireUser);

// Turns chosen options into tracked applications (with official-call checklists) plus barrier tasks. Idempotent.
me.post("/roadmap", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  const b = z.object({
    scholarshipIds: z.array(z.string().max(100)).max(5).default([]),
    actions: z.array(z.object({ title: z.string().min(3).max(160), why: z.string().max(400).optional() })).max(8).default([]),
  }).parse(raw);
  const db = c.env.DB;
  const uid = c.get("user")!.id;
  const t = now();
  let createdApps = 0;
  let createdTasks = 0;
  for (const sid of b.scholarshipIds) {
    const exists = await db.prepare("SELECT 1 FROM applications WHERE user_id = ? AND scholarship_id = ?").bind(uid, sid).first();
    if (exists) continue;
    const row = await db.prepare("SELECT * FROM scholarships WHERE id = ? AND is_test_data = 0").bind(sid).first<Record<string, unknown>>();
    if (!row) continue;
    const s = parseJsonCols(row, SCH_JSON) as unknown as Scholarship;
    const appId = newId();
    const confirmed = (s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING") && !!s.deadline_date ? 1 : 0;
    const drafts = generateChecklist(s, await listRequirements(db, s.id));
    const ids = new Map(drafts.map((d) => [d.key, newId()]));
    await db.batch([
      db.prepare("INSERT INTO applications (id, user_id, scholarship_id, title, institution, mode, deadline_date, deadline_confirmed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'guided', ?, ?, ?, ?)")
        .bind(appId, uid, s.id, s.name, s.provider, s.deadline_date ?? s.proposed_deadline ?? null, confirmed, t, t),
      ...drafts.map((d, i) =>
        db.prepare(
          `INSERT INTO tasks (id, user_id, application_id, title, instructions, reason, requirement_type, due_date, due_confirmed, source_url, source_verified_at,
            depends_on, documents, next_action, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(ids.get(d.key)!, uid, appId, d.title, d.instructions, d.reason, d.requirement_type, d.due_date, d.due_confirmed ? 1 : 0, d.source_url, d.source_verified_at,
          JSON.stringify(d.depends_on.map((k) => ids.get(k)).filter(Boolean)), JSON.stringify(d.documents), d.next_action, i, t, t),
      ),
    ]);
    createdApps++;
  }
  for (const a of b.actions) {
    const exists = await db.prepare("SELECT 1 FROM tasks WHERE user_id = ? AND application_id IS NULL AND title = ?").bind(uid, a.title).first();
    if (exists) continue;
    await db.prepare("INSERT INTO tasks (id, user_id, application_id, title, instructions, reason, requirement_type, sort, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, 'From your study-route assessment', 'recommended', 500, ?, ?)")
      .bind(newId(), uid, a.title, a.why ?? null, t, t)
      .run();
    createdTasks++;
  }
  return c.json({ createdApplications: createdApps, createdTasks });
});

routeRoutes.route("/me", me);
