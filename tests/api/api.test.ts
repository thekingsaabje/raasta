import { describe, expect, it } from "vitest";
import { client, makeEnv, seedRequirement, seedScholarship } from "../helpers";
import { runSourceChecks } from "../../worker/monitor";

describe("auth and access control", () => {
  it("register, me, logout", async () => {
    const env = makeEnv();
    const a = client(env);
    expect((await a.register("s1@test.local")).status).toBe(201);
    expect((await a.get("/auth/me")).json.user.email).toBe("s1@test.local");
    await a.post("/auth/logout");
    expect((await a.get("/auth/me")).json.user).toBeNull();
  });

  it("rejects weak passwords and missing consent", async () => {
    const a = client(makeEnv());
    expect((await a.post("/auth/register", { email: "x@test.local", name: "x", password: "short", consent: true })).status).toBe(400);
    expect((await a.post("/auth/register", { email: "x@test.local", name: "x", password: "long enough pass", consent: false })).status).toBe(400);
  });

  it("wrong password is refused and password hash is never returned", async () => {
    const env = makeEnv();
    const a = client(env);
    const r = await a.register("s1@test.local");
    expect(JSON.stringify(r.json)).not.toMatch(/password/);
    const b = client(env);
    expect((await b.post("/auth/login", { email: "s1@test.local", password: "wrong password!" })).status).toBe(401);
    expect((await b.post("/auth/login", { email: "s1@test.local", password: "correct horse battery" })).status).toBe(200);
  });

  it("lower work factor still logs in; stored hash carries its iteration count", async () => {
    const env = makeEnv({ PBKDF2_ITERATIONS: "30000" });
    await client(env).register("s1@test.local");
    const row = await env.DB.prepare("SELECT password_hash FROM users").first<any>();
    expect(row.password_hash.startsWith("30000$")).toBe(true);
    expect((await client(env).post("/auth/login", { email: "s1@test.local", password: "correct horse battery" })).status).toBe(200);
  });

  it("login is rate limited", async () => {
    const env = makeEnv();
    const b = client(env);
    let last = 0;
    for (let i = 0; i < 10; i++) last = (await b.post("/auth/login", { email: "nobody@test.local", password: "x" })).status;
    expect(last).toBe(429);
  });

  it("student endpoints require sign-in", async () => {
    const a = client(makeEnv());
    for (const p of ["/me/profile", "/me/dashboard", "/me/tasks", "/me/writing"]) expect((await a.get(p)).status).toBe(401);
  });

  it("admin endpoints are refused to students", async () => {
    const env = makeEnv();
    const s = client(env);
    await s.register("student@test.local");
    expect((await s.get("/admin/coverage")).status).toBe(403);
    expect((await s.patch("/admin/scholarships/x", { reason: "hack" })).status).toBe(403);
    const ad = client(env);
    await ad.register("admin@test.local");
    expect((await ad.get("/admin/coverage")).status).toBe(200);
  });

  it("cross-origin writes are refused", async () => {
    const env = makeEnv();
    const a = client(env);
    await a.register("s1@test.local");
    expect((await a.post("/me/facts", { category: "academic", text: "hello there" }, { origin: "https://evil.example" })).status).toBe(403);
  });
});

describe("student data isolation", () => {
  it("one student cannot read or change another's data", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    const a = client(env);
    const b = client(env);
    await a.register("a@test.local");
    await b.register("b@test.local");
    const app = await a.post("/me/applications", { scholarshipId: "test-sch" });
    expect(app.status).toBe(201);
    const tasksA = (await a.get("/me/tasks")).json.tasks;
    expect(tasksA.length).toBeGreaterThan(0);

    expect((await b.get("/me/tasks")).json.tasks).toHaveLength(0);
    expect((await b.patch(`/me/tasks/${tasksA[0].id}`, { studentStatus: "COMPLETED_BY_STUDENT" })).status).toBe(404);
    expect((await b.patch(`/me/applications/${app.json.application.id}`, { stage: "prepared" })).status).toBe(404);
    await b.del(`/me/applications/${app.json.application.id}`);
    expect((await a.get("/me/applications")).json.applications).toHaveLength(1);

    const doc = await a.post("/me/writing", { kind: "sop", title: "My SOP" });
    expect((await b.get(`/me/writing/${doc.json.id}`)).status).toBe(404);
  });
});

describe("dashboard and tasks", () => {
  it("database-backed task updates recalculate progress per application", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    await seedScholarship(env, { id: "test-sch-2", name: "TEST Second" });
    const a = client(env);
    await a.register("a@test.local");
    const app1 = (await a.post("/me/applications", { scholarshipId: "test-sch" })).json.application;
    const app2 = (await a.post("/me/applications", { scholarshipId: "test-sch-2" })).json.application;

    const t1 = (await a.get(`/me/tasks?application_id=${app1.id}`)).json;
    const first = t1.tasks.find((t: any) => t.title.startsWith("Read the official"));
    const r = await a.patch(`/me/tasks/${first.id}`, { studentStatus: "COMPLETED_BY_STUDENT" });
    expect(r.status).toBe(200);
    expect(r.json.progress.done).toBe(1);

    const d = (await a.get("/me/dashboard")).json;
    const p1 = d.applications.find((x: any) => x.id === app1.id).progress;
    const p2 = d.applications.find((x: any) => x.id === app2.id).progress;
    expect(p1.done).toBe(1);
    expect(p2.done).toBe(0);
    expect(d.nextActions.length).toBeLessThanOrEqual(3);
  });

  it("students cannot set institution-verified status", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    const a = client(env);
    await a.register("a@test.local");
    await a.post("/me/applications", { scholarshipId: "test-sch" });
    const t = (await a.get("/me/tasks")).json.tasks[0];
    expect((await a.patch(`/me/tasks/${t.id}`, { verified_status: "VERIFIED" })).status).toBe(400);
    expect((await a.patch(`/me/tasks/${t.id}`, { studentStatus: "VERIFIED" })).status).toBe(400);
  });

  it("dependent submit task is blocked until mandatory tasks are done", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    const a = client(env);
    await a.register("a@test.local");
    await a.post("/me/applications", { scholarshipId: "test-sch" });
    const { tasks, progress } = (await a.get("/me/tasks")).json;
    const submit = tasks.find((t: any) => t.title.startsWith("Submit"));
    expect(submit.blocked_by.length).toBeGreaterThan(0);
    expect(progress.blocked).toBeGreaterThan(0);
  });

  it("submitted stage requires evidence", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    const a = client(env);
    await a.register("a@test.local");
    const app = (await a.post("/me/applications", { scholarshipId: "test-sch" })).json.application;
    expect((await a.patch(`/me/applications/${app.id}`, { stage: "submitted" })).status).toBe(400);
    expect((await a.patch(`/me/applications/${app.id}`, { stage: "submitted", stageEvidence: "CSC-2027-12345" })).status).toBe(200);
  });

  it("assisted/managed modes are not offered", async () => {
    const env = makeEnv();
    const a = client(env);
    await a.register("a@test.local");
    expect((await a.post("/me/applications", { title: "x", mode: "managed" })).status).toBe(400);
  });

  it("admin deadline change updates linked tasks, keeps history and notifies saved users", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    const s = client(env);
    await s.register("a@test.local");
    await s.post("/me/saved/test-sch");
    await s.post("/me/applications", { scholarshipId: "test-sch" });
    const ad = client(env);
    await ad.register("admin@test.local");

    const bad = await ad.patch("/admin/scholarships/test-sch", { status: "VERIFIED_OPEN", reason: "checked" });
    expect(bad.status).toBe(400); // verified open needs a checked deadline

    const r = await ad.patch("/admin/scholarships/test-sch", { status: "VERIFIED_OPEN", deadline_date: "2027-03-15", reason: "Checked official 2027 call" });
    expect(r.status).toBe(200);
    expect(r.json.scholarship.version).toBe(2);
    expect(r.json.notified).toBe(1);

    const submit = (await s.get("/me/tasks")).json.tasks.find((t: any) => t.title.startsWith("Submit"));
    expect(submit.due_date).toBe("2027-03-15");
    expect(submit.due_confirmed).toBe(1);
    expect(submit.change_note).toMatch(/Deadline changed/);

    const hist = await ad.get("/admin/history/scholarship/test-sch");
    expect(hist.json.history).toHaveLength(1);
    expect((await s.get("/me/notifications")).json.notifications).toHaveLength(1);
  });
});

describe("eligibility via API", () => {
  it("assessments use the stored profile and rules; changed rules change results", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    await seedRequirement(env, "r-nat", "test-sch", { kind: "nationality", allowed: ["PK"] });
    await seedRequirement(env, "r-gpa", "test-sch", { kind: "min_grade", scale: "4", min: 3.0 });
    const a = client(env);
    await a.register("a@test.local");
    await a.put("/me/profile", { nationality: "PK", grade: { scale: "4", value: 3.2 } });
    expect((await a.get("/me/assessments/test-sch")).json.assessment.overall).toBe("MET");

    await env.DB.prepare("UPDATE requirements SET rule = ? WHERE id = 'r-gpa'").bind(JSON.stringify({ kind: "min_grade", scale: "4", min: 3.5 })).run();
    expect((await a.get("/me/assessments/test-sch")).json.assessment.overall).toBe("NOT_MET");
  });

  it("invalid profile input is rejected", async () => {
    const a = client(makeEnv());
    await a.register("a@test.local");
    expect((await a.put("/me/profile", { nationality: "Pakistan" })).status).toBe(400);
    expect((await a.put("/me/profile", { password: "x" })).status).toBe(400);
  });
});

describe("writing studio via API", () => {
  it("unconfirmed policy blocks outlines; drafting-allowed permits them; versions are kept", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    await seedScholarship(env, { id: "draft-ok", name: "TEST Draft OK", writing_policy: "DRAFTING_ALLOWED" });
    const a = client(env);
    await a.register("a@test.local");
    const app1 = (await a.post("/me/applications", { scholarshipId: "test-sch" })).json.application;
    const app2 = (await a.post("/me/applications", { scholarshipId: "draft-ok" })).json.application;
    const d1 = (await a.post("/me/writing", { kind: "study_plan", title: "Plan", applicationId: app1.id, wordLimit: 800 })).json.id;
    const d2 = (await a.post("/me/writing", { kind: "study_plan", title: "Plan", applicationId: app2.id })).json.id;

    expect((await a.post(`/me/writing/${d1}/outline`)).status).toBe(403);
    expect((await a.post(`/me/writing/${d2}/outline`)).status).toBe(200);

    await a.patch(`/me/writing/${d1}`, { content: "First version" });
    await a.patch(`/me/writing/${d1}`, { factsConfirmed: true });
    const v2 = await a.patch(`/me/writing/${d1}`, { content: "Second version" });
    expect(v2.json.doc.version).toBe(3);
    expect(v2.json.doc.facts_confirmed).toBe(0); // editing resets confirmation
    expect((await a.get(`/me/writing/${d1}/versions`)).json.versions).toHaveLength(2);
  });
});

describe("privacy", () => {
  it("account deletion removes the student's data", async () => {
    const env = makeEnv();
    const a = client(env);
    await a.register("a@test.local");
    await a.post("/me/facts", { category: "academic", text: "BSc Computer Science" });
    expect((await a.get("/me/export")).json.facts).toHaveLength(1);
    expect((await a.del("/me/account")).status).toBe(200);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM facts").first<{ n: number }>();
    expect(n!.n).toBe(0);
  });
});

describe("homepage stats", () => {
  it("counts only real rows: test records and rejected discoveries are excluded", async () => {
    const env = makeEnv();
    await seedScholarship(env); // test data
    await seedScholarship(env, { id: "real-1", is_test_data: 0 });
    await env.DB.exec(`INSERT INTO sources (id, name, country, category, url) VALUES ('s1','S','DE','x','https://a.de');
      INSERT INTO discoveries (id, url, host, host_tier, provider, fetched_at, extract, review_state, created_at, updated_at) VALUES
      ('d1','https://a.de/1','a.de','listed','crawl','t','{}','NEEDS_REVIEW','t','t'), ('d2','https://a.de/2','a.de','listed','crawl','t','{}','REJECTED','t','t');`);
    const r = await client(env).get("/stats");
    expect(r.json).toMatchObject({ sources: 1, scholarships: 1, discoveries: 1, costFigures: 0 });
  });
});

describe("public catalogue and reports", () => {
  it("filters scholarships and accepts error reports", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    await seedScholarship(env, { id: "de-1", name: "TEST DE", country: "DE" });
    const a = client(env);
    expect((await a.get("/scholarships?country=DE")).json.scholarships).toHaveLength(1);
    expect((await a.get("/scholarships?q=Second")).json.scholarships).toHaveLength(0);
    expect((await a.post("/reports", { scholarshipId: "de-1", message: "Deadline is wrong" })).status).toBe(201);
    expect((await a.post("/reports", { scholarshipId: "nope", message: "Deadline is wrong" })).status).toBe(404);
  });

  it("packages show payments disabled", async () => {
    const env = makeEnv();
    const r = await client(env).get("/packages");
    expect(r.json.paymentsEnabled).toBe(false);
  });
});

describe("source monitor", () => {
  const page = (deadline: string, nav = "Home") =>
    `<html><nav>${nav} | News | ${Math.random()}</nav><main><h1>Scholarship call 2027</h1><p>Applications close on ${deadline}. Open to international students from eligible countries.</p></main><script>var t=${Date.now()}</script></html>`;
  const count = async (env: any, sql: string) => (await env.DB.prepare(sql).first()).n as number;

  it("failures never touch scholarship status; repeated failures open one task", async () => {
    const env = makeEnv();
    await env.DB.prepare("INSERT INTO sources (id, name, country, category, url) VALUES ('s1','S','CN','government','https://example.org/a')").run();
    await seedScholarship(env, { status: "VERIFIED_OPEN", deadline_date: "2099-01-01" });
    await env.DB.prepare("UPDATE scholarships SET source_id = 's1'").run();
    const failing = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    for (let i = 0; i < 5; i++) await runSourceChecks(env.DB, 5, failing);
    expect((await env.DB.prepare("SELECT review_status FROM sources WHERE id='s1'").first<any>()).review_status).toBe("inaccessible");
    expect((await env.DB.prepare("SELECT status FROM scholarships").first<any>()).status).toBe("VERIFIED_OPEN");
    expect(await count(env, "SELECT COUNT(*) AS n FROM review_tasks WHERE kind='source_failing' AND status='open'")).toBe(1);
    expect(await count(env, "SELECT COUNT(*) AS n FROM source_checks")).toBe(5);
  });

  it("menu/script noise is ignored; a real content change opens exactly one review task", async () => {
    const env = makeEnv();
    await env.DB.prepare("INSERT INTO sources (id, name, country, category, url) VALUES ('s1','S','CN','government','https://example.org/a')").run();
    let deadline = "1 March 2027";
    const ok = (async () => new Response(page(deadline), { status: 200 })) as unknown as typeof fetch;
    await runSourceChecks(env.DB, 5, ok);
    const same = await runSourceChecks(env.DB, 5, ok); // nav and script differ, main content does not
    expect(same.results[0].changed).toBe(false);
    deadline = "15 March 2027";
    expect((await runSourceChecks(env.DB, 5, ok)).results[0].changed).toBe(true);
    deadline = "20 March 2027";
    await runSourceChecks(env.DB, 5, ok); // second change while the task is still open
    expect(await count(env, "SELECT COUNT(*) AS n FROM review_tasks WHERE kind='source_changed' AND status='open'")).toBe(1);
    expect((await env.DB.prepare("SELECT review_status FROM sources WHERE id='s1'").first<any>()).review_status).toBe("outstanding");
  });

  it("flags verified-open records whose deadline passed, without changing them", async () => {
    const env = makeEnv();
    await seedScholarship(env, { status: "VERIFIED_OPEN", deadline_date: "2020-01-01" });
    await runSourceChecks(env.DB, 5, (async () => new Response("")) as unknown as typeof fetch);
    await runSourceChecks(env.DB, 5, (async () => new Response("")) as unknown as typeof fetch);
    expect(await count(env, "SELECT COUNT(*) AS n FROM review_tasks WHERE kind='deadline_passed'")).toBe(1);
    expect((await env.DB.prepare("SELECT status FROM scholarships").first<any>()).status).toBe("VERIFIED_OPEN");
  });

  it("error reports open a review task", async () => {
    const env = makeEnv();
    await seedScholarship(env);
    await client(env).post("/reports", { scholarshipId: "test-sch", message: "Deadline moved to April" });
    expect(await count(env, "SELECT COUNT(*) AS n FROM review_tasks WHERE kind='error_report'")).toBe(1);
  });
});

describe("admin-issued password reset", () => {
  it("issues a single-use link, resets the password and signs out old sessions; students can't issue links", async () => {
    const env = makeEnv();
    const s = client(env);
    await s.register("s1@test.local");
    expect((await s.post("/admin/users/reset-link", { email: "s1@test.local" })).status).toBe(403);
    const ad = client(env);
    await ad.register("admin@test.local");
    const link = (await ad.post("/admin/users/reset-link", { email: "s1@test.local" })).json.link as string;
    const token = new URL(link).searchParams.get("token")!;
    const anon = client(env);
    expect((await anon.post("/auth/reset", { token, password: "a brand new password" })).status).toBe(200);
    expect((await anon.post("/auth/reset", { token, password: "another new password" })).status).toBe(400); // single use
    expect((await s.get("/me/profile")).status).toBe(401); // old session revoked
    expect((await anon.post("/auth/login", { email: "s1@test.local", password: "a brand new password" })).status).toBe(200);
  });
});
