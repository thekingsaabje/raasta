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
  it("records failures, marks inaccessible after repeats, and flags changed content", async () => {
    const env = makeEnv();
    await env.DB.prepare("INSERT INTO sources (id, name, country, category, url) VALUES ('s1','S','CN','government','https://example.org/a')").run();
    const failing = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    for (let i = 0; i < 3; i++) await runSourceChecks(env.DB, 5, failing);
    expect((await env.DB.prepare("SELECT review_status FROM sources WHERE id='s1'").first<any>()).review_status).toBe("inaccessible");

    let body = "<p>Deadline 1 March</p>";
    const ok = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    await env.DB.prepare("UPDATE sources SET review_status='indexed', fail_count=0 WHERE id='s1'").run();
    await runSourceChecks(env.DB, 5, ok);
    body = "<p>Deadline 15 March</p>";
    const r = await runSourceChecks(env.DB, 5, ok);
    expect(r.results[0].changed).toBe(true);
    expect((await env.DB.prepare("SELECT review_status FROM sources WHERE id='s1'").first<any>()).review_status).toBe("outstanding");
  });
});
