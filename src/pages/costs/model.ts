// Conversation answers → planner input. Defaults come only from official references; otherwise blank (unknown).
import type { AwardTerms, CostLine, PlanCategory, PlanInput, Source } from "../../../shared/planner";

export type Country = "CN" | "DE" | "IT" | "KR";
export type ScholarshipSituation = "none" | "exploring" | "applied" | "partial_offer" | "full_offer" | "confirmed";

export interface Reference {
  id: string;
  country: string;
  kind: "cost" | "proof_of_funds";
  category: string;
  label: string;
  amount: number | null;
  amount_max: number | null;
  currency: string;
  unit: "once" | "month" | "semester" | "year";
  applies_to: string | null;
  authority: string | null;
  source_url: string | null;
  excerpt: string | null;
  status: "VERIFIED" | "OFFICIAL_ESTIMATE" | "NEEDS_REVIEW";
  checked_at: string | null;
  evidence_types: string[] | null;
  notes: string | null;
}

export interface Answers {
  country?: Country;
  city?: string;
  university?: string;
  level?: "bachelor" | "master" | "phd";
  programme?: string;
  months?: number;
  start?: string;
  situation?: "applying" | "admitted" | "studying" | "continuing_award";
  schol?: ScholarshipSituation;
  potentialIds: string[];
  awards: AwardTerms[];
  costs: CostLine[];
  funds: PlanInput["funds"];
  display: string;
  rateOverrides: Record<string, number>;
}

export const emptyAnswers = (): Answers => ({ potentialIds: [], awards: [], costs: [], funds: {}, display: "PKR", rateOverrides: {} });

export const HOME_CURRENCY: Record<Country, string> = { CN: "CNY", DE: "EUR", IT: "EUR", KR: "KRW" };

const REF_CATEGORY: Record<string, PlanCategory> = {
  tuition: "tuition", semester_fee: "fees", accommodation: "accommodation", living: "living", insurance: "insurance",
  visa: "visa", residence_permit: "visa", documents: "documents", travel: "travel", deposit: "deposit",
  application: "application", medical_exam: "documents",
};

export function sourceOf(r: Reference): Source {
  return {
    status: r.status === "VERIFIED" ? "VERIFIED" : r.status === "OFFICIAL_ESTIMATE" ? "OFFICIAL_ESTIMATE" : "ESTIMATE",
    url: r.source_url ?? undefined,
    authority: r.authority ?? undefined,
    checked: r.checked_at ?? undefined,
    note: r.applies_to ?? undefined,
  };
}

/** Cost lines a reference can prefill. Ranges use the UPPER end so a funding gap is never understated. */
export function lineFromRef(r: Reference, id: string, stage: CostLine["stage"]): CostLine {
  return {
    id,
    category: REF_CATEGORY[r.category] ?? "other",
    label: r.label,
    amount: r.amount_max ?? r.amount,
    currency: r.currency,
    freq: r.unit,
    stage,
    source: { ...sourceOf(r), note: [r.applies_to, r.amount_max ? `range ${r.amount}–${r.amount_max} ${r.currency}; upper end used to be safe` : null].filter(Boolean).join(" · ") || undefined },
  };
}

export const userSource: Source = { status: "USER" };
export const unknownSource: Source = { status: "UNKNOWN" };

export function upsertLine(costs: CostLine[], line: CostLine): CostLine[] {
  const i = costs.findIndex((c) => c.id === line.id);
  if (i === -1) return [...costs, line];
  const next = costs.slice();
  next[i] = line;
  return next;
}
export const removeLine = (costs: CostLine[], id: string) => costs.filter((c) => c.id !== id);

/** One-time and recurring extras we suggest per country, matched to references by category. */
export const EXTRA_SUGGESTIONS: { id: string; category: string; label: string; freq: CostLine["freq"]; stage: CostLine["stage"]; depositType?: CostLine["depositType"] }[] = [
  { id: "application", category: "application", label: "Application / registration fees", freq: "once", stage: "before_application" },
  { id: "documents", category: "documents", label: "Attestation, translation & documents", freq: "once", stage: "before_application" },
  { id: "visa", category: "visa", label: "Student visa fee", freq: "once", stage: "before_visa" },
  { id: "medical", category: "medical_exam", label: "Medical examination", freq: "once", stage: "before_visa" },
  { id: "travel", category: "travel", label: "Flight to destination", freq: "once", stage: "before_departure" },
  { id: "permit", category: "residence_permit", label: "Residence permit", freq: "once", stage: "on_arrival" },
  { id: "insurance", category: "insurance", label: "Health insurance", freq: "month", stage: "during_study" },
  { id: "rent_deposit", category: "deposit", label: "Rent deposit (refundable)", freq: "once", stage: "on_arrival", depositType: "refundable" },
  { id: "tuition_deposit", category: "deposit", label: "Tuition deposit (part of tuition)", freq: "once", stage: "before_visa", depositType: "prepayment" },
];

/** References for a category that fit the degree level (rows that name a different level are dropped). */
export function refsForLevel(refs: Reference[], category: string, level?: string): Reference[] {
  const words: Record<string, RegExp> = { bachelor: /bachelor|undergrad/i, master: /master|graduate|postgrad/i, phd: /phd|doctora/i };
  return refs
    .filter((r) => r.kind === "cost" && r.category === category && r.amount !== null && r.status !== "NEEDS_REVIEW")
    .filter((r) => {
      if (!level) return true;
      const text = `${r.label} ${r.applies_to ?? ""}`;
      const named = Object.entries(words).filter(([, re]) => re.test(text)).map(([k]) => k);
      return named.length === 0 || named.includes(level);
    });
}

export function bestRef(refs: Reference[], category: string, kind: "cost" | "proof_of_funds" = "cost"): Reference | undefined {
  const rank = { VERIFIED: 0, OFFICIAL_ESTIMATE: 1, NEEDS_REVIEW: 2 } as const;
  // Best evidence first; among equals, the higher figure (a plan should not understate costs).
  // Compare per year so a monthly figure isn't ranked below a yearly one just because its number is smaller.
  const perYear = { once: 1, month: 12, semester: 2, year: 1 } as const;
  const top = (r: Reference) => (r.amount_max ?? r.amount ?? 0) * perYear[r.unit];
  return refs.filter((r) => r.kind === kind && r.category === category && r.amount !== null).sort((a, b) => rank[a.status] - rank[b.status] || top(b) - top(a))[0];
}

export function toInput(a: Answers, rates: { pkrPer: Record<string, number>; source: string; date: string | null }): PlanInput {
  return {
    months: a.months ?? 12,
    costs: a.costs,
    awards: a.awards,
    funds: a.funds,
    rates: { pkrPer: { ...rates.pkrPer, ...a.rateOverrides }, source: Object.keys(a.rateOverrides).length ? `${rates.source} + your own rates` : rates.source, date: rates.date },
  };
}

export function contextOf(a: Answers) {
  const ctx: Record<string, string | number | boolean | null | string[]> = {};
  for (const k of ["country", "city", "university", "level", "programme", "months", "start", "situation", "schol", "display"] as const) {
    const v = a[k];
    if (v !== undefined && v !== "") ctx[k] = v as string | number;
  }
  ctx.potentialIds = a.potentialIds;
  for (const [cur, v] of Object.entries(a.rateOverrides)) ctx[`rate_${cur}`] = v;
  return ctx;
}

export function answersFrom(input: PlanInput, ctx: Record<string, any>): Answers {
  const rateOverrides: Record<string, number> = {};
  for (const [k, v] of Object.entries(ctx)) if (k.startsWith("rate_") && typeof v === "number") rateOverrides[k.slice(5)] = v;
  return {
    ...emptyAnswers(),
    country: ctx.country, city: ctx.city, university: ctx.university, level: ctx.level, programme: ctx.programme,
    months: input.months, start: ctx.start, situation: ctx.situation, schol: ctx.schol, display: ctx.display ?? "PKR",
    potentialIds: ctx.potentialIds ?? [], awards: input.awards, costs: input.costs, funds: input.funds, rateOverrides,
  };
}
