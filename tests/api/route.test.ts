import { afterEach, describe, expect, it, vi } from "vitest";
import { client, makeEnv, seedRequirement, seedScholarship } from "../helpers";

// No network in tests: the exchange-rate service is stubbed.
vi.stubGlobal("fetch", (async () => new Response(JSON.stringify({ result: "success", time_last_update_utc: "Mon, 26 Oct 2026 00:00:00 +0000", rates: { EUR: 0.0032, CNY: 0.025 } }))) as unknown as typeof fetch);
afterEach(() => undefined);

async function setup() {
  const env = makeEnv();
  await seedScholarship(env, { id: "it-a", name: "Italy award", country: "IT", is_test_data: 0, levels: '["master"]' });
  await env.DB.exec("UPDATE scholarships SET cycle_state = 'open', proposed_deadline = '2026-12-15', status_reason = 'Looks open, not confirmed.' WHERE id = 'it-a';");
  await seedRequirement(env, "it-a-r1", "it-a", { kind: "nationality", allowed: ["IN"] }, "NEEDS_REVIEW"); // official text excludes PK, unverified
  await seedScholarship(env, { id: "it-b", name: "Italy award B", country: "IT", is_test_data: 0, levels: '["master"]' });
  await seedScholarship(env, { id: "test-x", name: "[TEST] x", country: "IT", is_test_data: 1 });
  await env.DB.prepare("INSERT INTO cost_references (id, country, kind, category, label, amount, amount_max, currency, unit, status) VALUES ('t1','IT','cost','tuition','Master tuition',3000,NULL,'EUR','year','VERIFIED'), ('l1','IT','cost','living','Living',200,NULL,'EUR','month','OFFICIAL_ESTIMATE'), ('a1','IT','cost','accommodation','Rent',500,700,'EUR','month','OFFICIAL_ESTIMATE')").run();
  return env;
}

describe("route evaluation API", () => {
  it("works logged out, excludes test data, keeps unverified exclusions out of potential fits, and labels the money estimate", async () => {
    const env = await setup();
    const r = await client(env).post("/route/evaluate", { profile: { nationality: "PK", targetLevel: "master", targetCountries: ["IT"], journey: "applying_from_pakistan", budgetPkr: 1_000_000 } });
    expect(r.status).toBe(200);
    const fits = Object.fromEntries(r.json.items.map((i: any) => [i.id, i.fit]));
    expect(fits).toEqual({ "it-a": "LIKELY_INELIGIBLE", "it-b": "POTENTIAL_FIT" });
    expect(r.json.items.find((i: any) => i.id === "it-a").deadline).toEqual({ date: "2026-12-15", confirmed: false });
    // 2 years × (3,000 + 12 × 200 + 12 × 700 [upper end]) EUR = 2 × 13,800 = 27,600 EUR × 312.5 = 8,625,000 PKR
    const it = r.json.finance[0];
    expect(it.totalPkr).toBe(8_625_000);
    expect(it.gapPkr).toBe(8_625_000 - 1_000_000);
    expect(r.json.rates.source).toMatch(/ExchangeRate-API/);
  });

  it("rejects invalid profiles", async () => {
    const env = await setup();
    expect((await client(env).post("/route/evaluate", { profile: { nationality: "Pakistan" } })).status).toBe(400);
    expect((await client(env).post("/route/evaluate", {})).status).toBe(400);
  });
});

describe("roadmap", () => {
  it("creates applications + barrier tasks once, visible on the dashboard; requires sign-in", async () => {
    const env = await setup();
    expect((await client(env).post("/me/roadmap", { scholarshipIds: ["it-b"] })).status).toBe(401);
    const a = client(env);
    await a.register("s@test.local");
    const body = { scholarshipIds: ["it-b", "test-x"], actions: [{ title: "Plan a language test", why: "IELTS needed" }] };
    const r1 = await a.post("/me/roadmap", body);
    expect(r1.json).toEqual({ createdApplications: 1, createdTasks: 1 }); // test record ignored
    const r2 = await a.post("/me/roadmap", body);
    expect(r2.json).toEqual({ createdApplications: 0, createdTasks: 0 }); // idempotent
    const d = (await a.get("/me/dashboard")).json;
    expect(d.applications).toHaveLength(1);
    expect(d.nextActions.length).toBeGreaterThan(0);
    const tasks = (await a.get("/me/tasks")).json.tasks;
    expect(tasks.some((t: any) => t.title === "Plan a language test")).toBe(true);
  });
});
