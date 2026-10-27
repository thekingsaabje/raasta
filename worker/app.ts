import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "./env";
import { createSession, destroySession, hashPassword, loadUser, requireAdmin, requireUser, verifyPassword } from "./auth";
import { audit, newId, now, parseJsonCols, rateLimit, sha256Hex, today } from "./util";
import { getProfile, getScholarship, listRequirements, listTasks, notify, SCH_JSON } from "./data";
import { profileSchema } from "../shared/profile";
import { assess } from "../shared/eligibility";
import { calculate, COST_CATEGORIES } from "../shared/finance";
import { daysUntil, nextActions, progress, blockedBy } from "../shared/progress";
import { generateChecklist } from "../shared/checklist";
import { capabilities, checkDocument, coachingQuestions, DOC_KINDS, outlineFromFacts, type DocKind } from "../shared/writing";
import { APPLICATION_STAGES, FUNDING_CLASSES, OPPORTUNITY_STATUSES, STUDENT_STATUSES, VERIFIED_STATUSES, WRITING_MODES, type Scholarship } from "../shared/types";
import { runSourceChecks } from "./monitor";
import { plannerRoutes } from "./planner";
import { routeRoutes } from "./route";
import { discoveryRoutes } from "./discovery";

export const app = new Hono<AppEnv>().basePath("/api");

// ---------- cross-cutting ----------
app.onError((err, c) => {
  if (err instanceof z.ZodError) return c.json({ error: "Invalid input.", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 400);
  console.error("unhandled", err instanceof Error ? err.message : "unknown"); // no request bodies in logs
  return c.json({ error: "Something went wrong." }, 500);
});

app.use("*", async (c, next) => {
  // Basic CSRF defence: state-changing requests must be JSON from our own origin.
  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "Cross-origin request refused." }, 403);
    const ct = c.req.header("content-type") ?? "";
    if (c.req.method !== "DELETE" && !ct.includes("application/json")) return c.json({ error: "JSON body required." }, 415);
  }
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Cache-Control", "no-store");
});
app.use("*", loadUser);

const body = async <T extends z.ZodTypeAny>(c: { req: { json: () => Promise<unknown> } }, schema: T): Promise<z.infer<T>> => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = undefined;
  }
  return schema.parse(raw);
};
const ip = (c: { req: { header: (k: string) => string | undefined } }) => c.req.header("cf-connecting-ip") ?? "local";

// ---------- public ----------
app.get("/health", (c) => c.json({ ok: true, env: c.env.APP_ENV, time: now() }));

app.get("/scholarships", async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const args: unknown[] = [];
  if (q.country) (where.push("country = ?"), args.push(q.country));
  if (q.status) (where.push("status = ?"), args.push(q.status));
  if (q.cycle && ["open", "upcoming", "closed", "unknown"].includes(q.cycle)) (where.push("cycle_state = ?"), args.push(q.cycle));
  if (q.confirmed === "1") where.push("verification_method = 'human' AND status LIKE 'VERIFIED_%'");
  if (q.applicant) (where.push("(applicant_type = ? OR applicant_type = 'both')"), args.push(q.applicant));
  if (q.level) (where.push("levels LIKE ?"), args.push(`%"${q.level.replace(/[^a-z]/g, "")}"%`));
  if (q.q) {
    where.push("(name LIKE ? OR provider LIKE ? OR funding_summary LIKE ?)");
    const like = `%${q.q.slice(0, 80)}%`;
    args.push(like, like, like);
  }
  const sql = `SELECT s.*, (SELECT COUNT(*) FROM requirements r WHERE r.scholarship_id = s.id) AS rule_count,
    (SELECT COUNT(*) FROM requirements r WHERE r.scholarship_id = s.id AND r.review_status = 'VERIFIED') AS verified_rules
    FROM scholarships s ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY country, name LIMIT 500`;
  const { results } = await c.env.DB.prepare(sql).bind(...args).all<Record<string, unknown>>();
  return c.json({ scholarships: results.map((r) => parseJsonCols(r, SCH_JSON)) });
});

app.get("/scholarships/:id", async (c) => {
  const s = await getScholarship(c.env.DB, c.req.param("id"));
  if (!s) return c.json({ error: "Not found." }, 404);
  const requirements = await listRequirements(c.env.DB, s.id);
  const source = s.source_id ? await c.env.DB.prepare("SELECT id, name, url, last_checked_at, last_success_at FROM sources WHERE id = ?").bind(s.source_id).first() : null;
  return c.json({ scholarship: s, requirements, source });
});

app.get("/packages", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM packages WHERE active = 1 ORDER BY sort").all<Record<string, unknown>>();
  return c.json({ packages: results.map((r) => parseJsonCols(r, ["features", "exclusions"])), paymentsEnabled: c.env.PAYMENTS_ENABLED === "true" });
});

app.get("/coverage", async (c) => {
  const db = c.env.DB;
  const sources = await db.prepare("SELECT country, review_status, COUNT(*) AS n FROM sources GROUP BY country, review_status").all();
  const sch = await db.prepare("SELECT country, status, COUNT(*) AS n FROM scholarships WHERE is_test_data = 0 GROUP BY country, status").all();
  return c.json({ sources: sources.results, scholarships: sch.results, note: "Counts reflect only what Raasta has catalogued so far, not every scholarship that exists." });
});

const costLine = z.object({
  category: z.enum(COST_CATEGORIES),
  amount: z.number().min(0).max(1e9),
  currency: z.string().min(3).max(3),
  period: z.enum(["once", "month", "year"]),
  beforeArrival: z.boolean().optional(),
});
app.post("/finance/calculate", async (c) => {
  const input = await body(
    c,
    z.object({
      months: z.number().int().min(1).max(120),
      costs: z.array(costLine).max(50),
      rates: z.record(z.string(), z.number().min(0).max(1e6)),
      scholarshipId: z.string().optional(),
      sponsorPkr: z.number().min(0).max(1e10).optional(),
      savingsPkr: z.number().min(0).max(1e10).optional(),
    }),
  );
  const s = input.scholarshipId ? await getScholarship(c.env.DB, input.scholarshipId) : null;
  return c.json({ result: calculate({ ...input, coverage: s?.coverage }), scholarship: s ? { id: s.id, name: s.name, coverage: s.coverage } : null });
});

app.post("/reports", async (c) => {
  if (!(await rateLimit(c.env.DB, `report:${ip(c)}`, 10, 3600))) return c.json({ error: "Too many reports. Try later." }, 429);
  const b = await body(c, z.object({ scholarshipId: z.string().max(100), requirementId: z.string().max(100).optional(), message: z.string().min(5).max(2000) }));
  if (!(await getScholarship(c.env.DB, b.scholarshipId))) return c.json({ error: "Not found." }, 404);
  const id = newId();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO error_reports (id, user_id, scholarship_id, requirement_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(
      id, c.get("user")?.id ?? null, b.scholarshipId, b.requirementId ?? null, b.message, now(),
    ),
    c.env.DB.prepare("INSERT OR IGNORE INTO review_tasks (kind, scholarship_id, detail, dedupe_key, created_at) VALUES ('error_report', ?, ?, ?, ?)").bind(
      b.scholarshipId, b.message.slice(0, 300), `report:${id}`, now(),
    ),
  ]);
  return c.json({ id }, 201);
});

// ---------- auth ----------
app.post("/auth/register", async (c) => {
  const regLimit = Math.min(500, Math.max(1, Number(c.env.REGISTER_LIMIT_PER_HOUR) || 20));
  if (!(await rateLimit(c.env.DB, `register:${ip(c)}`, regLimit, 3600))) return c.json({ error: "Too many attempts. Try later." }, 429);
  const b = await body(
    c,
    z.object({
      email: z.email().max(200).transform((e) => e.toLowerCase()),
      name: z.string().min(1).max(100),
      password: z.string().min(10, "Use at least 10 characters.").max(200),
      consent: z.literal(true, { message: "Please accept the privacy notice." }),
    }),
  );
  const exists = await c.env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(b.email).first();
  if (exists) return c.json({ error: "An account with this email already exists." }, 409);
  const iterations = Math.min(100_000, Math.max(20_000, Number(c.env.PBKDF2_ITERATIONS) || 100_000));
  const { hash, salt } = await hashPassword(b.password, undefined, iterations);
  const admins = (c.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
  const role = admins.includes(b.email) ? "admin" : "student";
  const id = newId();
  const t = now();
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO users (id, email, name, password_hash, password_salt, role, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, b.email, b.name, hash, salt, role, t, t),
    c.env.DB.prepare("INSERT INTO notification_prefs (user_id) VALUES (?)").bind(id),
  ]);
  await createSession(c, id);
  return c.json({ user: { id, email: b.email, name: b.name, role } }, 201);
});

app.post("/auth/login", async (c) => {
  const b = await body(c, z.object({ email: z.string().max(200).transform((e) => e.toLowerCase()), password: z.string().max(200) }));
  if (!(await rateLimit(c.env.DB, `login:${ip(c)}:${b.email}`, 8, 900))) return c.json({ error: "Too many attempts. Wait 15 minutes." }, 429);
  const u = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(b.email).first<Record<string, string>>();
  if (!u || !(await verifyPassword(b.password, u.password_hash, u.password_salt))) return c.json({ error: "Email or password is incorrect." }, 401);
  await createSession(c, u.id);
  return c.json({ user: { id: u.id, email: u.email, name: u.name, role: u.role } });
});

app.post("/auth/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});

app.get("/auth/me", (c) => c.json({ user: c.get("user") }));

// Single-use reset link issued by an admin (no email provider yet). Resetting signs out every session.
app.post("/auth/reset", async (c) => {
  if (!(await rateLimit(c.env.DB, `reset:${ip(c)}`, 10, 3600))) return c.json({ error: "Too many attempts. Try later." }, 429);
  const b = await body(c, z.object({ token: z.string().regex(/^[0-9a-f]{64}$/), password: z.string().min(10, "Use at least 10 characters.").max(200) }));
  const db = c.env.DB;
  const r = await db.prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?").bind(await sha256Hex(b.token), now()).first<Record<string, string>>();
  if (!r) return c.json({ error: "This reset link is invalid or has expired. Ask an admin for a new one." }, 400);
  const iterations = Math.min(100_000, Math.max(20_000, Number(c.env.PBKDF2_ITERATIONS) || 100_000));
  const { hash, salt } = await hashPassword(b.password, undefined, iterations);
  await db.batch([
    db.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(hash, salt, r.user_id),
    db.prepare("UPDATE password_resets SET used_at = ? WHERE token_hash = ?").bind(now(), r.token_hash),
    db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(r.user_id),
  ]);
  await audit(db, null, "password_reset_used", "user", r.user_id);
  return c.json({ ok: true });
});

// ---------- student (everything below is scoped to the signed-in user) ----------
const me = new Hono<AppEnv>();
me.use("*", requireUser);
const uid = (c: { get: (k: "user") => AppEnv["Variables"]["user"] }) => c.get("user")!.id;

me.get("/profile", async (c) => c.json({ profile: await getProfile(c.env.DB, uid(c)) }));
me.put("/profile", async (c) => {
  const p = await body(c, profileSchema);
  await c.env.DB.prepare("INSERT INTO profiles (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
    .bind(uid(c), JSON.stringify(p), now())
    .run();
  return c.json({ profile: p });
});

me.get("/assessments", async (c) => {
  const db = c.env.DB;
  const profile = await getProfile(db, uid(c));
  const { results } = await db.prepare("SELECT * FROM scholarships ORDER BY country, name").all<Record<string, unknown>>();
  const reqs = await listRequirements(db);
  const assessments = results.map((r) => {
    const s = parseJsonCols(r, SCH_JSON) as unknown as Scholarship;
    return { scholarship: s, assessment: assess(s, reqs.filter((x) => x.scholarship_id === s.id), profile, today()) };
  });
  return c.json({ assessments });
});

me.get("/assessments/:id", async (c) => {
  const s = await getScholarship(c.env.DB, c.req.param("id"));
  if (!s) return c.json({ error: "Not found." }, 404);
  const assessment = assess(s, await listRequirements(c.env.DB, s.id), await getProfile(c.env.DB, uid(c)), today());
  return c.json({ scholarship: s, assessment });
});

me.get("/saved", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT s.* FROM saved_scholarships v JOIN scholarships s ON s.id = v.scholarship_id WHERE v.user_id = ? ORDER BY v.created_at DESC")
    .bind(uid(c))
    .all<Record<string, unknown>>();
  return c.json({ saved: results.map((r) => parseJsonCols(r, SCH_JSON)) });
});
me.post("/saved/:id", async (c) => {
  if (!(await getScholarship(c.env.DB, c.req.param("id")))) return c.json({ error: "Not found." }, 404);
  await c.env.DB.prepare("INSERT OR IGNORE INTO saved_scholarships (user_id, scholarship_id, created_at) VALUES (?, ?, ?)").bind(uid(c), c.req.param("id"), now()).run();
  return c.json({ ok: true });
});
me.delete("/saved/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM saved_scholarships WHERE user_id = ? AND scholarship_id = ?").bind(uid(c), c.req.param("id")).run();
  return c.json({ ok: true });
});

// Applications
me.get("/applications", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM applications WHERE user_id = ? ORDER BY created_at").bind(uid(c)).all();
  return c.json({ applications: results });
});

me.post("/applications", async (c) => {
  const b = await body(
    c,
    z.object({
      scholarshipId: z.string().max(100).optional(),
      title: z.string().min(1).max(160).optional(),
      institution: z.string().max(160).optional(),
      mode: z.enum(["guided", "assisted", "managed"]).default("guided"),
    }),
  );
  // Assisted and managed modes need a real service and the provider's permission; not offered yet.
  if (b.mode !== "guided") return c.json({ error: "Only guided self-application is available right now." }, 400);
  const db = c.env.DB;
  const s = b.scholarshipId ? await getScholarship(db, b.scholarshipId) : null;
  if (b.scholarshipId && !s) return c.json({ error: "Scholarship not found." }, 404);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM applications WHERE user_id = ?").bind(uid(c)).first<{ n: number }>();
  if ((count?.n ?? 0) >= 25) return c.json({ error: "Limit of 25 applications reached." }, 400);

  const id = newId();
  const t = now();
  const stmts = [
    db.prepare("INSERT INTO applications (id, user_id, scholarship_id, title, institution, mode, deadline_date, deadline_confirmed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
      id,
      uid(c),
      s?.id ?? null,
      b.title ?? s?.name ?? "Untitled application",
      b.institution ?? s?.provider ?? null,
      b.mode,
      s ? s.deadline_date ?? s.proposed_deadline ?? null : null,
      s && (s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING") && s.deadline_date ? 1 : 0,
      t,
      t,
    ),
  ];
  if (s) {
    const drafts = generateChecklist(s, await listRequirements(db, s.id));
    const ids = new Map(drafts.map((d) => [d.key, newId()]));
    drafts.forEach((d, i) =>
      stmts.push(
        db.prepare(
          `INSERT INTO tasks (id, user_id, application_id, title, instructions, reason, requirement_type, due_date, due_confirmed, source_url, source_verified_at,
            depends_on, documents, next_action, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).bind(
          ids.get(d.key)!,
          uid(c),
          id,
          d.title,
          d.instructions,
          d.reason,
          d.requirement_type,
          d.due_date,
          d.due_confirmed ? 1 : 0,
          d.source_url,
          d.source_verified_at,
          JSON.stringify(d.depends_on.map((k) => ids.get(k)).filter(Boolean)),
          JSON.stringify(d.documents),
          d.next_action,
          i,
          t,
          t,
        ),
      ),
    );
  }
  await db.batch(stmts);
  return c.json({ application: await db.prepare("SELECT * FROM applications WHERE id = ?").bind(id).first() }, 201);
});

const EVIDENCE_STAGES = ["submitted", "received", "under_evaluation", "admitted", "rejected"];
me.patch("/applications/:id", async (c) => {
  const b = await body(c, z.object({ stage: z.enum(APPLICATION_STAGES).optional(), stageEvidence: z.string().max(500).optional(), title: z.string().min(1).max(160).optional() }));
  const db = c.env.DB;
  const app_ = await db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").bind(c.req.param("id"), uid(c)).first<Record<string, string>>();
  if (!app_) return c.json({ error: "Not found." }, 404);
  if (b.stage && EVIDENCE_STAGES.includes(b.stage) && !(b.stageEvidence && b.stageEvidence.trim().length >= 3))
    return c.json({ error: "Add evidence (e.g. confirmation number or email reference) for this stage." }, 400);
  await db.prepare("UPDATE applications SET stage = ?, stage_evidence = ?, title = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(b.stage ?? app_.stage, b.stageEvidence ?? app_.stage_evidence, b.title ?? app_.title, now(), app_.id, uid(c))
    .run();
  return c.json({ application: await db.prepare("SELECT * FROM applications WHERE id = ?").bind(app_.id).first() });
});

me.delete("/applications/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM applications WHERE id = ? AND user_id = ?").bind(c.req.param("id"), uid(c)).run();
  return c.json({ ok: true });
});

// Tasks
me.get("/tasks", async (c) => {
  const tasks = await listTasks(c.env.DB, uid(c), c.req.query("application_id"));
  return c.json({ tasks: tasks.map((t) => ({ ...t, blocked_by: blockedBy(t, tasks) })), progress: progress(tasks) });
});

me.post("/tasks", async (c) => {
  const b = await body(
    c,
    z.object({
      applicationId: z.string().max(100).optional(),
      title: z.string().min(1).max(200),
      instructions: z.string().max(2000).optional(),
      requirementType: z.enum(["mandatory", "conditional", "recommended"]).default("recommended"),
      dueDate: z.iso.date().optional(),
    }),
  );
  const db = c.env.DB;
  if (b.applicationId && !(await db.prepare("SELECT 1 FROM applications WHERE id = ? AND user_id = ?").bind(b.applicationId, uid(c)).first()))
    return c.json({ error: "Application not found." }, 404);
  const id = newId();
  const t = now();
  // Student-entered dates are their own reminders, not confirmed official deadlines.
  await db.prepare("INSERT INTO tasks (id, user_id, application_id, title, instructions, requirement_type, due_date, due_confirmed, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 999, ?, ?)")
    .bind(id, uid(c), b.applicationId ?? null, b.title, b.instructions ?? null, b.requirementType, b.dueDate ?? null, t, t)
    .run();
  return c.json({ task: await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(id).first() }, 201);
});

me.patch("/tasks/:id", async (c) => {
  // Students can only change their own status; institutional verification is admin-only.
  const b = await body(c, z.object({ studentStatus: z.enum(STUDENT_STATUSES).optional(), applicable: z.boolean().optional() }).strict());
  const db = c.env.DB;
  const task = await db.prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?").bind(c.req.param("id"), uid(c)).first<Record<string, unknown>>();
  if (!task) return c.json({ error: "Not found." }, 404);
  if (b.applicable === false && task.requirement_type === "mandatory") return c.json({ error: "Mandatory tasks cannot be marked not applicable." }, 400);
  await db.prepare("UPDATE tasks SET student_status = ?, applicable = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .bind(b.studentStatus ?? task.student_status, b.applicable === undefined ? task.applicable : b.applicable ? 1 : 0, now(), task.id, uid(c))
    .run();
  const tasks = await listTasks(db, uid(c));
  const updated = tasks.find((t) => t.id === task.id);
  const scoped = task.application_id ? tasks.filter((t) => t.application_id === task.application_id) : tasks;
  return c.json({ task: updated, progress: progress(scoped), overall: progress(tasks) });
});

me.delete("/tasks/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM tasks WHERE id = ? AND user_id = ? AND requirement_type != 'mandatory'").bind(c.req.param("id"), uid(c)).run();
  if (!r.meta.changes) return c.json({ error: "Not found or mandatory." }, 400);
  return c.json({ ok: true });
});

// Dashboard
me.get("/dashboard", async (c) => {
  const db = c.env.DB;
  const id = uid(c);
  const [profile, tasks, apps, saved, notes] = await Promise.all([
    getProfile(db, id),
    listTasks(db, id),
    db.prepare("SELECT * FROM applications WHERE user_id = ? ORDER BY created_at").bind(id).all<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) AS n FROM saved_scholarships WHERE user_id = ?").bind(id).first<{ n: number }>(),
    db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10").bind(id).all(),
  ]);
  const t = today();
  const perApp = apps.results.map((a) => {
    const ts = tasks.filter((x) => x.application_id === a.id);
    return { ...a, progress: progress(ts), daysLeft: a.deadline_date && a.deadline_confirmed ? daysUntil(a.deadline_date, t) : null };
  });
  const deadlines = tasks
    .filter((x) => x.due_date && x.applicable)
    .map((x) => ({ id: x.id, title: x.title, date: x.due_date, confirmed: !!x.due_confirmed, days: daysUntil(x.due_date, t), application_id: x.application_id }))
    .filter((d) => d.days >= -7)
    .sort((a, b) => a.days - b.days)
    .slice(0, 8);
  const attention = tasks
    .filter((x) => x.applicable && (x.student_status === "NEEDS_REVIEW" || x.verified_status === "NEEDS_REVIEW" || x.change_note || x.student_status === "BLOCKED"))
    .map((x) => ({ id: x.id, title: x.title, why: x.change_note ?? (x.student_status === "BLOCKED" ? "Marked blocked" : "Needs review") }));
  const docs = tasks.filter((x) => x.applicable && (x.documents as string[]).length > 0);
  const appTitle = Object.fromEntries(apps.results.map((a) => [a.id, a.title]));

  // Relevant opportunities: real (non-test) awards not yet saved or tracked whose published rules
  // the student does not fail. Ordered MET first; never presented as a chance of success.
  const tracked = new Set([...apps.results.map((a) => a.scholarship_id), ...(await db.prepare("SELECT scholarship_id FROM saved_scholarships WHERE user_id = ?").bind(id).all<{ scholarship_id: string }>()).results.map((r) => r.scholarship_id)]);
  const { results: schRows } = await db.prepare("SELECT * FROM scholarships WHERE is_test_data = 0 AND status NOT IN ('VERIFIED_CLOSED','CANCELLED') AND cycle_state != 'closed'").all<Record<string, unknown>>();
  const allReqs = await listRequirements(db);
  const rank: Record<string, number> = { MET: 0, NEEDS_REVIEW: 1, UNKNOWN: 2 };
  const opportunities = Object.keys(profile).length
    ? schRows
        .map((r) => parseJsonCols(r, SCH_JSON) as unknown as Scholarship)
        .filter((s) => !tracked.has(s.id) && (!profile.targetCountries?.length || profile.targetCountries.includes(s.country)) && (!profile.targetLevel || s.levels.includes(profile.targetLevel)))
        .map((s) => ({ s, a: assess(s, allReqs.filter((x) => x.scholarship_id === s.id), profile, t) }))
        .filter((x) => x.a.overall !== "NOT_MET")
        .sort((x, y) => rank[x.a.overall] - rank[y.a.overall])
        .slice(0, 5)
        .map(({ s, a }) => ({ id: s.id, name: s.name, country: s.country, status: s.status, cycle_state: s.cycle_state, status_reason: s.status_reason, funding_class: s.funding_class, overall: a.overall }))
    : [];

  const funding: { title: string; why: string; to: string }[] = [];
  if (profile.budgetPkr === undefined) funding.push({ title: "Estimate your budget", why: "Add the amount your family can legitimately arrange, so funding gaps can be calculated.", to: "/app/profile" });
  if (apps.results.length) funding.push({ title: "Plan the real cost of each application", why: "Compare tuition, living, visa and travel against what each award documents it pays.", to: "/costs" });
  for (const a of apps.results.filter((a) => a.scholarship_id)) {
    const s = schRows.find((x) => x.id === a.scholarship_id);
    if (s && (s.funding_class ?? "unknown") === "unknown") funding.push({ title: `Confirm what ${a.title} pays`, why: "Coverage isn't confirmed yet. Check tuition, stipend and housing on the official page.", to: `/scholarships/${a.scholarship_id}` });
  }

  // Latest saved financial plan. Financial progress is reported separately from application progress.
  const latestPlan = await db
    .prepare("SELECT plan_id, version, title, country, application_id, summary, created_at FROM fin_assessments WHERE user_id = ? ORDER BY created_at DESC LIMIT 1")
    .bind(id)
    .first<Record<string, any>>();
  const finance: Record<string, any> | null = latestPlan ? { ...latestPlan, summary: JSON.parse(latestPlan.summary) } : null;
  if (!finance) funding.unshift({ title: "Run the Cost Planner", why: "Get a without/with-scholarship estimate and see how much cash you need at each stage.", to: "/costs" });
  else {
    if (finance.summary.missing.length) funding.unshift({ title: "Fill in unknown costs", why: `${finance.summary.missing.length} cost(s) in "${finance.title}" are unknown and excluded.`, to: `/costs?plan=${finance.plan_id}` });
    if (finance.summary.evidence.VERIFIED === 0) funding.push({ title: "Confirm costs on official pages", why: "None of your plan's figures are verified official amounts yet.", to: `/costs?plan=${finance.plan_id}` });
  }

  return c.json({
    finance,
    opportunities,
    funding: funding.slice(0, 4),
    agenda: tasks
      .filter((x) => x.due_date && x.applicable && !["COMPLETED_BY_STUDENT", "SUBMITTED"].includes(x.student_status))
      .map((x) => ({ id: x.id, title: x.title, date: x.due_date, confirmed: !!x.due_confirmed, application: appTitle[x.application_id] ?? null, application_id: x.application_id }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(0, 20),
    profile,
    overall: progress(tasks),
    applications: perApp,
    savedCount: saved?.n ?? 0,
    deadlines,
    attention,
    documents: { total: docs.length, ready: docs.filter((x) => ["COMPLETED_BY_STUDENT", "SUBMITTED"].includes(x.student_status)).length },
    nextActions: nextActions(tasks, 3).map((x: any) => ({ ...x, application: appTitle[x.application_id] ?? null })),
    notifications: notes.results,
  });
});

// Fact bank + Writing Studio
me.get("/facts", async (c) => c.json({ facts: (await c.env.DB.prepare("SELECT * FROM facts WHERE user_id = ? ORDER BY created_at").bind(uid(c)).all()).results }));
me.post("/facts", async (c) => {
  const b = await body(c, z.object({ category: z.enum(["academic", "project", "experience", "motivation", "goal", "award", "other"]), text: z.string().min(3).max(1000), evidence: z.string().max(500).optional() }));
  const id = newId();
  await c.env.DB.prepare("INSERT INTO facts (id, user_id, category, text, evidence, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, uid(c), b.category, b.text, b.evidence ?? null, now()).run();
  return c.json({ id }, 201);
});
me.delete("/facts/:id", async (c) => {
  await c.env.DB.prepare("DELETE FROM facts WHERE id = ? AND user_id = ?").bind(c.req.param("id"), uid(c)).run();
  return c.json({ ok: true });
});

me.get("/writing", async (c) => c.json({ docs: (await c.env.DB.prepare("SELECT id, kind, title, policy_mode, word_limit, version, facts_confirmed, application_id, updated_at FROM writing_docs WHERE user_id = ? ORDER BY updated_at DESC").bind(uid(c)).all()).results }));

me.post("/writing", async (c) => {
  const b = await body(
    c,
    z.object({
      kind: z.enum(Object.keys(DOC_KINDS) as [DocKind, ...DocKind[]]),
      title: z.string().min(1).max(160),
      applicationId: z.string().max(100).optional(),
      wordLimit: z.number().int().min(50).max(20000).optional(),
      requiredSections: z.array(z.string().max(80)).max(20).default([]),
    }),
  );
  const db = c.env.DB;
  let policy = "POLICY_UNCONFIRMED";
  if (b.applicationId) {
    const a = await db.prepare("SELECT a.id, s.writing_policy FROM applications a LEFT JOIN scholarships s ON s.id = a.scholarship_id WHERE a.id = ? AND a.user_id = ?").bind(b.applicationId, uid(c)).first<{ writing_policy: string | null }>();
    if (!a) return c.json({ error: "Application not found." }, 404);
    policy = a.writing_policy ?? policy;
  }
  const id = newId();
  await db.prepare("INSERT INTO writing_docs (id, user_id, application_id, kind, title, policy_mode, word_limit, required_sections, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, uid(c), b.applicationId ?? null, b.kind, b.title, policy, b.wordLimit ?? null, JSON.stringify(b.requiredSections), now())
    .run();
  return c.json({ id }, 201);
});

async function loadDoc(c: any) {
  const row = await c.env.DB.prepare("SELECT * FROM writing_docs WHERE id = ? AND user_id = ?").bind(c.req.param("id"), uid(c)).first();
  return row ? parseJsonCols(row as Record<string, unknown>, ["required_sections"]) as any : null;
}

me.get("/writing/:id", async (c) => {
  const d = await loadDoc(c);
  if (!d) return c.json({ error: "Not found." }, 404);
  return c.json({ doc: d, capabilities: capabilities(d.policy_mode), questions: coachingQuestions(d.kind) });
});

me.patch("/writing/:id", async (c) => {
  const b = await body(c, z.object({ content: z.string().max(100_000).optional(), factsConfirmed: z.boolean().optional() }));
  const d = await loadDoc(c);
  if (!d) return c.json({ error: "Not found." }, 404);
  const db = c.env.DB;
  const changed = b.content !== undefined && b.content !== d.content;
  const version = changed ? d.version + 1 : d.version;
  const stmts = [
    // Editing the text resets the student's fact confirmation; they must confirm the new version.
    db.prepare("UPDATE writing_docs SET content = ?, version = ?, facts_confirmed = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(
      changed ? b.content : d.content,
      version,
      changed ? 0 : b.factsConfirmed === undefined ? d.facts_confirmed : b.factsConfirmed ? 1 : 0,
      now(),
      d.id,
      uid(c),
    ),
  ];
  if (changed) stmts.push(db.prepare("INSERT INTO writing_versions (doc_id, version, content, created_at) VALUES (?, ?, ?, ?)").bind(d.id, version, b.content, now()));
  await db.batch(stmts);
  return c.json({ doc: await loadDoc(c) });
});

me.get("/writing/:id/versions", async (c) => {
  const d = await loadDoc(c);
  if (!d) return c.json({ error: "Not found." }, 404);
  return c.json({ versions: (await c.env.DB.prepare("SELECT version, content, created_at FROM writing_versions WHERE doc_id = ? ORDER BY version DESC LIMIT 50").bind(d.id).all()).results });
});

me.post("/writing/:id/check", async (c) => {
  const d = await loadDoc(c);
  if (!d) return c.json({ error: "Not found." }, 404);
  const db = c.env.DB;
  const facts = (await db.prepare("SELECT id, category, text FROM facts WHERE user_id = ?").bind(uid(c)).all<any>()).results;
  const a = d.application_id ? await db.prepare("SELECT institution FROM applications WHERE id = ? AND user_id = ?").bind(d.application_id, uid(c)).first<{ institution: string }>() : null;
  const known = (await db.prepare("SELECT DISTINCT provider FROM scholarships").all<{ provider: string }>()).results.map((r) => r.provider);
  const issues = checkDocument({
    content: d.content,
    wordLimit: d.word_limit,
    requiredSections: d.required_sections,
    profile: await getProfile(db, uid(c)),
    facts,
    institution: a?.institution ?? null,
    knownInstitutions: known,
  });
  return c.json({ issues, wordCount: (d.content.trim().match(/\S+/g) ?? []).length });
});

me.post("/writing/:id/outline", async (c) => {
  const d = await loadDoc(c);
  if (!d) return c.json({ error: "Not found." }, 404);
  const cap = capabilities(d.policy_mode);
  if (!cap.outline) return c.json({ error: cap.warning, mode: d.policy_mode }, 403);
  const facts = (await c.env.DB.prepare("SELECT id, category, text FROM facts WHERE user_id = ?").bind(uid(c)).all<any>()).results;
  const a = d.application_id ? await c.env.DB.prepare("SELECT institution FROM applications WHERE id = ? AND user_id = ?").bind(d.application_id, uid(c)).first<{ institution: string }>() : null;
  return c.json({ outline: outlineFromFacts(d.kind, facts, a?.institution ?? null) });
});

// Notifications
me.get("/notifications", async (c) => c.json({ notifications: (await c.env.DB.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(uid(c)).all()).results }));
me.get("/notification-prefs", async (c) => c.json({ prefs: await c.env.DB.prepare("SELECT * FROM notification_prefs WHERE user_id = ?").bind(uid(c)).first() }));
me.put("/notification-prefs", async (c) => {
  const b = await body(c, z.object({ deadlines: z.boolean(), documents: z.boolean(), opportunities: z.boolean(), renewals: z.boolean(), paused: z.boolean(), max_per_week: z.number().int().min(0).max(14) }));
  await c.env.DB.prepare("INSERT OR REPLACE INTO notification_prefs (user_id, deadlines, documents, opportunities, renewals, paused, max_per_week) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(uid(c), +b.deadlines, +b.documents, +b.opportunities, +b.renewals, +b.paused, b.max_per_week)
    .run();
  return c.json({ ok: true });
});

// Privacy: export and delete
me.get("/export", async (c) => {
  const db = c.env.DB;
  const id = uid(c);
  const q = (sql: string) => db.prepare(sql).bind(id).all().then((r) => r.results);
  return c.json({
    user: await db.prepare("SELECT id, email, name, role, consent_at, created_at FROM users WHERE id = ?").bind(id).first(),
    profile: await getProfile(db, id),
    applications: await q("SELECT * FROM applications WHERE user_id = ?"),
    tasks: await q("SELECT * FROM tasks WHERE user_id = ?"),
    facts: await q("SELECT * FROM facts WHERE user_id = ?"),
    writing: await q("SELECT * FROM writing_docs WHERE user_id = ?"),
    financialPlans: await q("SELECT * FROM fin_assessments WHERE user_id = ?"),
    saved: await q("SELECT * FROM saved_scholarships WHERE user_id = ?"),
  });
});
me.delete("/account", async (c) => {
  const id = uid(c);
  await destroySession(c);
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run(); // cascades to all student rows
  await audit(c.env.DB, null, "account_deleted", "user", id);
  return c.json({ ok: true });
});

app.route("/me", me);

// ---------- admin ----------
const admin = new Hono<AppEnv>();
admin.use("*", requireAdmin);
const aid = (c: any) => c.get("user")!.id as string;

admin.get("/coverage", async (c) => {
  const db = c.env.DB;
  const one = (sql: string) => db.prepare(sql).first<Record<string, number>>();
  const sources = await one(`SELECT COUNT(*) AS total,
    SUM(review_status = 'discovered') AS discovered, SUM(review_status = 'reviewed') AS reviewed, SUM(review_status = 'indexed') AS indexed,
    SUM(review_status = 'inaccessible') AS inaccessible, SUM(review_status = 'outstanding') AS outstanding,
    SUM(last_success_at IS NOT NULL) AS checked_ok FROM sources`);
  const sch = await one(`SELECT COUNT(*) AS total, SUM(status LIKE 'VERIFIED_%') AS verified, SUM(status = 'NEEDS_REVIEW') AS needs_review,
    SUM(status = 'CONFLICTING_SOURCES') AS conflicting, SUM(is_test_data = 1) AS test_data FROM scholarships`);
  const req = await one(`SELECT COUNT(*) AS total, SUM(excerpt IS NOT NULL AND source_url IS NOT NULL) AS with_evidence,
    SUM(review_status = 'VERIFIED') AS verified, SUM(review_status = 'CONFLICTING') AS conflicting FROM requirements`);
  const reports = await one("SELECT COUNT(*) AS open FROM error_reports WHERE status = 'open'");
  const byCountry = (await db.prepare("SELECT country, COUNT(*) AS sources FROM sources GROUP BY country").all()).results;
  const byStatus = (await db.prepare("SELECT status, COALESCE(verification_method, 'none') AS method, COUNT(*) AS n FROM scholarships WHERE is_test_data = 0 GROUP BY status, method ORDER BY status").all()).results;
  const tasks = (await db.prepare("SELECT kind, COUNT(*) AS n FROM review_tasks WHERE status = 'open' GROUP BY kind").all()).results;
  const job = await one("SELECT COUNT(*) AS checks, SUM(ok) AS ok, MAX(checked_at) AS last FROM source_checks WHERE checked_at > datetime('now', '-1 day')");
  return c.json({ sources, scholarships: sch, requirements: req, reports, byCountry, byStatus, tasks, job });
});

admin.get("/sources", async (c) => c.json({ sources: (await c.env.DB.prepare("SELECT * FROM sources ORDER BY country, name").all()).results }));
admin.patch("/sources/:id", async (c) => {
  const b = await body(c, z.object({ review_status: z.enum(["discovered", "reviewed", "indexed", "inaccessible", "outstanding"]), notes: z.string().max(2000).optional() }));
  const r = await c.env.DB.prepare("UPDATE sources SET review_status = ?, notes = COALESCE(?, notes), last_reviewed_at = ? WHERE id = ?").bind(b.review_status, b.notes ?? null, now(), c.req.param("id")).run();
  if (!r.meta.changes) return c.json({ error: "Not found." }, 404);
  await audit(c.env.DB, aid(c), "source_review", "source", c.req.param("id"), b);
  return c.json({ ok: true });
});
admin.post("/sources/check", async (c) => c.json(await runSourceChecks(c.env.DB, 5)));

admin.patch("/scholarships/:id", async (c) => {
  const b = await body(
    c,
    z.object({
      status: z.enum(OPPORTUNITY_STATUSES).optional(),
      deadline_date: z.iso.date().nullable().optional(),
      deadline_text: z.string().max(300).nullable().optional(),
      writing_policy: z.enum(WRITING_MODES).optional(),
      funding_class: z.enum(FUNDING_CLASSES).optional(),
      evidence_note: z.string().max(2000).optional(),
      reason: z.string().min(3).max(500),
    }),
  );
  const db = c.env.DB;
  const s = await getScholarship(db, c.req.param("id"));
  if (!s) return c.json({ error: "Not found." }, 404);
  const next = { ...s, ...Object.fromEntries(Object.entries(b).filter(([k, v]) => k !== "reason" && v !== undefined)) } as Scholarship;
  const verifying = next.status.startsWith("VERIFIED_");
  if (verifying && next.status !== "VERIFIED_CLOSED" && !next.deadline_date) return c.json({ error: "An open or upcoming verified record needs a checked deadline date." }, 400);
  const t = now();
  const stmts = [
    db.prepare("INSERT INTO record_history (entity, entity_id, version, snapshot, changed_by, reason, changed_at) VALUES ('scholarship', ?, ?, ?, ?, ?, ?)").bind(s.id, s.version, JSON.stringify(s), aid(c), b.reason, t),
    // A reviewer's verification is recorded as 'human'; moving back to review clears the method.
    db.prepare(
      `UPDATE scholarships SET status = ?, deadline_date = ?, deadline_text = ?, writing_policy = ?, funding_class = ?, evidence_note = ?, last_verified_at = ?,
       verification_method = ?, cycle_state = ?, status_reason = ?, version = version + 1, updated_at = ? WHERE id = ?`,
    ).bind(
      next.status, next.deadline_date, next.deadline_text, next.writing_policy, next.funding_class ?? "unknown", next.evidence_note,
      verifying ? t : null, verifying ? "human" : s.verification_method === "human" ? null : s.verification_method ?? null,
      verifying ? ({ VERIFIED_OPEN: "open", VERIFIED_UPCOMING: "upcoming", VERIFIED_CLOSED: "closed" } as Record<string, string>)[next.status] : s.cycle_state ?? "unknown",
      verifying ? null : next.status === "CONFLICTING_SOURCES" ? `Official sources disagree. ${b.reason}` : s.status_reason ?? null,
      t, s.id,
    ),
  ];
  // A reviewer decision resolves the record's open verification task.
  if (verifying || next.status === "CONFLICTING_SOURCES" || next.status === "CANCELLED")
    stmts.push(
      db.prepare("UPDATE review_tasks SET status = 'done', resolved_at = ?, resolved_by = ?, detail = detail || ' | ' || ? WHERE scholarship_id = ? AND kind = 'verify_record' AND status = 'open'").bind(t, aid(c), `Reviewer: ${next.status} — ${b.reason}`, s.id),
    );
  // A deadline change flows into every linked application and its submission task.
  const deadlineChanged = b.deadline_date !== undefined && b.deadline_date !== s.deadline_date;
  const confirmed = (next.status === "VERIFIED_OPEN" || next.status === "VERIFIED_UPCOMING") && !!next.deadline_date ? 1 : 0;
  if (deadlineChanged || b.status) {
    stmts.push(db.prepare("UPDATE applications SET deadline_date = ?, deadline_confirmed = ?, updated_at = ? WHERE scholarship_id = ?").bind(next.deadline_date, confirmed, t, s.id));
    stmts.push(
      db.prepare(`UPDATE tasks SET due_date = ?, due_confirmed = ?, change_note = ?, updated_at = ? WHERE source_url = ? AND title LIKE 'Submit%'
        AND application_id IN (SELECT id FROM applications WHERE scholarship_id = ?)`).bind(next.deadline_date, confirmed, deadlineChanged ? `Deadline changed: ${b.reason}` : null, t, s.official_url, s.id),
    );
  }
  await db.batch(stmts);
  await audit(db, aid(c), "scholarship_update", "scholarship", s.id, b);
  let notified = 0;
  if (deadlineChanged || (b.status && b.status !== s.status)) {
    const { results } = await db.prepare("SELECT DISTINCT user_id FROM saved_scholarships WHERE scholarship_id = ? UNION SELECT DISTINCT user_id FROM applications WHERE scholarship_id = ?").bind(s.id, s.id).all<{ user_id: string }>();
    for (const r of results) if (await notify(db, r.user_id, "change", `sch:${s.id}:v${s.version + 1}`, `Update: ${s.name}`, b.reason)) notified++;
  }
  return c.json({ scholarship: await getScholarship(db, s.id), notified });
});

// Reviewer confirms every rule of a record that carries an official quote (after reading them against the source).
admin.post("/scholarships/:id/confirm-rules", async (c) => {
  const b = await body(c, z.object({ reason: z.string().min(3).max(500) }));
  const db = c.env.DB;
  const { results } = await db.prepare("SELECT * FROM requirements WHERE scholarship_id = ? AND review_status != 'VERIFIED' AND excerpt IS NOT NULL AND excerpt != ''").bind(c.req.param("id")).all<Record<string, any>>();
  if (!results.length) return c.json({ confirmed: 0 });
  const t = now();
  const stmts = results.flatMap((r) => [
    db.prepare("INSERT INTO record_history (entity, entity_id, version, snapshot, changed_by, reason, changed_at) VALUES ('requirement', ?, ?, ?, ?, ?, ?)").bind(r.id, r.version, JSON.stringify(r), aid(c), b.reason, t),
    db.prepare("UPDATE requirements SET review_status = 'VERIFIED', verified_at = ?, version = version + 1 WHERE id = ?").bind(t, r.id),
  ]);
  await db.batch(stmts);
  await audit(db, aid(c), "rules_confirm", "scholarship", c.req.param("id"), { count: results.length, reason: b.reason });
  return c.json({ confirmed: results.length });
});

admin.patch("/requirements/:id", async (c) => {
  const b = await body(c, z.object({ review_status: z.enum(["VERIFIED", "NEEDS_REVIEW", "CONFLICTING"]).optional(), text: z.string().min(3).max(2000).optional(), excerpt: z.string().max(500).optional(), reason: z.string().min(3).max(500) }));
  const db = c.env.DB;
  const r = await db.prepare("SELECT * FROM requirements WHERE id = ?").bind(c.req.param("id")).first<Record<string, any>>();
  if (!r) return c.json({ error: "Not found." }, 404);
  if (b.review_status === "VERIFIED" && !(b.excerpt ?? r.excerpt) ) return c.json({ error: "A verified rule needs a source excerpt." }, 400);
  const t = now();
  await db.batch([
    db.prepare("INSERT INTO record_history (entity, entity_id, version, snapshot, changed_by, reason, changed_at) VALUES ('requirement', ?, ?, ?, ?, ?, ?)").bind(r.id, r.version, JSON.stringify(r), aid(c), b.reason, t),
    db.prepare("UPDATE requirements SET review_status = ?, text = ?, excerpt = ?, verified_at = ?, version = version + 1 WHERE id = ?").bind(
      b.review_status ?? r.review_status, b.text ?? r.text, b.excerpt ?? r.excerpt, b.review_status === "VERIFIED" ? t : r.verified_at, r.id,
    ),
  ]);
  await audit(db, aid(c), "requirement_update", "requirement", r.id, b);
  return c.json({ requirement: await db.prepare("SELECT * FROM requirements WHERE id = ?").bind(r.id).first() });
});

admin.get("/history/:entity/:id", async (c) => c.json({ history: (await c.env.DB.prepare("SELECT * FROM record_history WHERE entity = ? AND entity_id = ? ORDER BY version DESC").bind(c.req.param("entity"), c.req.param("id")).all()).results }));

admin.get("/reports", async (c) => c.json({ reports: (await c.env.DB.prepare("SELECT r.*, s.name AS scholarship_name FROM error_reports r LEFT JOIN scholarships s ON s.id = r.scholarship_id ORDER BY r.status = 'open' DESC, r.created_at DESC LIMIT 200").all()).results }));
admin.patch("/reports/:id", async (c) => {
  const b = await body(c, z.object({ status: z.enum(["accepted", "rejected", "fixed"]), resolution: z.string().min(3).max(2000) }));
  const r = await c.env.DB.prepare("UPDATE error_reports SET status = ?, resolution = ?, resolved_at = ? WHERE id = ?").bind(b.status, b.resolution, now(), c.req.param("id")).run();
  if (!r.meta.changes) return c.json({ error: "Not found." }, 404);
  await audit(c.env.DB, aid(c), "report_resolve", "error_report", c.req.param("id"), b);
  return c.json({ ok: true });
});

admin.patch("/tasks/:id/verify", async (c) => {
  const b = await body(c, z.object({ verified_status: z.enum(VERIFIED_STATUSES), note: z.string().min(3).max(500) }));
  const r = await c.env.DB.prepare("UPDATE tasks SET verified_status = ?, updated_at = ? WHERE id = ?").bind(b.verified_status, now(), c.req.param("id")).run();
  if (!r.meta.changes) return c.json({ error: "Not found." }, 404);
  await audit(c.env.DB, aid(c), "task_verify", "task", c.req.param("id"), b);
  return c.json({ ok: true });
});

admin.get("/review-tasks", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT t.*, s.name AS source_name, s.url AS source_url, sch.name AS scholarship_name FROM review_tasks t
     LEFT JOIN sources s ON s.id = t.source_id LEFT JOIN scholarships sch ON sch.id = t.scholarship_id
     ORDER BY t.status = 'open' DESC, t.id DESC LIMIT 300`,
  ).all();
  return c.json({ tasks: results });
});
admin.patch("/review-tasks/:id", async (c) => {
  const b = await body(c, z.object({ status: z.enum(["done", "dismissed"]), note: z.string().min(3).max(500) }));
  const r = await c.env.DB.prepare("UPDATE review_tasks SET status = ?, resolved_at = ?, resolved_by = ?, detail = detail || ' | ' || ? WHERE id = ? AND status = 'open'")
    .bind(b.status, now(), aid(c), b.note, Number(c.req.param("id")))
    .run();
  if (!r.meta.changes) return c.json({ error: "Not found or already closed." }, 404);
  await audit(c.env.DB, aid(c), "review_task_close", "review_task", c.req.param("id"), b);
  return c.json({ ok: true });
});

admin.post("/users/reset-link", async (c) => {
  const b = await body(c, z.object({ email: z.email().transform((e) => e.toLowerCase()) }));
  const u = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(b.email).first<{ id: string }>();
  if (!u) return c.json({ error: "No account with that email." }, 404);
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const token = [...raw].map((x) => x.toString(16).padStart(2, "0")).join("");
  await c.env.DB.prepare("INSERT INTO password_resets (token_hash, user_id, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(await sha256Hex(token), u.id, new Date(Date.now() + 24 * 3600_000).toISOString(), aid(c), now())
    .run();
  await audit(c.env.DB, aid(c), "password_reset_issued", "user", u.id);
  // Shown once to the admin, who hands it to the student out of band. Never logged or stored in plain text.
  return c.json({ link: `${new URL(c.req.url).origin}/reset?token=${token}`, expiresInHours: 24 });
});

admin.get("/audit", async (c) => c.json({ audit: (await c.env.DB.prepare("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200").all()).results }));

app.route("/admin", admin);

app.route("/", plannerRoutes);
app.route("/", routeRoutes);
app.route("/", discoveryRoutes);

app.all("*", (c) => c.json({ error: "Not found." }, 404));
