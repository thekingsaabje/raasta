import { describe, expect, it } from "vitest";
import { assess, checkRule } from "../../shared/eligibility";
import type { Requirement, Rule, Scholarship } from "../../shared/types";

const sch = (over: Partial<Scholarship> = {}): Scholarship => ({
  id: "s1", name: "S", country: "CN", provider: "P", source_id: null, official_url: "https://x", levels: ["master"], applicant_type: "new",
  funding_summary: null, coverage: {}, application_route: null, deadline_date: null, deadline_text: null, academic_year: null,
  status: "NEEDS_REVIEW", writing_policy: "POLICY_UNCONFIRMED", is_test_data: 1, retrieved_at: null, last_verified_at: null,
  evidence_note: null, version: 1, updated_at: "", ...over,
});
const req = (id: string, rule: Rule, review: Requirement["review_status"] = "VERIFIED", mandatory = 1): Requirement => ({
  id, scholarship_id: "s1", type: rule.kind, rule, text: id, excerpt: "e", original_excerpt: null, source_url: "https://x",
  applies_to: null, mandatory, review_status: review, retrieved_at: null, verified_at: null, version: 1,
});

const full = {
  nationality: "PK", targetLevel: "master" as const, highestCompleted: "bachelor" as const,
  grade: { scale: "4" as const, value: 3.4 }, birthDate: "2000-05-01", gapYears: 1,
  languageTests: [{ test: "IELTS", score: 6.5 }], hasExistingScholarship: false, journey: "applying_from_pakistan" as const,
};
const rules = [
  req("nat", { kind: "nationality", allowed: ["PK"] }),
  req("lvl", { kind: "target_level", levels: ["master", "phd"] }),
  req("deg", { kind: "degree_completed", level: "bachelor" }),
  req("gpa", { kind: "min_grade", scale: "4", min: 3.0 }),
  req("age", { kind: "max_age", max: 35, asOf: "2027-09-01" }),
  req("lang", { kind: "language", anyOf: [{ test: "IELTS", min: 6 }, { test: "HSK", min: 4 }] }),
  req("dup", { kind: "existing_scholarship", forbidden: true }),
];

describe("eligibility engine", () => {
  it("MET when every verified mandatory rule is satisfied", () => {
    const a = assess(sch(), rules, full, "2026-10-25");
    expect(a.overall).toBe("MET");
    expect(a.results.every((r) => r.status === "MET")).toBe(true);
  });

  it("NOT_MET when a verified mandatory rule fails", () => {
    const a = assess(sch(), rules, { ...full, grade: { scale: "4", value: 2.6 } });
    expect(a.overall).toBe("NOT_MET");
    expect(a.results.find((r) => r.requirementId === "gpa")!.status).toBe("NOT_MET");
  });

  it("UNKNOWN, never NOT_MET, when information is missing", () => {
    const { birthDate: _b, ...noBirth } = full;
    const a = assess(sch(), rules, noBirth);
    expect(a.overall).toBe("UNKNOWN");
    expect(a.results.find((r) => r.requirementId === "age")!.status).toBe("UNKNOWN");
  });

  it("does not convert grading scales arithmetically", () => {
    expect(checkRule({ kind: "min_grade", scale: "4", min: 3 }, { grade: { scale: "100", value: 80 } }).status).toBe("NEEDS_REVIEW");
  });

  it("German scale: lower is better", () => {
    expect(checkRule({ kind: "min_grade", scale: "german", min: 2.5 }, { grade: { scale: "german", value: 2.0 } }).status).toBe("MET");
    expect(checkRule({ kind: "min_grade", scale: "german", min: 2.5 }, { grade: { scale: "german", value: 3.0 } }).status).toBe("NOT_MET");
  });

  it("existing-scholarship exclusion is a check (timing matters), not an automatic rejection", () => {
    const a = assess(sch(), rules, { ...full, hasExistingScholarship: true });
    expect(a.overall).toBe("NEEDS_REVIEW");
    expect(a.results.find((r) => r.requirementId === "dup")!.reason).toMatch(/ends before/);
  });

  it("a failure against an unverified rule is NEEDS_REVIEW, not a rejection", () => {
    const a = assess(sch(), [req("gpa", { kind: "min_grade", scale: "4", min: 3.0 }, "NEEDS_REVIEW")], { grade: { scale: "4", value: 2.5 } });
    expect(a.overall).toBe("NEEDS_REVIEW");
  });

  it("conflicting sources force review even if the student would pass", () => {
    const a = assess(sch(), [req("nat", { kind: "nationality", allowed: ["PK"] }, "CONFLICTING")], full);
    expect(a.overall).toBe("NEEDS_REVIEW");
    expect(a.results[0].reason).toMatch(/conflict/i);
  });

  it("all met but rules unverified → NEEDS_REVIEW", () => {
    const a = assess(sch(), [req("nat", { kind: "nationality", allowed: ["PK"] }, "NEEDS_REVIEW")], full);
    expect(a.overall).toBe("NEEDS_REVIEW");
  });

  it("no rules stored → UNKNOWN rather than MET", () => {
    expect(assess(sch(), [], full).overall).toBe("UNKNOWN");
  });

  it("expired deadline is reported as passed", () => {
    expect(assess(sch({ deadline_date: "2026-01-10" }), rules, full, "2026-10-25").deadline.state).toBe("passed");
    expect(assess(sch({ deadline_date: "2027-01-10" }), rules, full, "2026-10-25").deadline.state).toBe("open");
    expect(assess(sch({ status: "VERIFIED_CLOSED" }), rules, full).deadline.state).toBe("passed");
  });

  it("applicant type: students abroad may be new to another university, so it's a check, not a rejection", () => {
    expect(checkRule({ kind: "applicant_type", allowed: ["new"] }, { journey: "studying_in_china" }).status).toBe("NEEDS_REVIEW");
    expect(checkRule({ kind: "applicant_type", allowed: ["continuing"] }, { journey: "applying_from_pakistan" }).status).toBe("NOT_MET");
    expect(checkRule({ kind: "applicant_type", allowed: ["new"] }, { journey: "applying_from_pakistan" }).status).toBe("MET");
  });

  it("level-specific rules only apply to that level; malformed rules never throw", () => {
    const deg = { ...req("deg-m", { kind: "degree_completed", level: "master", forLevels: ["phd"] }) };
    const a = assess(sch(), [deg], { targetLevel: "master", highestCompleted: "bachelor" });
    expect(a.results[0].applicable).toBe(false);
    expect(a.overall).toBe("UNKNOWN"); // no applicable rules left
    const p = assess(sch(), [deg], { targetLevel: "phd", highestCompleted: "bachelor" });
    expect(p.overall).toBe("NOT_MET");
    const broken = { ...req("bad", { kind: "nationality" } as any) };
    expect(() => assess(sch(), [broken], { nationality: "PK" })).not.toThrow();
    expect(assess(sch(), [broken], { nationality: "PK" }).results[0].status).toBe("NEEDS_REVIEW");
  });

  it("study gap is only judged against a published limit", () => {
    expect(checkRule({ kind: "max_gap_years", max: 2 }, { gapYears: 3 }).status).toBe("NOT_MET");
    expect(checkRule({ kind: "max_gap_years", max: 2 }, { gapYears: 2 }).status).toBe("MET");
  });

  it("age is computed on the rule's reference date", () => {
    expect(checkRule({ kind: "max_age", max: 35, asOf: "2027-09-01" }, { birthDate: "1991-09-02" }).status).toBe("MET"); // 35
    expect(checkRule({ kind: "max_age", max: 35, asOf: "2027-09-01" }, { birthDate: "1991-09-01" }).status).toBe("NOT_MET"); // 36
    // GKS-U 2027: "born on or after March 1, 2002" is stored as max 24 on 2027-02-28.
    const gks: Rule = { kind: "max_age", max: 24, asOf: "2027-02-28" };
    expect(checkRule(gks, { birthDate: "2002-03-01" }).status).toBe("MET");
    expect(checkRule(gks, { birthDate: "2002-02-28" }).status).toBe("NOT_MET");
  });

  it("an unlisted language test is UNKNOWN, not NOT_MET", () => {
    expect(checkRule({ kind: "language", anyOf: [{ test: "HSK", min: 4 }] }, { languageTests: [{ test: "IELTS", score: 8 }] }).status).toBe("UNKNOWN");
  });

  it("admission/selection/visa rules are reported but don't decide award eligibility", () => {
    const visa = { ...req("visa", { kind: "min_grade", scale: "4", min: 3.9 }), scope: "admission" as const };
    const a = assess(sch(), [...rules, visa], full);
    expect(a.overall).toBe("MET");
    expect(a.results.find((r) => r.requirementId === "visa")!.status).toBe("NOT_MET");
  });

  it("every result carries a next action", () => {
    const { languageTests: _l, ...noLang } = full;
    const a = assess(sch(), rules, noLang);
    expect(a.results.find((r) => r.requirementId === "lang")!.nextAction).toMatch(/language test/);
    expect(a.results.every((r) => r.nextAction.length > 5)).toBe(true);
  });

  it("optional rules do not decide the overall result", () => {
    const a = assess(sch(), [...rules, req("exp", { kind: "min_experience_years", min: 5 }, "VERIFIED", 0)], { ...full, experienceYears: 0 });
    expect(a.overall).toBe("MET");
  });
});
