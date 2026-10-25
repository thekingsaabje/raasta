import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { client, makeEnv } from "../helpers";

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

    const verified = (await env.DB.prepare("SELECT id, verification_method FROM scholarships WHERE status LIKE 'VERIFIED_%' AND is_test_data = 0").all<any>()).results;
    expect(verified.length).toBeGreaterThan(0);
    for (const s of verified) {
      expect(s.verification_method).toBe("agent_evidence");
      const q = await env.DB.prepare("SELECT COUNT(*) n FROM requirements WHERE scholarship_id = ? AND excerpt IS NOT NULL").bind(s.id).first<any>();
      expect(q.n).toBeGreaterThan(0);
    }
    // Verified rules exist only on verified (current-cycle) records.
    const stray = await env.DB.prepare("SELECT COUNT(*) n FROM requirements r JOIN scholarships s ON s.id = r.scholarship_id WHERE r.review_status = 'VERIFIED' AND s.is_test_data = 0 AND s.status NOT LIKE 'VERIFIED_%'").first<any>();
    expect(stray.n).toBe(0);
    // Open/upcoming records carry a checked deadline date.
    const noDate = await env.DB.prepare("SELECT COUNT(*) n FROM scholarships WHERE status IN ('VERIFIED_OPEN','VERIFIED_UPCOMING') AND deadline_date IS NULL").first<any>();
    expect(noDate.n).toBe(0);
  });
});
