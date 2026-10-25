import { describe, expect, it } from "vitest";
import { client, makeEnv } from "../helpers";
import { getRates } from "../../worker/planner";

const input = {
  months: 24,
  rates: { pkrPer: { EUR: 300 }, source: "test", date: "2026-10-25" },
  costs: [
    { id: "t", category: "tuition", label: "Tuition", amount: 1500, currency: "EUR", freq: "semester", stage: "during_study", source: { status: "USER" } },
    { id: "l", category: "living", label: "Living", amount: 500, currency: "EUR", freq: "month", stage: "during_study", source: { status: "OFFICIAL_ESTIMATE", url: "https://www.daad.de/en/" } },
    { id: "x", category: "fees", label: "Lab fee", amount: null, currency: "EUR", freq: "once", stage: "on_arrival", source: { status: "UNKNOWN" } },
  ],
  awards: [{ id: "a", name: "Potential award", status: "potential", source: { status: "ESTIMATE" }, tuition: { type: "full" }, stipend: null, accommodation: "unknown", insurance: "unknown", travel: "none" }],
  funds: { savings: { amount: 1_000_000, currency: "PKR" } },
};

describe("saved financial plans", () => {
  it("saves versions, recomputes on the server, shows on the dashboard, and stays private", async () => {
    const env = makeEnv();
    const a = client(env);
    await a.register("a@test.local");
    const v1 = await a.post("/me/plans", { title: "Germany MSc", country: "DE", input });
    expect(v1.status).toBe(201);
    // 4 semesters × 1,500 EUR + 24 × 500 EUR = 18,000 EUR × 300 = 5,400,000
    expect(v1.json.summary.scenarios[0].programmeCost).toBe(5_400_000);
    expect(v1.json.summary.scenarios[1].available).toBe(1_000_000); // potential award never adds money
    expect(v1.json.summary.missing).toHaveLength(1);

    const v2 = await a.post("/me/plans", { planId: v1.json.planId, title: "Germany MSc", country: "DE", input: { ...input, months: 12 } });
    expect(v2.json.version).toBe(2);
    const versions = (await a.get(`/me/plans/${v1.json.planId}`)).json.versions;
    expect(versions.map((v: any) => v.version)).toEqual([2, 1]); // history preserved
    expect((await a.get("/me/plans")).json.plans).toHaveLength(1);

    const d = (await a.get("/me/dashboard")).json;
    expect(d.finance.version).toBe(2);
    expect(d.funding.some((f: any) => f.title === "Fill in unknown costs")).toBe(true);
    expect(d.overall.total).toBe(0); // financial plan does not change application progress

    const b = client(env);
    await b.register("b@test.local");
    expect((await b.get(`/me/plans/${v1.json.planId}`)).status).toBe(404);
    expect((await b.post("/me/plans", { planId: v1.json.planId, title: "hijack", input })).status).toBe(404);
    expect((await b.del(`/me/plans/${v1.json.planId}`)).status).toBe(404);
    expect((await a.get("/me/plans")).json.plans).toHaveLength(1);
    expect((await client(env).post("/me/plans", { title: "x", input })).status).toBe(401);
  });

  it("rejects invalid input", async () => {
    const env = makeEnv();
    const a = client(env);
    await a.register("a@test.local");
    expect((await a.post("/me/plans", { title: "x", input: { ...input, months: 0 } })).status).toBe(400);
    expect((await a.post("/me/plans", { title: "x", input: { ...input, costs: [{ ...input.costs[0], amount: -5 }] } })).status).toBe(400);
    expect((await a.post("/me/plans", { title: "x", input: { ...input, rates: { pkrPer: { eur: 1 }, source: "x", date: null } } })).status).toBe(400);
  });
});

describe("exchange rates", () => {
  it("fetches, caches with source and date, and falls back to cache when the service fails", async () => {
    const env = makeEnv();
    const ok = (async () => new Response(JSON.stringify({ result: "success", time_last_update_utc: "Sun, 25 Oct 2026 00:02:31 +0000", rates: { EUR: 0.0032, CNY: 0.0256, USD: 0.0036 } }))) as unknown as typeof fetch;
    const r = await getRates(env.DB, ok);
    expect(r.rates.EUR).toBe(312.5); // 1 / 0.0032
    expect(r.date).toBe("2026-10-25T00:02:31.000Z");
    expect(r.source).toMatch(/ExchangeRate-API/);
    await env.DB.prepare("UPDATE fx_rates SET fetched_at = '2000-01-01T00:00:00Z'").run();
    const down = (async () => { throw new Error("down"); }) as unknown as typeof fetch;
    const cached = await getRates(env.DB, down);
    expect(cached.rates.EUR).toBe(312.5);
    expect(cached.stale).toBe(true);
    expect((await getRates(makeEnv().DB, down)).rates).toEqual({}); // no cache, no invented rates
  });
});
