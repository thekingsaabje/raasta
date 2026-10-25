// Raasta Cost Planner engine. Deterministic and itemised: every number can be traced to an input line and a formula.
// All arithmetic happens in PKR (integers, rounded once per line); display conversion happens at the edge.
//
// Formulas (documented in the UI "How we calculate"):
//   monthly item   : amount × months
//   semester item  : amount × ceil(months / 6)       (fees are billed per started semester)
//   yearly item    : amount × ceil(months / 12)      (fees are billed per started academic year)
//   one-time item  : amount × 1
//   first year     : same formulas with months = min(12, programme months)
//   typical year   : monthly × 12 + semester × 2 + yearly × 1 (no one-time items)

export type Freq = "once" | "month" | "semester" | "year";
export type Stage = "before_application" | "before_visa" | "before_departure" | "on_arrival" | "during_study";
export type Evidence = "VERIFIED" | "OFFICIAL_ESTIMATE" | "ESTIMATE" | "USER" | "UNKNOWN";

export const PLAN_CATEGORIES = [
  "tuition", "fees", "application", "accommodation", "living", "insurance", "travel", "visa", "documents", "deposit", "other",
] as const;
export type PlanCategory = (typeof PLAN_CATEGORIES)[number];
export const CATEGORY_LABEL: Record<PlanCategory, string> = {
  tuition: "Tuition", fees: "University fees", application: "Application & registration", accommodation: "Accommodation",
  living: "Food & everyday living", insurance: "Insurance & healthcare", travel: "Travel", visa: "Visa & residence",
  documents: "Translation & documents", deposit: "Deposits", other: "Other",
};
const MONTHLY_CASH_CATEGORIES: PlanCategory[] = ["living", "accommodation", "insurance"];

export interface Source { status: Evidence; url?: string; authority?: string; checked?: string; note?: string }

export interface CostLine {
  id: string;
  category: PlanCategory;
  label: string;
  /** null = unknown: excluded from totals and listed as missing. */
  amount: number | null;
  currency: string;
  freq: Freq;
  stage: Stage;
  source: Source;
  /**
   * Deposits only. "prepayment": paid early but part of a cost already listed (e.g. first-year tuition deposit) — it
   * moves cash earlier but is NOT added to totals. "refundable": extra cash needed up front, returned later — counted in
   * up-front cash, excluded from net cost. "additional": a real extra cost.
   */
  depositType?: "prepayment" | "refundable" | "additional";
}

export interface Money { amount: number; currency: string }

export interface AwardTerms {
  id: string;
  name: string;
  /** potential = not awarded (never counted as available money); confirmed = the student holds an offer/award. */
  status: "potential" | "confirmed";
  scholarshipId?: string | null;
  source: Source;
  tuition: { type: "full" } | { type: "percent"; percent: number } | { type: "amount"; amount: number; currency: string; per: Freq } | { type: "none" } | { type: "unknown" };
  /** Cash stipend. monthsPerYear handles awards paid e.g. 10 of 12 months. */
  stipend?: { amount: number; currency: string; per: "month" | "year"; monthsPerYear?: number; startsAfterArrival?: boolean } | null;
  accommodation: "full" | "none" | "unknown" | { amount: number; currency: string; per: "month" | "year" };
  insurance: "full" | "none" | "unknown";
  travel: "full" | "none" | "unknown" | { amount: number; currency: string };
  /** Months the award runs; defaults to the whole programme. */
  durationMonths?: number;
  conditions?: string[];
}

export interface Rates {
  /** PKR per 1 unit of currency, e.g. { EUR: 310, CNY: 39 }. PKR is implicitly 1. */
  pkrPer: Record<string, number>;
  source: string;
  date: string | null;
}

export interface Funds { savings?: Money | null; sponsor?: Money | null; other?: Money | null; maxContribution?: Money | null }

export interface PlanInput {
  months: number;
  costs: CostLine[];
  awards: AwardTerms[];
  funds: Funds;
  rates: Rates;
}

export interface CategoryRow { category: PlanCategory; cost: number; covered: number; remaining: number }
export interface Scenario {
  key: "baseline" | "potential" | "confirmed";
  title: string;
  award: { id: string; name: string; status: AwardTerms["status"] } | null;
  rows: CategoryRow[];
  programmeCost: number;
  firstYearCost: number;
  typicalYearCost: number;
  covered: number;
  coveredFirstYear: number;
  remaining: number;
  remainingFirstYear: number;
  upfrontCash: number;
  refundableDeposits: number;
  stages: { stage: Stage; amount: number }[];
  /** Money the student actually has (never includes potential awards). */
  available: number;
  gap: number;
  gapFirstYear: number;
  overContribution: number | null;
  notes: string[];
}

export interface PlanResult {
  scenarios: Scenario[];
  missing: string[];
  unconverted: string[];
  evidence: Record<Evidence, number>;
  conclusion: string[];
}

const ceilDiv = (a: number, b: number) => Math.ceil(a / b);
export function periods(freq: Freq, months: number): number {
  if (freq === "once") return 1;
  if (freq === "month") return months;
  if (freq === "semester") return ceilDiv(months, 6);
  return ceilDiv(months, 12);
}
const typicalYearPeriods: Record<Freq, number> = { once: 0, month: 12, semester: 2, year: 1 };

export function toPkr(m: { amount: number; currency: string }, rates: Rates): number | null {
  if (m.currency === "PKR") return m.amount;
  const r = rates.pkrPer[m.currency];
  return r && r > 0 ? m.amount * r : null;
}

export function convert(pkr: number, currency: string, rates: Rates): number | null {
  if (currency === "PKR") return pkr;
  const r = rates.pkrPer[currency];
  return r && r > 0 ? pkr / r : null;
}

interface PreparedLine { line: CostLine; unitPkr: number }

function prepare(input: PlanInput, missing: string[], unconverted: string[]): PreparedLine[] {
  const out: PreparedLine[] = [];
  for (const line of input.costs) {
    if (line.amount === null || !Number.isFinite(line.amount)) {
      missing.push(`${line.label}: amount not known yet`);
      continue;
    }
    if (line.amount < 0) continue;
    const unit = toPkr({ amount: line.amount, currency: line.currency }, input.rates);
    if (unit === null) {
      unconverted.push(`${line.label} (${line.currency})`);
      continue;
    }
    out.push({ line, unitPkr: unit });
  }
  return out;
}

/** Cost of one line over a span of months, honouring deposit semantics. */
function lineCost(p: PreparedLine, months: number): number {
  if (p.line.category === "deposit" && p.line.depositType !== "additional") return 0; // prepayments/refundables are not net cost
  return Math.round(p.unitPkr * periods(p.line.freq, months));
}

function coverage(award: AwardTerms | null, lines: PreparedLine[], months: number, rates: Rates, notes: string[]) {
  const byCat = Object.fromEntries(PLAN_CATEGORIES.map((c) => [c, 0])) as Record<PlanCategory, number>;
  if (!award) return byCat;
  const awardMonths = Math.min(months, Math.max(0, award.durationMonths ?? months));
  if (awardMonths < months) notes.push(`${award.name} runs ${awardMonths} of ${months} months; the rest is unfunded.`);
  const catCost = (cat: PlanCategory, m: number) => lines.filter((l) => l.line.category === cat).reduce((a, l) => a + lineCost(l, m), 0);
  const money = (x: { amount: number; currency: string }) => {
    const v = toPkr(x, rates);
    if (v === null) notes.push(`No exchange rate for ${x.currency}; ${award.name} amounts in ${x.currency} are not counted.`);
    return v ?? 0;
  };

  // Tuition
  const tuition = catCost("tuition", awardMonths);
  const t = award.tuition;
  if (t.type === "full") byCat.tuition = tuition;
  else if (t.type === "percent") byCat.tuition = Math.round((tuition * Math.min(100, Math.max(0, t.percent))) / 100);
  else if (t.type === "amount") byCat.tuition = Math.min(tuition, Math.round(money(t) * periods(t.per, awardMonths)));
  else if (t.type === "unknown") notes.push(`${award.name}: tuition coverage not documented; counted as 0.`);

  // Accommodation
  const acc = catCost("accommodation", awardMonths);
  if (award.accommodation === "full") byCat.accommodation = acc;
  else if (award.accommodation === "unknown") notes.push(`${award.name}: accommodation support not documented; counted as 0.`);
  else if (typeof award.accommodation === "object") {
    const a = award.accommodation;
    byCat.accommodation = Math.min(acc, Math.round(money(a) * (a.per === "month" ? awardMonths : ceilDiv(awardMonths, 12))));
  }

  if (award.insurance === "full") byCat.insurance = catCost("insurance", awardMonths);
  if (award.travel === "full") byCat.travel = catCost("travel", awardMonths);
  else if (typeof award.travel === "object") byCat.travel = Math.min(catCost("travel", awardMonths), Math.round(money(award.travel)));

  // Stipend: cash that offsets recurring monthly costs (living first, then unpaid rent/insurance). Never tuition or
  // one-time costs, and any surplus is not counted as spare money.
  if (award.stipend) {
    const s = award.stipend;
    const perMonth = s.per === "month" ? money(s) : money(s) / (s.monthsPerYear ?? 12);
    const paidPerYear = Math.min(12, s.monthsPerYear ?? 12);
    let paidMonths = Math.round((awardMonths * paidPerYear) / 12);
    if (s.startsAfterArrival) {
      paidMonths = Math.max(0, paidMonths - 1);
      notes.push(`${award.name}: stipend starts after arrival; the first month must be paid from your own funds.`);
    }
    let pool = Math.round(perMonth * paidMonths);
    for (const cat of MONTHLY_CASH_CATEGORIES) {
      const room = catCost(cat, awardMonths) - byCat[cat];
      const use = Math.max(0, Math.min(room, pool));
      byCat[cat] += use;
      pool -= use;
    }
  }
  return byCat;
}

function scenario(key: Scenario["key"], title: string, award: AwardTerms | null, input: PlanInput, lines: PreparedLine[], available: number, maxContribution: number | null): Scenario {
  const notes: string[] = [];
  const months = Math.max(1, Math.round(input.months));
  const firstMonths = Math.min(12, months);
  const covProg = coverage(award, lines, months, input.rates, notes);
  const covFirst = coverage(award, lines, firstMonths, input.rates, []);

  const rows: CategoryRow[] = PLAN_CATEGORIES.map((category) => {
    const cost = lines.filter((l) => l.line.category === category).reduce((a, l) => a + lineCost(l, months), 0);
    const covered = Math.min(cost, covProg[category]);
    return { category, cost, covered, remaining: cost - covered };
  }).filter((r) => r.cost > 0 || r.covered > 0);

  const sum = (f: (r: CategoryRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const programmeCost = sum((r) => r.cost);
  const covered = sum((r) => r.covered);
  const firstYearCost = lines.reduce((a, l) => a + lineCost(l, firstMonths), 0);
  const coveredFirstYear = PLAN_CATEGORIES.reduce((a, c) => {
    const cost = lines.filter((l) => l.line.category === c).reduce((x, l) => x + lineCost(l, firstMonths), 0);
    return a + Math.min(cost, covFirst[c]);
  }, 0);
  const typicalYearCost = lines.reduce((a, l) => a + (l.line.category === "deposit" && l.line.depositType !== "additional" ? 0 : Math.round(l.unitPkr * typicalYearPeriods[l.line.freq])), 0);

  // Cash by stage: one-time items at their stage; refundable and prepaid deposits count as cash when paid.
  // During study shows the first year's recurring costs net of this scenario's first-year coverage.
  // Each line keeps the uncovered share of its category (first-year coverage ÷ first-year cost of that category).
  const stageTotals: Record<Stage, number> = { before_application: 0, before_visa: 0, before_departure: 0, on_arrival: 0, during_study: 0 };
  const firstCatCost = Object.fromEntries(PLAN_CATEGORIES.map((c) => [c, lines.filter((l) => l.line.category === c).reduce((a, l) => a + lineCost(l, firstMonths), 0)])) as Record<PlanCategory, number>;
  const uncoveredShare = (c: PlanCategory) => (firstCatCost[c] > 0 ? Math.max(0, 1 - Math.min(firstCatCost[c], covFirst[c]) / firstCatCost[c]) : 1);
  let refundable = 0;
  let prepaid = 0;
  for (const l of lines) {
    if (l.line.category === "deposit") {
      // Deposits are cash when paid, whatever their type.
      stageTotals[l.line.stage] += Math.round(l.unitPkr);
      if (l.line.depositType === "refundable") refundable += Math.round(l.unitPkr);
      if (l.line.depositType === "prepayment") prepaid += Math.round(l.unitPkr);
      continue;
    }
    const due = Math.round(lineCost(l, firstMonths) * uncoveredShare(l.line.category));
    stageTotals[l.line.freq === "once" ? l.line.stage : "during_study"] += due;
  }
  // A prepaid deposit was part of a recurring cost, so that much is no longer due later.
  stageTotals.during_study = Math.max(0, stageTotals.during_study - prepaid);
  const upfrontCash = stageTotals.before_application + stageTotals.before_visa + stageTotals.before_departure + stageTotals.on_arrival;

  const remaining = programmeCost - covered;
  const remainingFirstYear = firstYearCost - coveredFirstYear;
  if (refundable) notes.push("Refundable deposits are needed in cash up front but are not counted as a cost.");
  if (prepaid) notes.push("Prepaid deposits are already part of tuition or rent above; they are shown only as earlier cash.");

  return {
    key,
    title,
    award: award ? { id: award.id, name: award.name, status: award.status } : null,
    rows,
    programmeCost,
    firstYearCost,
    typicalYearCost,
    covered,
    coveredFirstYear,
    remaining,
    remainingFirstYear,
    upfrontCash,
    refundableDeposits: refundable,
    stages: (Object.keys(stageTotals) as Stage[]).map((stage) => ({ stage, amount: stageTotals[stage] })),
    available,
    gap: Math.max(0, remaining + refundable - available),
    gapFirstYear: Math.max(0, remainingFirstYear + refundable - available),
    overContribution: maxContribution === null ? null : Math.max(0, remaining - maxContribution),
    notes,
  };
}

export function plan(input: PlanInput): PlanResult {
  const missing: string[] = [];
  const unconverted: string[] = [];
  const lines = prepare(input, missing, unconverted);
  const fundPkr = (m?: Money | null) => (m && m.amount > 0 ? toPkr(m, input.rates) : 0);
  const fundParts = [input.funds.savings, input.funds.sponsor, input.funds.other];
  for (const m of fundParts) if (m && m.amount > 0 && toPkr(m, input.rates) === null) unconverted.push(`Funds in ${m.currency}`);
  const available = Math.round(fundParts.reduce((a: number, m) => a + (fundPkr(m) ?? 0), 0));
  const maxC = input.funds.maxContribution?.amount ? fundPkr(input.funds.maxContribution) : null;
  const maxContribution = maxC === null || maxC === undefined ? null : Math.round(maxC);

  const scenarios: Scenario[] = [scenario("baseline", "Without a scholarship", null, input, lines, available, maxContribution)];
  for (const a of input.awards.filter((x) => x.status === "potential"))
    scenarios.push(scenario("potential", `If awarded: ${a.name}`, a, input, lines, available, maxContribution));
  for (const a of input.awards.filter((x) => x.status === "confirmed"))
    scenarios.push(scenario("confirmed", `With confirmed award: ${a.name}`, a, input, lines, available, maxContribution));

  const evidence: Record<Evidence, number> = { VERIFIED: 0, OFFICIAL_ESTIMATE: 0, ESTIMATE: 0, USER: 0, UNKNOWN: 0 };
  for (const c of input.costs) evidence[c.amount === null ? "UNKNOWN" : c.source.status]++;

  const base = scenarios[0];
  const conclusion: string[] = [];
  conclusion.push(
    evidence.VERIFIED
      ? `${evidence.VERIFIED} of ${input.costs.length} cost lines use verified official figures; the rest are estimates or your own figures.`
      : "None of the cost lines are verified official figures yet; treat totals as estimates.",
  );
  if (missing.length) conclusion.push(`${missing.length} cost${missing.length > 1 ? "s are" : " is"} still unknown and not included.`);
  if (base.gap > 0) conclusion.push("Without a scholarship your available funds do not cover the programme.");
  else conclusion.push("Your available funds cover the estimated programme cost without a scholarship.");
  const confirmed = scenarios.find((s) => s.key === "confirmed");
  if (confirmed) conclusion.push(confirmed.gap > 0 ? "Even with your confirmed award, part of the cost remains to be funded." : "With your confirmed award, your funds cover the remaining estimated cost.");
  if (scenarios.some((s) => s.key === "potential")) conclusion.push("Potential awards are not money you have: plan your finances on the 'without' or 'confirmed' figures.");

  return { scenarios, missing, unconverted: [...new Set(unconverted)], evidence, conclusion };
}

/** Award terms from a catalogued scholarship's documented coverage (unknown parts stay unknown). */
export function termsFromCoverage(id: string, name: string, cov: Record<string, any> | null | undefined, src: Source, status: AwardTerms["status"] = "potential"): AwardTerms {
  const c = cov ?? {};
  return {
    id,
    name,
    status,
    scholarshipId: id,
    source: src,
    tuition: c.tuition === "full" ? { type: "full" } : c.tuition === "none" ? { type: "none" } : c.tuitionAmount ? { type: "amount", ...c.tuitionAmount } : { type: "unknown" },
    // Scholarship records store the stipend period as `period`; the planner uses `per`.
    stipend:
      c.stipend && typeof c.stipend.amount === "number" && c.stipend.currency
        ? { amount: c.stipend.amount, currency: c.stipend.currency, per: (c.stipend.per ?? c.stipend.period) === "year" ? "year" : "month", startsAfterArrival: true }
        : null,
    accommodation: c.accommodation === "full" ? "full" : c.accommodation === "none" ? "none" : "unknown",
    insurance: c.insurance === "full" ? "full" : c.insurance === "none" ? "none" : "unknown",
    travel: c.travel === "full" ? "full" : c.travel === "none" ? "none" : "unknown",
  };
}
