// Transparent cost and funding-gap calculator. All figures come from the user or a sourced record.
import type { Coverage } from "./types";

export const COST_CATEGORIES = [
  "tuition",
  "living",
  "accommodation",
  "insurance",
  "travel",
  "application",
  "visa",
  "translation",
  "deposit",
] as const;
export type CostCategory = (typeof COST_CATEGORIES)[number];

export interface CostLine {
  category: CostCategory;
  amount: number;
  currency: string;
  period: "once" | "month" | "year";
  /** Paid before arrival (needs cash up front, before any stipend arrives). */
  beforeArrival?: boolean;
}

export interface FinanceInput {
  months: number;
  costs: CostLine[];
  /** PKR per 1 unit of currency, entered by the user (we do not fetch live rates). */
  rates: Record<string, number>;
  coverage?: Coverage;
  sponsorPkr?: number;
  savingsPkr?: number;
}

export interface FinanceResult {
  byCategory: Record<CostCategory, { cost: number; covered: number }>;
  totalCost: number;
  scholarshipValue: number;
  ownFunds: number;
  gap: number;
  upfrontCash: number;
  warnings: string[];
}

function toPkr(amount: number, currency: string, rates: Record<string, number>, warnings: string[]): number {
  if (currency === "PKR") return amount;
  const r = rates[currency];
  if (!r || r <= 0) {
    warnings.push(`No exchange rate entered for ${currency}; those costs are excluded until you add one.`);
    return 0;
  }
  return amount * r;
}

function lineTotal(l: CostLine, months: number): number {
  if (l.period === "once") return l.amount;
  if (l.period === "month") return l.amount * months;
  return l.amount * (months / 12);
}

const round = (n: number) => Math.round(n);

export function calculate(input: FinanceInput): FinanceResult {
  const warnings: string[] = [];
  const months = Math.max(1, Math.floor(input.months));
  const byCategory = Object.fromEntries(COST_CATEGORIES.map((c) => [c, { cost: 0, covered: 0 }])) as FinanceResult["byCategory"];
  let upfront = 0;

  for (const l of input.costs) {
    if (!(l.amount >= 0)) continue;
    const pkr = toPkr(lineTotal(l, months), l.currency, input.rates, warnings);
    byCategory[l.category].cost += pkr;
    if (l.beforeArrival) upfront += pkr;
  }

  const cov = input.coverage ?? {};
  const fullOrNone = (cat: CostCategory, v?: "full" | "partial" | "none") => {
    if (v === "full") byCategory[cat].covered = byCategory[cat].cost;
    if (v === "partial") warnings.push(`Scholarship ${cat} coverage is partial and the amount is not stored; counted as 0 until confirmed.`);
  };

  if (cov.tuition === "full") byCategory.tuition.covered = byCategory.tuition.cost;
  else if (cov.tuitionAmount) {
    const amt = toPkr(lineTotal({ category: "tuition", ...cov.tuitionAmount }, months), cov.tuitionAmount.currency, input.rates, warnings);
    byCategory.tuition.covered = Math.min(amt, byCategory.tuition.cost);
  } else if (cov.tuition === "partial") fullOrNone("tuition", "partial");

  fullOrNone("accommodation", cov.accommodation);
  fullOrNone("travel", cov.travel);
  if (cov.insurance === "full") byCategory.insurance.covered = byCategory.insurance.cost;

  // A stipend pays toward living costs only, and any excess is not counted as spare money.
  if (cov.stipend) {
    const stipend = toPkr(lineTotal({ category: "living", ...cov.stipend }, months), cov.stipend.currency, input.rates, warnings);
    byCategory.living.covered = Math.min(stipend, byCategory.living.cost);
    warnings.push(
      `Stipend usually starts after arrival${cov.paymentStarts ? ` (${cov.paymentStarts})` : ""}; plan cash for the first month.`,
    );
  }

  let totalCost = 0;
  let scholarshipValue = 0;
  for (const c of COST_CATEGORIES) {
    byCategory[c].cost = round(byCategory[c].cost);
    byCategory[c].covered = round(byCategory[c].covered);
    totalCost += byCategory[c].cost;
    scholarshipValue += byCategory[c].covered;
  }
  const ownFunds = round((input.sponsorPkr ?? 0) + (input.savingsPkr ?? 0));
  const gap = Math.max(0, totalCost - scholarshipValue - ownFunds);

  if (input.coverage && Object.keys(input.coverage).length > 0)
    warnings.push("A scholarship does not automatically satisfy visa proof-of-funds rules. Check the embassy's current requirement.");

  return {
    byCategory,
    totalCost,
    scholarshipValue,
    ownFunds,
    gap: round(gap),
    upfrontCash: round(upfront),
    warnings: [...new Set(warnings)],
  };
}
