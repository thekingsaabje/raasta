import { describe, expect, it } from "vitest";
import { calculate } from "../../shared/finance";
import { blockedBy, nextActions, progress, type TaskLike } from "../../shared/progress";
import { capabilities, checkDocument } from "../../shared/writing";
import { generateChecklist } from "../../shared/checklist";
import { classifyFunding } from "../../shared/funding";

describe("finance calculator", () => {
  const base = {
    months: 24,
    rates: { EUR: 300 },
    costs: [
      { category: "tuition" as const, amount: 1500, currency: "EUR", period: "year" as const },
      { category: "living" as const, amount: 900, currency: "EUR", period: "month" as const },
      { category: "visa" as const, amount: 75, currency: "EUR", period: "once" as const, beforeArrival: true },
      { category: "travel" as const, amount: 150000, currency: "PKR", period: "once" as const, beforeArrival: true },
    ],
  };

  it("totals each category over the duration", () => {
    const r = calculate(base);
    expect(r.byCategory.tuition.cost).toBe(1500 * 2 * 300);
    expect(r.byCategory.living.cost).toBe(900 * 24 * 300);
    expect(r.totalCost).toBe(900000 + 6480000 + 22500 + 150000);
    expect(r.upfrontCash).toBe(22500 + 150000);
    expect(r.gap).toBe(r.totalCost);
  });

  it("a stipend covers living costs only, capped at the cost", () => {
    const r = calculate({ ...base, coverage: { stipend: { amount: 1200, currency: "EUR", period: "month" } } });
    expect(r.byCategory.living.covered).toBe(r.byCategory.living.cost);
    expect(r.byCategory.tuition.covered).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/proof-of-funds/);
  });

  it("partial coverage without an amount is not counted", () => {
    const r = calculate({ ...base, coverage: { tuition: "partial" } });
    expect(r.byCategory.tuition.covered).toBe(0);
    expect(r.warnings.join(" ")).toMatch(/partial/);
  });

  it("missing exchange rate is flagged, not guessed", () => {
    const r = calculate({ ...base, rates: {} });
    expect(r.warnings.join(" ")).toMatch(/No exchange rate entered for EUR/);
    expect(r.totalCost).toBe(150000);
  });

  it("own funds reduce the gap and gap never goes negative", () => {
    const r = calculate({ ...base, savingsPkr: 1e9 });
    expect(r.gap).toBe(0);
  });
});

const task = (id: string, over: Partial<TaskLike> = {}): TaskLike => ({
  id, title: id, application_id: "a", requirement_type: "mandatory", applicable: 1, due_date: null, due_confirmed: 0,
  depends_on: [], student_status: "NOT_STARTED", verified_status: "NONE", ...over,
});

describe("progress", () => {
  it("counts only applicable, non-recommended tasks", () => {
    const p = progress([
      task("a", { student_status: "COMPLETED_BY_STUDENT" }),
      task("b"),
      task("c", { requirement_type: "recommended", student_status: "COMPLETED_BY_STUDENT" }),
      task("d", { requirement_type: "conditional", applicable: 0 }),
    ]);
    expect(p).toMatchObject({ total: 2, done: 1, percent: 50, mandatoryRemaining: 1 });
  });

  it("student completion is separate from institutional verification", () => {
    const p = progress([task("a", { student_status: "SUBMITTED" }), task("b", { verified_status: "VERIFIED" })]);
    expect(p.done).toBe(2);
    expect(p.verified).toBe(1);
  });

  it("dependencies block tasks and are excluded from next actions", () => {
    const ts = [task("a"), task("b", { depends_on: ["a"] })];
    expect(blockedBy(ts[1], ts)).toEqual(["a"]);
    expect(progress(ts).blocked).toBe(1);
    expect(nextActions(ts).map((t) => t.id)).toEqual(["a"]);
  });

  it("next actions prefer mandatory and confirmed earliest deadlines", () => {
    const ts = [
      task("rec", { requirement_type: "recommended" }),
      task("late", { due_date: "2027-03-01", due_confirmed: 1 }),
      task("soon", { due_date: "2026-12-01", due_confirmed: 1 }),
      task("unconfirmed", { due_date: "2026-11-01", due_confirmed: 0 }),
    ];
    expect(nextActions(ts).map((t) => t.id)).toEqual(["soon", "late", "unconfirmed"]);
  });
});

describe("writing studio", () => {
  it("policy modes gate drafting", () => {
    expect(capabilities("DRAFTING_ALLOWED").draft).toBe(true);
    expect(capabilities("EDITING_ONLY").draft).toBe(false);
    expect(capabilities("COACHING_ONLY").edit).toBe(false);
    expect(capabilities("POLICY_UNCONFIRMED")).toMatchObject({ draft: false, outline: false, coach: true });
  });

  const base = { requiredSections: [], profile: { grade: { scale: "4" as const, value: 3.4 } }, facts: [{ id: "1", category: "academic", text: "BSc CS" }], institution: "Zhejiang University" };

  it("word limit", () => {
    const issues = checkDocument({ ...base, content: "word ".repeat(120), wordLimit: 100 });
    expect(issues.some((i) => i.code === "over_limit")).toBe(true);
  });

  it("missing required section", () => {
    expect(checkDocument({ ...base, content: "Hello", wordLimit: null, requiredSections: ["Research plan"] }).some((i) => i.code === "missing_section")).toBe(true);
  });

  it("contradiction between text and profile grade", () => {
    expect(checkDocument({ ...base, content: "I graduated with a CGPA of 3.9.", wordLimit: null }).some((i) => i.code === "grade_mismatch")).toBe(true);
    expect(checkDocument({ ...base, content: "I graduated with a CGPA of 3.4.", wordLimit: null }).some((i) => i.code === "grade_mismatch")).toBe(false);
  });

  it("unsupported programme claim: wrong institution named", () => {
    const issues = checkDocument({ ...base, content: "I want to join Tsinghua University.", wordLimit: null, knownInstitutions: ["Tsinghua University", "Zhejiang University"] });
    expect(issues.some((i) => i.code === "wrong_institution")).toBe(true);
  });

  it("empty fact bank and placeholders are flagged", () => {
    const issues = checkDocument({ ...base, facts: [], content: "My project [add details]", wordLimit: null });
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(["no_facts", "placeholder"]));
  });
});

describe("funding classification", () => {
  it("only documented tuition + living + housing is 'full'", () => {
    expect(classifyFunding({ tuition: "full", accommodation: "full", stipend: { amount: 3000, currency: "CNY", period: "month" } })).toBe("full");
    expect(classifyFunding({ tuition: "full" })).toBe("tuition_only");
    expect(classifyFunding({ tuition: "full", stipend: { amount: 1, currency: "EUR", period: "month" } })).toBe("partial");
    expect(classifyFunding({ tuition: "none", stipend: { amount: 1300, currency: "EUR", period: "month" } })).toBe("stipend_only");
    expect(classifyFunding({})).toBe("unknown");
    expect(classifyFunding(null)).toBe("unknown");
  });
});

describe("checklist generation", () => {
  it("deadline only confirmed for verified open records", () => {
    const s: any = { id: "s", name: "X", official_url: "https://x", status: "NEEDS_REVIEW", deadline_date: "2027-01-01", last_verified_at: null, application_route: null };
    const t1 = generateChecklist(s, []);
    expect(t1.find((t) => t.key === "submit")!.due_confirmed).toBe(false);
    const t2 = generateChecklist({ ...s, status: "VERIFIED_OPEN" }, []);
    expect(t2.find((t) => t.key === "submit")!.due_confirmed).toBe(true);
    expect(t2.find((t) => t.key === "submit")!.depends_on).toContain("read_call");
  });
});
