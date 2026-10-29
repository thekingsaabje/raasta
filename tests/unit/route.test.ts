import { describe, expect, it } from "vitest";
import { classify, evaluateRoute } from "../../shared/route";
import type { Requirement, Rule, Scholarship } from "../../shared/types";

const sch = (over: Partial<Scholarship> = {}): Scholarship => ({
  id: "s1", name: "Award", country: "IT", provider: "P", source_id: null, official_url: "https://x", levels: ["master"], applicant_type: "new",
  funding_summary: null, coverage: {}, application_route: null, deadline_date: null, deadline_text: null, academic_year: null,
  status: "NEEDS_REVIEW", writing_policy: "POLICY_UNCONFIRMED", is_test_data: 0, retrieved_at: null, last_verified_at: null,
  evidence_note: null, version: 1, updated_at: "", cycle_state: "open", proposed_deadline: "2026-12-15", verification_method: "agent_evidence", ...over,
});
const req = (id: string, rule: Rule, review: Requirement["review_status"] = "NEEDS_REVIEW", sid = "s1"): Requirement => ({
  id, scholarship_id: sid, type: rule.kind, rule, text: id, excerpt: "quote", original_excerpt: null, source_url: "https://x",
  applies_to: null, mandatory: 1, review_status: review, retrieved_at: null, verified_at: null, version: 1,
});
const pk = { nationality: "PK", targetLevel: "master" as const, highestCompleted: "bachelor" as const, journey: "applying_from_pakistan" as const };
const T = "2026-10-27";

describe("fit classification", () => {
  it("research evidence alone never gives a VERIFIED_FIT", () => {
    const f = classify(sch(), [req("n", { kind: "nationality", allowed: ["PK"] }, "VERIFIED")], pk, T);
    expect(f.fit).toBe("POTENTIAL_FIT");
    expect(f.confirmedByReviewer).toBe(false);
    expect(f.deadline).toEqual({ date: "2026-12-15", confirmed: false });
  });

  it("VERIFIED_FIT needs a reviewer-confirmed open record and verified, met rules", () => {
    const s = sch({ status: "VERIFIED_OPEN", verification_method: "human", deadline_date: "2026-12-15" });
    expect(classify(s, [req("n", { kind: "nationality", allowed: ["PK"] }, "VERIFIED")], pk, T).fit).toBe("VERIFIED_FIT");
    // same record but the rule is still unverified → only potential
    expect(classify(s, [req("n", { kind: "nationality", allowed: ["PK"] })], pk, T).fit).toBe("POTENTIAL_FIT");
  });

  it("an unverified 'not met' is LIKELY_INELIGIBLE, never a potential fit; a verified one is NOT_ELIGIBLE", () => {
    const iyt = [req("n", { kind: "nationality", allowed: ["IN", "BD"] })];
    const f = classify(sch(), iyt, pk, T);
    expect(f.fit).toBe("LIKELY_INELIGIBLE");
    expect(f.notMet[0].excerpt).toBe("quote");
    expect(classify(sch(), [req("n", { kind: "nationality", allowed: ["IN"] }, "VERIFIED")], pk, T).fit).toBe("NOT_ELIGIBLE");
  });

  it("closed rounds go to CLOSED, whether confirmed or per the official page", () => {
    expect(classify(sch({ cycle_state: "closed" }), [], pk, T).fit).toBe("CLOSED");
    expect(classify(sch({ status: "VERIFIED_CLOSED", verification_method: "human" }), [], pk, T).fit).toBe("CLOSED");
  });

  it("missing profile data → NEEDS_CONFIRMATION, never a rejection", () => {
    const f = classify(sch(), [req("g", { kind: "min_grade", scale: "4", min: 3 })], pk, T);
    expect(f.fit).toBe("NEEDS_CONFIRMATION");
    expect(f.missing).toHaveLength(1);
  });

  it("'read it yourself' conditions don't block a potential fit", () => {
    expect(classify(sch(), [req("m", { kind: "manual" })], pk, T).fit).toBe("POTENTIAL_FIT");
  });
});

describe("route evaluation", () => {
  const list = [
    sch({ id: "a", country: "IT" }),
    sch({ id: "b", country: "DE" }),
    sch({ id: "c", country: "IT", levels: ["phd"] }),
    sch({ id: "t", country: "IT", is_test_data: 1, name: "[TEST] x" }),
  ];
  it("filters by target country and level and never includes test data", () => {
    const r = evaluateRoute({ ...pk, targetCountries: ["IT"] }, list, [], T);
    expect(r.items.map((i) => i.id)).toEqual(["a"]);
    expect(r.routes.map((x) => x.country)).toEqual(["IT"]);
  });
  it("lists missing profile items and next actions, with no probabilities", () => {
    const r = evaluateRoute({ targetLevel: "master" }, list, [], T);
    expect(r.missingProfile).toContain("nationality");
    expect(r.nextActions.some((n) => n.to === "/costs")).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/probabilit|chance of (getting|winning)|%/i);
  });
});

describe("Pakistan exclusions, timing and guidance", () => {
  it("a residence-based country list (DAAD selector) excludes applicants living in Pakistan, not Pakistanis abroad", () => {
    const daad = [req("r", { kind: "residence_excluded", countries: ["PK"] })];
    expect(classify(sch({ country: "DE" }), daad, pk, T).fit).toBe("LIKELY_INELIGIBLE");
    const abroad = { ...pk, journey: "studying_in_germany_italy" as const, currentCountry: "IT" as const };
    expect(classify(sch({ country: "DE" }), daad, abroad, T).fit).not.toBe("LIKELY_INELIGIBLE");
    expect(classify(sch({ country: "DE" }), daad, { nationality: "PK", targetLevel: "master" }, T).fit).toBe("NEEDS_CONFIRMATION");
  });

  it("a nationality left off a published list is likely ineligible; others must still check the list", () => {
    const maeci = [req("n", { kind: "nationality_excluded", countries: ["PK"] })];
    expect(classify(sch(), maeci, pk, T).fit).toBe("LIKELY_INELIGIBLE");
    expect(classify(sch(), maeci, { ...pk, nationality: "IN" }, T).fit).toBe("NEEDS_CONFIRMATION");
  });

  it("students already abroad see new-applicant awards with a caveat, and no 'book a language test' step", () => {
    const hamza = { nationality: "PK", journey: "studying_in_china" as const, currentCountry: "CN" as const, targetLevel: "bachelor" as const };
    const r = evaluateRoute(hamza, [sch({ country: "CN", levels: ["bachelor"] })], [], T);
    expect(r.items[0].timing).toMatch(/new applicants/);
    expect(r.nextActions.map((n) => n.title).join(" ")).not.toMatch(/language test/i);
    expect(r.nextActions.some((n) => /international office/i.test(n.title))).toBe(true);
  });

  it("awards you apply for after admission are labelled for applicants still in Pakistan", () => {
    const r = evaluateRoute(pk, [sch({ id: "de-deutschlandstipendium", country: "DE", applicant_type: "both" })], [], T);
    expect(r.items[0].timing).toMatch(/after a university/);
  });

  it("guidance is specific to the qualification and country, with official links and no amounts", () => {
    const fsc = { ...pk, targetLevel: "bachelor" as const, highestCompleted: "intermediate" as const, targetCountries: ["IT" as const] };
    const g = evaluateRoute(fsc, [], [], T).nextActions;
    expect(g.some((n) => n.href === "https://ibcc.edu.pk")).toBe(true);
    expect(g.some((n) => n.href === "https://www.universitaly.it")).toBe(true);
    expect(g.map((n) => n.why).join(" ")).not.toMatch(/\d{3,}|€|PKR|EUR/);
  });
});
