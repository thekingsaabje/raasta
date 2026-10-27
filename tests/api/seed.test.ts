import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, makeEnv } from "../helpers";
import { listRequirements } from "../../worker/data";
import { assess } from "../../shared/eligibility";
import { parseRule } from "../../shared/rules";
import type { Profile } from "../../shared/profile";

// Guards the research seed: it must load into the current schema and never claim verification.
describe("research seed", () => {
  it("applies cleanly and keeps every real record unverified", async () => {
    const env = makeEnv();
    await env.DB.exec(readFileSync(join(import.meta.dirname, "..", "..", "seed", "seed.sql"), "utf8"));
    const real = await env.DB.prepare("SELECT COUNT(*) AS n, SUM(status LIKE 'VERIFIED_%') AS v FROM scholarships WHERE is_test_data = 0").first<any>();
    expect(real.n).toBeGreaterThan(0);
    expect(real.v ?? 0).toBe(0);
    const reqs = await env.DB.prepare("SELECT COUNT(*) AS n FROM requirements r JOIN scholarships s ON s.id = r.scholarship_id WHERE s.is_test_data = 0 AND r.review_status = 'VERIFIED'").first<any>();
    expect(reqs.n).toBe(0);
    const tests = await env.DB.prepare("SELECT name FROM scholarships WHERE is_test_data = 1").all<any>();
    for (const t of tests.results) expect(t.name).toMatch(/^\[TEST\]/);

    // A research record with only manual rules can never come out as MET.
    const a = client(env);
    await a.register("s@test.local");
    await a.put("/me/profile", { nationality: "PK", targetLevel: "master" });
    const all = (await a.get("/me/assessments")).json.assessments;
    for (const x of all.filter((x: any) => !x.scholarship.is_test_data)) expect(x.assessment.overall).not.toBe("MET");
  });

  it("verification update is idempotent and every verified status carries a verbatim quote", async () => {
    const env = makeEnv();
    const root = join(import.meta.dirname, "..", "..");
    await env.DB.exec(readFileSync(join(root, "seed", "seed.sql"), "utf8"));
    const upd = readFileSync(join(root, "seed", "verification-update.sql"), "utf8");
    await env.DB.exec(upd);
    const snap = async () => env.DB.prepare("SELECT (SELECT COUNT(*) FROM requirements) r, (SELECT COUNT(*) FROM record_history) h, (SELECT SUM(version) FROM scholarships) v, (SELECT COUNT(*) FROM review_tasks) t").first<any>();
    const first = await snap();
    await env.DB.exec(upd);
    expect(await snap()).toEqual(first);

    // Research never verifies anything: no VERIFIED_* records and no verified rules on real data.
    const verified = await env.DB.prepare("SELECT COUNT(*) n FROM scholarships WHERE status LIKE 'VERIFIED_%' AND is_test_data = 0").first<any>();
    expect(verified.n).toBe(0);
    const vr = await env.DB.prepare("SELECT COUNT(*) n FROM requirements r JOIN scholarships s ON s.id = r.scholarship_id WHERE r.review_status = 'VERIFIED' AND s.is_test_data = 0").first<any>();
    expect(vr.n).toBe(0);
  });

  it("status sync: research cycle kept as evidence, every real record explained, idempotent, reviewer records untouched", async () => {
    const env = makeEnv();
    const root = join(import.meta.dirname, "..", "..");
    await env.DB.exec(readFileSync(join(root, "seed", "seed.sql"), "utf8"));
    await env.DB.exec(readFileSync(join(root, "seed", "verification-update.sql"), "utf8"));
    // Simulate the live state before the policy change: one research-verified record, one reviewer-confirmed record.
    await env.DB.exec("UPDATE scholarships SET status = 'VERIFIED_OPEN', verification_method = 'agent_evidence', deadline_date = '2026-12-15' WHERE id = 'it-polimi-gold';");
    await env.DB.exec("UPDATE scholarships SET status = 'VERIFIED_CLOSED', verification_method = 'human', status_reason = NULL WHERE id = 'it-maeci';");
    const sync = readFileSync(join(root, "seed", "status-sync.sql"), "utf8");
    await env.DB.exec(sync);
    const snap = async () => env.DB.prepare("SELECT (SELECT COUNT(*) FROM record_history) h, (SELECT SUM(version) FROM scholarships) v, (SELECT COUNT(*) FROM review_tasks) t").first<any>();
    const first = await snap();
    await env.DB.exec(sync);
    expect(await snap()).toEqual(first);

    const gold = await env.DB.prepare("SELECT * FROM scholarships WHERE id = 'it-polimi-gold'").first<any>();
    expect(gold).toMatchObject({ status: "NEEDS_REVIEW", cycle_state: "open", proposed_deadline: "2026-12-15", deadline_date: null });
    expect(gold.status_reason).toMatch(/not confirmed/);
    const maeci = await env.DB.prepare("SELECT status, verification_method FROM scholarships WHERE id = 'it-maeci'").first<any>();
    expect(maeci).toEqual({ status: "VERIFIED_CLOSED", verification_method: "human" });
    const cycles = (await env.DB.prepare("SELECT cycle_state, COUNT(*) n FROM scholarships WHERE is_test_data = 0 AND verification_method IS NOT 'human' GROUP BY cycle_state").all<any>()).results;
    expect(Object.fromEntries(cycles.map((c: any) => [c.cycle_state, c.n]))).toEqual({ open: 5, upcoming: 1, closed: 11, unknown: 14 });
    const unexplained = await env.DB.prepare("SELECT COUNT(*) n FROM scholarships WHERE is_test_data = 0 AND status != 'VERIFIED_CLOSED' AND (status_reason IS NULL OR status_reason = '')").first<any>();
    expect(unexplained.n).toBe(0);
  });

  it("cost references load; every verified figure has a quote, a link and a date", async () => {
    const env = makeEnv();
    await env.DB.exec(readFileSync(join(import.meta.dirname, "..", "..", "seed", "cost-references.sql"), "utf8"));
    const all = (await env.DB.prepare("SELECT * FROM cost_references").all<any>()).results;
    expect(all.length).toBeGreaterThan(50);
    for (const r of all.filter((x: any) => x.status === "VERIFIED")) {
      expect(r.excerpt, r.id).toBeTruthy();
      expect(r.source_url, r.id).toMatch(/^https?:\/\//);
      expect(r.checked_at, r.id).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
    for (const r of all) if (r.amount !== null && r.amount_max !== null) expect(r.amount_max, r.id).toBeGreaterThanOrEqual(r.amount);
  });

  it("real data through the eligibility engine: no crashes, every rule valid, every NOT_MET explained", async () => {
    const env = makeEnv();
    const root = join(import.meta.dirname, "..", "..");
    await env.DB.exec(readFileSync(join(root, "seed", "seed.sql"), "utf8"));
    await env.DB.exec(readFileSync(join(root, "seed", "verification-update.sql"), "utf8"));
    const reqs = await listRequirements(env.DB);
    for (const r of reqs) expect(parseRule(r.rule), `rule ${r.id}`).not.toBeNull();
    const { results } = await env.DB.prepare("SELECT * FROM scholarships WHERE is_test_data = 0").all<any>();
    const profiles: Record<string, Profile> = {
      pkMaster: { nationality: "PK", journey: "applying_from_pakistan", targetLevel: "master", highestCompleted: "bachelor", birthDate: "2001-05-01", grade: { scale: "4", value: 3.3 }, languageTests: [{ test: "IELTS", score: 6.5 }], hasExistingScholarship: false, targetField: "Computer Science" },
      empty: {},
      chinaContinuing: { nationality: "PK", journey: "studying_in_china", targetLevel: "master", highestCompleted: "bachelor", hasExistingScholarship: true },
    };
    const notMet: string[] = [];
    for (const [name, p] of Object.entries(profiles))
      for (const row of results) {
        const s = { ...row, levels: JSON.parse(row.levels), coverage: JSON.parse(row.coverage) };
        const a = assess(s, reqs.filter((r) => r.scholarship_id === s.id), p, "2026-10-25");
        if (a.overall === "NOT_MET") {
          const cause = a.results.filter((r) => r.status === "NOT_MET" && r.ruleVerified && r.applicable);
          expect(cause.length, `${name}/${s.id}`).toBeGreaterThan(0);
          notMet.push(`${name} × ${s.id}: ${cause.map((c) => c.reason).join("; ")}`);
        }
      }
    // Every rejection must be one we have reviewed by hand (see SOURCE_POLICY.md). An unexpected entry fails here.
    expect(notMet.sort()).toMatchSnapshot();
  });
});
