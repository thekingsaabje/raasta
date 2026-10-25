// Cost Planner API: references, indicative exchange rates and saved (versioned) assessments.
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "./env";
import { requireUser } from "./auth";
import { newId, now, parseJsonCols } from "./util";
import { PLAN_CATEGORIES, plan, type PlanInput } from "../shared/planner";

const RATE_URL = "https://open.er-api.com/v6/latest/PKR";
const RATE_SOURCE = "ExchangeRate-API open access (open.er-api.com), indicative mid-market rates";
const CURRENCIES = ["EUR", "CNY", "USD", "GBP"];
const MAX_AGE_MS = 12 * 3600_000;

/** Returns cached rates, refreshing at most every 12 hours. Failure falls back to the cache (or nothing). */
export interface RatesResponse { rates: Record<string, number>; source: string | null; date: string | null; attribution: string | null; stale: boolean }

export async function getRates(db: D1Database, fetcher: typeof fetch = fetch): Promise<RatesResponse> {
  const { results } = await db.prepare("SELECT * FROM fx_rates").all<{ currency: string; pkr_per: number; source: string; rate_date: string | null; fetched_at: string }>();
  const fresh = results.length && Date.now() - Date.parse(results[0].fetched_at) < MAX_AGE_MS;
  if (!fresh) {
    try {
      const res = await fetcher(RATE_URL, { signal: AbortSignal.timeout(8000) });
      const j = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
      if (res.ok && j.result === "success" && j.rates) {
        const date = j.time_last_update_utc ? new Date(j.time_last_update_utc).toISOString() : null;
        const t = now();
        const rows = CURRENCIES.filter((c) => j.rates![c] > 0).map((c) => ({ currency: c, pkr_per: 1 / j.rates![c], source: RATE_SOURCE, rate_date: date, fetched_at: t }));
        if (rows.length)
          await db.batch(rows.map((r) => db.prepare("INSERT OR REPLACE INTO fx_rates (currency, pkr_per, source, rate_date, fetched_at) VALUES (?, ?, ?, ?, ?)").bind(r.currency, r.pkr_per, r.source, r.rate_date, r.fetched_at)));
        return { rates: Object.fromEntries(rows.map((r) => [r.currency, Math.round(r.pkr_per * 100) / 100])), source: RATE_SOURCE, date, attribution: "https://www.exchangerate-api.com", stale: false };
      }
    } catch {
      /* fall back to cache */
    }
  }
  if (!results.length) return { rates: {}, source: null, date: null, attribution: null, stale: true };
  return {
    rates: Object.fromEntries(results.map((r) => [r.currency, Math.round(r.pkr_per * 100) / 100])),
    source: results[0].source,
    date: results[0].rate_date,
    attribution: "https://www.exchangerate-api.com",
    stale: !fresh,
  };
}

const money = z.object({ amount: z.number().min(0).max(1e11), currency: z.string().regex(/^[A-Z]{3}$/) });
const source = z.object({
  status: z.enum(["VERIFIED", "OFFICIAL_ESTIMATE", "ESTIMATE", "USER", "UNKNOWN"]),
  url: z.string().url().max(500).optional(),
  authority: z.string().max(200).optional(),
  checked: z.string().max(40).optional(),
  note: z.string().max(300).optional(),
});
const freq = z.enum(["once", "month", "semester", "year"]);
const award = z.object({
  id: z.string().max(100),
  name: z.string().min(1).max(200),
  status: z.enum(["potential", "confirmed"]),
  scholarshipId: z.string().max(100).nullable().optional(),
  source,
  tuition: z.union([
    z.object({ type: z.literal("full") }),
    z.object({ type: z.literal("percent"), percent: z.number().min(0).max(100) }),
    z.object({ type: z.literal("amount"), amount: z.number().min(0).max(1e9), currency: z.string().regex(/^[A-Z]{3}$/), per: freq }),
    z.object({ type: z.literal("none") }),
    z.object({ type: z.literal("unknown") }),
  ]),
  stipend: z.object({ amount: z.number().min(0).max(1e8), currency: z.string().regex(/^[A-Z]{3}$/), per: z.enum(["month", "year"]), monthsPerYear: z.number().int().min(1).max(12).optional(), startsAfterArrival: z.boolean().optional() }).nullable().optional(),
  accommodation: z.union([z.enum(["full", "none", "unknown"]), z.object({ amount: z.number().min(0), currency: z.string().regex(/^[A-Z]{3}$/), per: z.enum(["month", "year"]) })]),
  insurance: z.enum(["full", "none", "unknown"]),
  travel: z.union([z.enum(["full", "none", "unknown"]), money]),
  durationMonths: z.number().int().min(1).max(120).optional(),
  conditions: z.array(z.string().max(300)).max(20).optional(),
});
export const planInputSchema = z.object({
  months: z.number().int().min(1).max(120),
  costs: z.array(z.object({
    id: z.string().max(100),
    category: z.enum(PLAN_CATEGORIES),
    label: z.string().min(1).max(160),
    amount: z.number().min(0).max(1e10).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    freq,
    stage: z.enum(["before_application", "before_visa", "before_departure", "on_arrival", "during_study"]),
    source,
    depositType: z.enum(["prepayment", "refundable", "additional"]).optional(),
  })).max(60),
  awards: z.array(award).max(6),
  funds: z.object({ savings: money.nullable().optional(), sponsor: money.nullable().optional(), other: money.nullable().optional(), maxContribution: money.nullable().optional() }),
  rates: z.object({ pkrPer: z.record(z.string().regex(/^[A-Z]{3}$/), z.number().positive().max(1e6)), source: z.string().max(300), date: z.string().max(40).nullable() }),
});
/** Answers from the conversation (stored so the student can resume and edit). Free-form but bounded. */
const contextSchema = z.record(z.string().max(60), z.union([z.string().max(300), z.number(), z.boolean(), z.null(), z.array(z.string().max(100)).max(20)])).refine((o) => Object.keys(o).length <= 60);

export const plannerRoutes = new Hono<AppEnv>();

plannerRoutes.get("/planner/references", async (c) => {
  const country = c.req.query("country");
  const stmt = country && /^[A-Z]{2}$/.test(country)
    ? c.env.DB.prepare("SELECT * FROM cost_references WHERE country IN (?, 'PK') ORDER BY kind, category").bind(country)
    : c.env.DB.prepare("SELECT * FROM cost_references ORDER BY country, kind, category");
  const { results } = await stmt.all<Record<string, unknown>>();
  return c.json({ references: results.map((r) => parseJsonCols(r, ["evidence_types"])) });
});

plannerRoutes.get("/planner/rates", async (c) => c.json(await getRates(c.env.DB)));

const me = new Hono<AppEnv>();
me.use("*", requireUser);
const uid = (c: any) => c.get("user")!.id as string;

function summarise(input: PlanInput) {
  const r = plan(input);
  const pick = (s: (typeof r.scenarios)[number]) => ({
    key: s.key, title: s.title, award: s.award, programmeCost: s.programmeCost, firstYearCost: s.firstYearCost, covered: s.covered,
    remaining: s.remaining, upfrontCash: s.upfrontCash, available: s.available, gap: s.gap, gapFirstYear: s.gapFirstYear,
  });
  return { scenarios: r.scenarios.map(pick), missing: r.missing, unconverted: r.unconverted, evidence: r.evidence, conclusion: r.conclusion };
}

me.get("/plans", async (c) => {
  // Latest version of each plan.
  const { results } = await c.env.DB.prepare(
    `SELECT f.* FROM fin_assessments f JOIN (SELECT plan_id, MAX(version) v FROM fin_assessments WHERE user_id = ? GROUP BY plan_id) m
     ON m.plan_id = f.plan_id AND m.v = f.version WHERE f.user_id = ? ORDER BY f.created_at DESC`,
  ).bind(uid(c), uid(c)).all<Record<string, unknown>>();
  return c.json({ plans: results.map((r) => parseJsonCols(r, ["summary"])).map(({ inputs: _i, ...rest }) => rest) });
});

me.get("/plans/:planId", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM fin_assessments WHERE user_id = ? AND plan_id = ? ORDER BY version DESC").bind(uid(c), c.req.param("planId")).all<Record<string, unknown>>();
  if (!results.length) return c.json({ error: "Not found." }, 404);
  return c.json({ versions: results.map((r) => parseJsonCols(r, ["inputs", "summary"])) });
});

me.post("/plans", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  const b = z.object({
    planId: z.string().uuid().optional(),
    title: z.string().min(1).max(160),
    country: z.enum(["CN", "DE", "IT"]).nullable().optional(),
    applicationId: z.string().max(100).nullable().optional(),
    input: planInputSchema,
    context: contextSchema.optional(),
  }).parse(raw);
  const db = c.env.DB;
  if (b.applicationId && !(await db.prepare("SELECT 1 FROM applications WHERE id = ? AND user_id = ?").bind(b.applicationId, uid(c)).first()))
    return c.json({ error: "Application not found." }, 404);
  let planId = b.planId ?? newId();
  let version = 1;
  if (b.planId) {
    const last = await db.prepare("SELECT MAX(version) v FROM fin_assessments WHERE plan_id = ? AND user_id = ?").bind(b.planId, uid(c)).first<{ v: number | null }>();
    if (!last?.v) return c.json({ error: "Plan not found." }, 404); // can't append to someone else's plan
    version = last.v + 1;
  }
  const count = await db.prepare("SELECT COUNT(*) n FROM fin_assessments WHERE user_id = ?").bind(uid(c)).first<{ n: number }>();
  if ((count?.n ?? 0) >= 200) return c.json({ error: "Too many saved versions. Delete an old plan first." }, 400);
  const summary = summarise(b.input as PlanInput); // computed on the server; client numbers are never trusted
  const id = newId();
  await db.prepare("INSERT INTO fin_assessments (id, plan_id, user_id, version, title, country, application_id, inputs, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, planId, uid(c), version, b.title, b.country ?? null, b.applicationId ?? null, JSON.stringify({ input: b.input, context: b.context ?? {} }), JSON.stringify(summary), now())
    .run();
  return c.json({ id, planId, version, summary }, 201);
});

me.delete("/plans/:planId", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM fin_assessments WHERE user_id = ? AND plan_id = ?").bind(uid(c), c.req.param("planId")).run();
  if (!r.meta.changes) return c.json({ error: "Not found." }, 404);
  return c.json({ ok: true });
});

plannerRoutes.route("/me", me);
