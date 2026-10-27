import { beforeEach, describe, expect, it, vi } from "vitest";
import { client, makeEnv } from "../helpers";
import type { Env } from "../../worker/env";

// No real network: official pages, an agent site and the search API are served from fixtures (tests only).
const PAGES: Record<string, string> = {
  "https://www.boell.de/en/scholarships": `<html><title>Scholarships | Heinrich Böll</title><main>
    <p>We award scholarships to international students.</p>
    <a href="/en/master-scholarships">Master scholarships for international students</a>
    <a href="https://agent-example.com/apply">Apply with our agent</a></main></html>`,
  "https://www.boell.de/en/master-scholarships": `<html><title>Master scholarships 2027</title><main>
    <p>Scholarships for international students in Master's programmes at German universities.</p>
    <p>Applicants from all countries, including Pakistan, may apply.</p>
    <p>The scholarship is € 992 per month.</p>
    <p>The application deadline is 1 March 2027.</p>
    <p>Required: CV, motivation letter, transcript of records, two letters of recommendation.</p></main></html>`,
  "https://www.polimi.it/en/scholarships/merit": `<html><title>Merit scholarships</title><main>
    <p>Merit-based scholarships for international students enrolling in Master of Science programmes.</p>
    <p>Applications must be submitted by 15 December 2026 at 14:00 (Italian time).</p>
    <p>Tuition fee: € 3,900 per year. Application fee € 30.</p>
    <p>English: IELTS 6.0 or TOEFL iBT 78.</p></main></html>`,
  "https://agent-example.com/apply": `<main><p>Scholarship deadline 1 January 2027. Pay us.</p></main>`,
};

let tavilyCalls: any[] = [];
const fetchStub = vi.fn(async (input: any, init?: any) => {
  const url = typeof input === "string" ? input : input.url;
  if (url === "https://api.tavily.com/search") {
    const body = JSON.parse(init.body);
    tavilyCalls.push({ body, auth: init.headers.authorization });
    return new Response(JSON.stringify({ results: [{ url: "https://www.polimi.it/en/scholarships/merit", title: "Merit" }, { url: "https://agent-example.com/apply", title: "Agent" }] }), { headers: { "content-type": "application/json" } });
  }
  if (url.includes("open.er-api.com")) return new Response(JSON.stringify({ result: "error" }));
  if (url.endsWith(".pdf")) return new Response(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } });
  if (url === "https://www.boell.de/en/moved") {
    const res = new Response(PAGES["https://agent-example.com/apply"], { headers: { "content-type": "text/html" } });
    Object.defineProperty(res, "url", { value: "https://agent-example.com/apply" }); // official link that redirects to an agent
    return res;
  }
  const html = PAGES[url];
  if (!html) return new Response("not found", { status: 404, headers: { "content-type": "text/html" } });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
});
vi.stubGlobal("fetch", fetchStub);

async function setup(extra: Partial<Env> = {}) {
  const env = makeEnv(extra);
  await env.DB.prepare("INSERT INTO sources (id, name, country, category, url, last_success_at) VALUES ('boell','Böll','DE','foundation','https://www.boell.de/en/scholarships','2026-10-25T00:00:00Z')").run();
  return env;
}
const PROFILE = { nationality: "PK", targetLevel: "master", highestCompleted: "bachelor", targetCountries: ["DE"] };

beforeEach(() => {
  tavilyCalls = [];
  fetchStub.mockClear();
});

describe("discovery API", () => {
  it("requires sign-in", async () => {
    const env = await setup();
    expect((await client(env).post("/me/discover", { profile: PROFILE, countries: ["DE"] })).status).toBe(401);
  });

  it("without a search key: reads registered official sources and same-site links; drops agents; stores unverified evidence", async () => {
    const env = await setup();
    const s = client(env);
    await s.register("d@test.local");
    const status = (await s.get("/me/discover/status")).json;
    expect(status.openWebSearch).toBe(false);
    const r = await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] });
    expect(r.status).toBe(200);
    expect(r.json.providers).toEqual(["official-crawl"]);
    expect(r.json.notes.join(" ")).toMatch(/Open-web search isn't connected/);
    const urls = r.json.items.map((i: any) => i.url);
    expect(urls).toContain("https://www.boell.de/en/master-scholarships");
    expect(urls.join(" ")).not.toMatch(/agent-example/);
    expect(fetchStub.mock.calls.map((c) => String(c[0]))).not.toContain("https://agent-example.com/apply"); // never even fetched
    const item = r.json.items.find((i: any) => i.url.endsWith("master-scholarships"));
    expect(item.reviewState).toBe("NEEDS_REVIEW");
    expect(item.evaluation.verification.value).toBe("NOT_VERIFIED");
    expect(item.evaluation.cycle.deadline.date).toBe("2027-03-01");
    expect(item.evaluation.fees.benefits[0]).toMatchObject({ amount: 992, unit: "month" });
    // Saved for later
    const latest = (await s.get("/me/discover/latest")).json;
    expect(latest.items.map((i: any) => i.id)).toEqual(r.json.items.map((i: any) => i.id));
  });

  it("with a search key: domain-restricted search, agent result dropped, key never exposed, hard monthly stop, cache", async () => {
    const env = await setup({ TAVILY_API_KEY: "tvly-test-secret", SEARCH_MONTHLY_CAP: "3" });
    const s = client(env);
    await s.register("e@test.local");
    const r = await s.post("/me/discover", { profile: { ...PROFILE, targetCountries: ["IT"] }, countries: ["IT"] });
    expect(r.json.providers).toEqual(["tavily", "official-crawl"]);
    expect(tavilyCalls).toHaveLength(2);
    expect(tavilyCalls[0].body.include_domains).toContain("polimi.it");
    expect(tavilyCalls[0].body.include_domains.every((d: string) => d.endsWith(".it"))).toBe(true);
    expect(r.json.items.map((i: any) => i.url)).toEqual(["https://www.polimi.it/en/scholarships/merit"]);
    expect(JSON.stringify(r.json)).not.toContain("tvly-test-secret");
    const it_ = r.json.items[0].evaluation;
    expect(it_.cycle.pakistanTime).toBe("2026-12-15 18:00 PKT");
    expect(it_.fees.totals[0]).toMatchObject({ currency: "EUR", total: 3900 * 2 + 30 });

    // Same queries again → served from cache, no new searches.
    await s.post("/me/discover", { profile: { ...PROFILE, targetCountries: ["IT"] }, countries: ["IT"] });
    expect(tavilyCalls).toHaveLength(2);

    // New queries: cap 3 → one more search allowed, then the hard stop.
    const r3 = await s.post("/me/discover", { profile: { ...PROFILE, targetField: "architecture" }, countries: ["IT"] });
    expect(tavilyCalls).toHaveLength(3);
    expect(r3.json.notes.join(" ")).toMatch(/free search quota is used up/);
    expect((await s.get("/me/discover/status")).json).toMatchObject({ openWebSearch: true, usedThisMonth: 3, monthlyCap: 3 });
  });

  it("save to roadmap: one unverified-lead application with timeline and document tasks, idempotent", async () => {
    const env = await setup();
    const s = client(env);
    await s.register("f@test.local");
    await s.put("/me/profile", { profile: { nationality: "PK" } }); // saved profile differs from the search
    const r = await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] });
    const card = r.json.items.find((i: any) => i.url.endsWith("master-scholarships"));
    const detail = (await s.get(`/me/discoveries/${card.id}`)).json.discovery;
    expect(detail.evaluation.eligibility).toEqual(card.evaluation.eligibility); // same answers as the search
    const id = r.json.items.find((i: any) => i.url.endsWith("master-scholarships")).id;
    const a = await s.post(`/me/discoveries/${id}/roadmap`);
    expect(a.status).toBe(201);
    expect(a.json.tasks).toBeGreaterThan(3);
    const b = await s.post(`/me/discoveries/${id}/roadmap`);
    expect(b.json).toEqual({ applicationId: a.json.applicationId, created: false });
    const apps = (await s.get("/me/applications")).json.applications;
    expect(apps).toHaveLength(1);
    expect(apps[0]).toMatchObject({ title: "[Unverified lead] Master scholarships 2027", deadline_date: "2027-03-01", deadline_confirmed: 0, discovery_id: id });
    const tasks = (await s.get("/me/tasks")).json.tasks;
    expect(tasks.some((t: any) => t.title === "Prepare: Recommendation letters")).toBe(true);
    expect(tasks.every((t: any) => t.due_confirmed === 0)).toBe(true);
  });

  it("only an admin can review; rejected leads disappear; a changed page goes back to review", async () => {
    const env = await setup();
    const s = client(env);
    await s.register("g@test.local");
    const r = await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] });
    const id = r.json.items.find((i: any) => i.url.endsWith("master-scholarships")).id;
    expect((await s.post(`/admin/discoveries/${id}/review`, { decision: "REVIEWER_CONFIRMED", note: "checked page" })).status).toBe(403);

    const a = client(env);
    await a.register("admin@test.local", "Admin");
    expect((await a.get("/admin/discoveries")).json.discoveries.length).toBeGreaterThan(0);
    expect((await a.post(`/admin/discoveries/${id}/review`, { decision: "REVIEWER_CONFIRMED", note: "Checked against the official page today." })).status).toBe(200);
    const d = (await s.get(`/me/discoveries/${id}`)).json.discovery;
    expect(d.evaluation.verification.value).toBe("REVIEWER_CONFIRMED");
    expect(d.emails.moiRequest).toMatch(/Request for a Medium of Instruction/);

    // The official page changes after review → back to NEEDS_REVIEW with a note.
    PAGES["https://www.boell.de/en/master-scholarships"] = PAGES["https://www.boell.de/en/master-scholarships"].replace("1 March 2027", "15 March 2027");
    await env.DB.prepare("UPDATE discoveries SET fetched_at = '2026-01-01T00:00:00Z' WHERE id = ?").bind(id).run();
    await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] });
    const after = (await a.get("/admin/discoveries")).json.discoveries.find((x: any) => x.id === id);
    expect(after.review_state).toBe("NEEDS_REVIEW");
    expect(after.review_note).toMatch(/Page changed/);

    await a.post(`/admin/discoveries/${id}/review`, { decision: "REJECTED", note: "Not relevant for Pakistani applicants." });
    expect((await s.get(`/me/discoveries/${id}`)).status).toBe(404);
    expect((await s.get("/me/discover/latest")).json.items.map((i: any) => i.id)).not.toContain(id);
  });

  it("an official link that redirects to a non-official site is skipped", async () => {
    const env = await setup();
    PAGES["https://www.boell.de/en/scholarships"] += `<a href="/en/moved">Scholarship call</a>`;
    const s = client(env);
    await s.register("r@test.local");
    const r = await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] });
    expect(r.json.items.map((i: any) => i.url)).not.toContain("https://www.boell.de/en/moved");
    expect(r.json.notes.join(" ")).toMatch(/redirected to a non-official site/);
  });

  it("two students searching the same pages at the same time both get working results", async () => {
    const env = await setup();
    const [a, b] = [client(env), client(env)];
    await a.register("p1@test.local");
    await b.register("p2@test.local");
    const [ra, rb] = await Promise.all([a.post("/me/discover", { profile: PROFILE, countries: ["DE"] }), b.post("/me/discover", { profile: PROFILE, countries: ["DE"] })]);
    expect(rb.json.items.map((i: any) => i.id)).toEqual(ra.json.items.map((i: any) => i.id));
    for (const it of rb.json.items) expect((await b.get(`/me/discoveries/${it.id}`)).status).toBe(200);
    expect((await env.DB.prepare("SELECT COUNT(*) AS n FROM discoveries").first<{ n: number }>())!.n).toBe(ra.json.items.length);
  });

  it("per-user daily limit", async () => {
    const env = await setup();
    const s = client(env);
    await s.register("h@test.local");
    for (let i = 0; i < 5; i++) expect((await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] })).status).toBe(200);
    expect((await s.post("/me/discover", { profile: PROFILE, countries: ["DE"] })).status).toBe(429);
  });
});

// Stand-in for Cloudflare's PDF-to-text converter (the real one runs on Cloudflare; tests never call it).
const PDF_TEXT = "Merit scholarships for international students\nCall for applications for Master of Science programmes 2027/28.\nApplications must be submitted by 15 December 2026 at 14:00 (Italian time).\nTuition fee: € 3,900 per year.\nRequired documents: transcript of records, CV, motivation letter.";
const fakeAi = (text: string) => ({ toMarkdown: async (doc: any) => ({ id: "1", name: doc.name, mimeType: "application/pdf", format: "text", tokens: 0, data: text }) }) as any;

describe("PDF calls and pasted evidence", () => {
  async function pdfSetup(ai?: any) {
    const env = makeEnv(ai ? { AI: ai } : {});
    await env.DB.prepare("INSERT INTO sources (id, name, country, category, url) VALUES ('polimi','Polimi','IT','university','https://www.polimi.it/call/Merit_Call_2027.pdf')").run();
    return env;
  }

  it("reads an official PDF through the converter, quotes it verbatim and labels it as a PDF", async () => {
    const env = await pdfSetup(fakeAi(PDF_TEXT));
    const s = client(env);
    await s.register("pdf@test.local");
    const r = await s.post("/me/discover", { profile: { ...PROFILE, targetCountries: ["IT"] }, countries: ["IT"] });
    const item = r.json.items.find((i: any) => i.url.endsWith(".pdf"));
    expect(item.sourceFormat).toBe("pdf");
    expect(item.evaluation.cycle.deadline).toMatchObject({ date: "2026-12-15", time: "14:00" });
    expect(item.evaluation.cycle.pakistanTime).toBe("2026-12-15 18:00 PKT");
    const d = (await s.get(`/me/discoveries/${item.id}`)).json.discovery;
    for (const q of [d.extract.deadlines[0].quote, ...d.extract.documents.map((x: any) => x.quote)]) expect(PDF_TEXT).toContain(q);
  });

  it("without the converter, or for a scanned PDF, says so instead of guessing", async () => {
    const a = client(await pdfSetup());
    await a.register("nopdf@test.local");
    const r1 = await a.post("/me/discover", { profile: PROFILE, countries: ["IT"] });
    expect(r1.json.items).toEqual([]);
    expect(r1.json.notes.join(" ")).toMatch(/PDF \(not read automatically here/);
    const b = client(await pdfSetup(fakeAi("Page 1")));
    await b.register("scan@test.local");
    const r2 = await b.post("/me/discover", { profile: PROFILE, countries: ["IT"] });
    expect(r2.json.notes.join(" ")).toMatch(/no readable text, probably a scan/);
  });

  const CAMPUS = "Chinese Government Scholarship - Bilateral Program\nApplicants for master's degree programmes must hold a bachelor's degree.\nThe application deadline for applicants from Pakistan is 31 March 2027 (Beijing time 17:00).\nRequired: passport, transcripts, degree certificate, study plan, two recommendation letters, Foreigner Physical Examination Form.\nMonthly stipend: CNY 3,000 per month for master's students.";

  it("only admins paste; official hosts only; pasted text becomes reviewable evidence shown in China searches", async () => {
    const env = await setup();
    const s = client(env);
    await s.register("cn@test.local");
    expect((await s.post("/admin/discoveries/manual", { url: "https://www.campuschina.org/x", title: "CGS", text: CAMPUS })).status).toBe(403);
    const a = client(env);
    await a.register("admin@test.local", "Admin");
    expect((await a.post("/admin/discoveries/manual", { url: "https://cucas-agent.example.com/x", title: "Agent", text: CAMPUS })).status).toBe(400);
    expect((await a.post("/admin/discoveries/manual", { url: "https://www.campuschina.org/x", title: "CGS", text: "too short" })).status).toBe(400);
    const r = await a.post("/admin/discoveries/manual", { url: "https://www.campuschina.org/content/cgs-2027.html", title: "CGS Bilateral 2027", text: CAMPUS });
    expect(r.status).toBe(201);
    expect(r.json.found).toMatchObject({ deadlines: 1 });
    const row = (await a.get("/admin/discoveries")).json.discoveries.find((d: any) => d.id === r.json.id);
    expect(row).toMatchObject({ provider: "manual", review_state: "NEEDS_REVIEW", host_tier: "listed", country: "CN" });
    expect(row.review_note).toMatch(/Text pasted by Admin/);

    const found = await s.post("/me/discover", { profile: { ...PROFILE, targetCountries: ["CN"] }, countries: ["CN"] });
    const item = found.json.items.find((i: any) => i.id === r.json.id);
    expect(item.sourceFormat).toBe("pasted");
    expect(item.evaluation.verification.value).toBe("NOT_VERIFIED");
    expect(item.evaluation.cycle.deadline).toMatchObject({ date: "2027-03-31", time: "17:00" });
    expect(item.evaluation.cycle.pakistanTime).toBe("2027-03-31 14:00 PKT");

    // Confirmed, then re-pasted with new text → back to review.
    await a.post(`/admin/discoveries/${r.json.id}/review`, { decision: "REVIEWER_CONFIRMED", note: "Checked against campuschina.org today." });
    await a.post("/admin/discoveries/manual", { url: "https://www.campuschina.org/content/cgs-2027.html", title: "CGS Bilateral 2027", text: CAMPUS.replace("31 March", "15 April") });
    const again = (await a.get("/admin/discoveries")).json.discoveries.find((d: any) => d.id === r.json.id);
    expect(again.review_state).toBe("NEEDS_REVIEW");
  });
});
