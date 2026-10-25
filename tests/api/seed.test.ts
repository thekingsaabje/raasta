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
});
