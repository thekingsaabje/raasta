// Expected values below were calculated by hand (see comments), not copied from the engine's output.
import { describe, expect, it } from "vitest";
import { convert, periods, plan, termsFromCoverage, type AwardTerms, type CostLine, type PlanInput } from "../../shared/planner";

const src = { status: "ESTIMATE" as const };
const line = (id: string, category: CostLine["category"], amount: number | null, currency: string, freq: CostLine["freq"], stage: CostLine["stage"], extra: Partial<CostLine> = {}): CostLine => ({ id, category, label: id, amount, currency, freq, stage, source: src, ...extra });

// 24-month German Master's, EUR at 300 PKR.
const germany: PlanInput = {
  months: 24,
  rates: { pkrPer: { EUR: 300 }, source: "test", date: "2026-10-25" },
  costs: [
    line("tuition", "tuition", 1500, "EUR", "semester", "during_study"), // 4 semesters → 6,000 EUR = 1,800,000
    line("semester fee", "fees", 150, "EUR", "semester", "during_study"), // 600 EUR = 180,000
    line("rent", "accommodation", 400, "EUR", "month", "during_study"), // 9,600 EUR = 2,880,000
    line("living", "living", 500, "EUR", "month", "during_study"), // 12,000 EUR = 3,600,000
    line("insurance", "insurance", 140, "EUR", "month", "during_study"), // 3,360 EUR = 1,008,000
    line("visa", "visa", 75, "EUR", "once", "before_visa"), // 22,500
    line("flight", "travel", 150000, "PKR", "once", "before_departure"), // 150,000
    line("rent deposit", "deposit", 800, "EUR", "once", "on_arrival", { depositType: "refundable" }), // 240,000 cash, not cost
    line("tuition deposit", "deposit", 1500, "EUR", "once", "before_visa", { depositType: "prepayment" }), // 450,000 cash, already in tuition
  ],
  awards: [],
  funds: { savings: { amount: 3_000_000, currency: "PKR" }, sponsor: { amount: 2000, currency: "EUR" } }, // 3,600,000
};

describe("cost planner — no scholarship", () => {
  const r = plan(germany);
  const b = r.scenarios[0];

  it("programme, first-year and typical-year totals", () => {
    expect(b.programmeCost).toBe(9_640_500); // 1.8M + 0.18M + 2.88M + 3.6M + 1.008M + 22.5k + 150k
    expect(b.firstYearCost).toBe(4_906_500); // 0.9M + 90k + 1.44M + 1.8M + 504k + 22.5k + 150k
    expect(b.typicalYearCost).toBe(4_734_000); // recurring only: 0.9M + 90k + 1.44M + 1.8M + 504k
  });

  it("deposits are never double counted", () => {
    expect(b.rows.find((x) => x.category === "deposit")).toBeUndefined();
    expect(b.refundableDeposits).toBe(240_000);
  });

  it("cash by stage, with the prepaid deposit moved earlier", () => {
    const st = Object.fromEntries(b.stages.map((s) => [s.stage, s.amount]));
    expect(st.before_visa).toBe(472_500); // visa 22.5k + tuition deposit 450k
    expect(st.before_departure).toBe(150_000);
    expect(st.on_arrival).toBe(240_000);
    expect(st.during_study).toBe(4_284_000); // 4.734M recurring first year − 450k prepaid
    expect(b.upfrontCash).toBe(862_500);
  });

  it("gap against money the student actually has", () => {
    expect(b.available).toBe(3_600_000);
    expect(b.gap).toBe(6_280_500); // 9,640,500 + 240,000 refundable − 3,600,000
    expect(b.gapFirstYear).toBe(1_546_500); // 4,906,500 + 240,000 − 3,600,000
  });
});

describe("cost planner — scholarships", () => {
  const daadLike: AwardTerms = {
    id: "a", name: "Potential award", status: "potential", source: src,
    tuition: { type: "full" },
    stipend: { amount: 934, currency: "EUR", per: "month", startsAfterArrival: true },
    accommodation: "unknown", insurance: "full", travel: "none",
  };

  it("potential award: covers by category, stipend only for monthly costs, never added to available funds", () => {
    const r = plan({ ...germany, awards: [daadLike] });
    const p = r.scenarios.find((s) => s.key === "potential")!;
    // tuition 1.8M + insurance 1.008M + stipend (23 paid months × 280,200 = 6,444,600 → living 3.6M, rent 2,844,600)
    expect(p.covered).toBe(9_252_600);
    expect(p.remaining).toBe(387_900);
    expect(p.available).toBe(3_600_000);
    expect(p.gap).toBe(0);
    expect(p.rows.find((x) => x.category === "fees")!.covered).toBe(0); // semester fee is not tuition
    expect(p.rows.find((x) => x.category === "visa")!.covered).toBe(0); // one-time costs not paid by stipend
    // first year: tuition 900k + insurance 504k + stipend 11 × 280,200 = 3,082,200 → living 1.8M, rent 1,282,200
    expect(p.remainingFirstYear).toBe(420_300);
    expect(p.notes.join(" ")).toMatch(/first month/);
    expect(r.conclusion.join(" ")).toMatch(/Potential awards are not money you have/);
  });

  it("partial tuition waiver for half of the programme", () => {
    const half: AwardTerms = { ...daadLike, status: "confirmed", stipend: null, insurance: "none", tuition: { type: "percent", percent: 50 }, durationMonths: 12 };
    const c = plan({ ...germany, awards: [half] }).scenarios.find((s) => s.key === "confirmed")!;
    expect(c.covered).toBe(450_000); // 50% of 2 semesters (12 award months) = 0.5 × 900,000
    expect(c.notes.join(" ")).toMatch(/runs 12 of 24 months/);
  });

  it("tuition-only award leaves living costs fully payable", () => {
    const t: AwardTerms = { ...daadLike, status: "confirmed", stipend: null, insurance: "none" };
    const c = plan({ ...germany, awards: [t] }).scenarios.find((s) => s.key === "confirmed")!;
    expect(c.covered).toBe(1_800_000);
    expect(c.rows.find((x) => x.category === "living")!.remaining).toBe(3_600_000);
  });

  it("fixed tuition amount is capped at the actual tuition", () => {
    const t: AwardTerms = { ...daadLike, status: "confirmed", stipend: null, insurance: "none", tuition: { type: "amount", amount: 5000, currency: "EUR", per: "year" } };
    const c = plan({ ...germany, awards: [t] }).scenarios.find((s) => s.key === "confirmed")!;
    expect(c.rows.find((x) => x.category === "tuition")!.covered).toBe(1_800_000); // 2 × 5,000 EUR > 6,000 EUR tuition
  });

  it("stipend paid 10 months a year", () => {
    const s: AwardTerms = { ...daadLike, status: "confirmed", tuition: { type: "none" }, insurance: "none", stipend: { amount: 300, currency: "EUR", per: "month", monthsPerYear: 10 } };
    const c = plan({ ...germany, awards: [s] }).scenarios.find((x) => x.key === "confirmed")!;
    expect(c.rows.find((x) => x.category === "living")!.covered).toBe(1_800_000); // 20 paid months × 90,000
  });

  it("'fully funded' label without documented terms covers nothing", () => {
    const t = termsFromCoverage("x", "Fully funded (label only)", {}, src);
    const p = plan({ ...germany, awards: [t] }).scenarios.find((s) => s.key === "potential")!;
    expect(p.covered).toBe(0);
    expect(p.notes.join(" ")).toMatch(/not documented/);
  });
});

describe("cost planner — edge cases", () => {
  it("unknown amounts are excluded and listed", () => {
    const r = plan({ ...germany, costs: [...germany.costs, line("lab fee", "fees", null, "EUR", "once", "on_arrival")] });
    expect(r.missing).toEqual(["lab fee: amount not known yet"]);
    expect(r.scenarios[0].programmeCost).toBe(9_640_500);
    expect(r.evidence.UNKNOWN).toBe(1);
  });

  it("no exchange rate: line is not converted or guessed", () => {
    const r = plan({ ...germany, costs: [line("dorm", "accommodation", 1000, "CNY", "month", "during_study")] });
    expect(r.unconverted).toEqual(["dorm (CNY)"]);
    expect(r.scenarios[0].programmeCost).toBe(0);
  });

  it("different durations", () => {
    expect(periods("year", 18)).toBe(2);
    expect(periods("semester", 18)).toBe(3);
    expect(periods("month", 18)).toBe(18);
    const r = plan({ ...germany, months: 36 });
    expect(r.scenarios[0].programmeCost).toBe(1500 * 6 * 300 + 150 * 6 * 300 + (400 + 500 + 140) * 36 * 300 + 22_500 + 150_000);
  });

  it("insufficient funds and contribution limit", () => {
    const r = plan({ ...germany, funds: { savings: { amount: 1_000_000, currency: "PKR" }, maxContribution: { amount: 2_000_000, currency: "PKR" } } });
    expect(r.scenarios[0].gap).toBe(9_640_500 + 240_000 - 1_000_000);
    expect(r.scenarios[0].overContribution).toBe(9_640_500 - 2_000_000);
  });

  it("currency conversion and rounding", () => {
    const rates = { pkrPer: { EUR: 300.5, CNY: 38.7 }, source: "t", date: null };
    expect(convert(601, "EUR", rates)).toBe(2);
    expect(convert(1000, "USD", rates)).toBeNull();
    const r = plan({ ...germany, rates, costs: [line("x", "living", 333.33, "EUR", "month", "during_study")], months: 3 });
    expect(r.scenarios[0].programmeCost).toBe(Math.round(333.33 * 300.5 * 3));
  });
});
