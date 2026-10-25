import { app } from "../worker/app";
import type { Env } from "../worker/env";
import { createTestDb } from "./d1-shim";

export function makeEnv(extra: Partial<Env> = {}): Env {
  return { DB: createTestDb(), APP_ENV: "test", PAYMENTS_ENABLED: "false", AI_ENABLED: "false", ADMIN_EMAILS: "admin@test.local", ...extra };
}

/** A tiny client that keeps its own session cookie, like one browser. */
export function client(env: Env) {
  let cookie = "";
  const call = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.request(
      "http://localhost/api" + path,
      {
        method,
        headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      env,
    );
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, json };
  };
  return {
    get: (p: string) => call("GET", p),
    post: (p: string, b: unknown = {}, h?: Record<string, string>) => call("POST", p, b, h),
    put: (p: string, b: unknown) => call("PUT", p, b),
    patch: (p: string, b: unknown) => call("PATCH", p, b),
    del: (p: string) => call("DELETE", p),
    async register(email: string, name = "Test Student") {
      return call("POST", "/auth/register", { email, name, password: "correct horse battery", consent: true });
    },
  };
}

export async function seedScholarship(env: Env, over: Record<string, unknown> = {}) {
  const s = {
    id: "test-sch",
    name: "TEST Scholarship",
    country: "CN",
    provider: "Test University",
    official_url: "https://example.org/test-call",
    levels: '["master","phd"]',
    applicant_type: "new",
    coverage: JSON.stringify({ tuition: "full", stipend: { amount: 3000, currency: "CNY", period: "month" } }),
    status: "NEEDS_REVIEW",
    deadline_date: null,
    is_test_data: 1,
    writing_policy: "POLICY_UNCONFIRMED",
    ...over,
  } as Record<string, unknown>;
  await env.DB.prepare(
    "INSERT INTO scholarships (id, name, country, provider, official_url, levels, applicant_type, coverage, status, deadline_date, is_test_data, writing_policy, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(s.id, s.name, s.country, s.provider, s.official_url, s.levels, s.applicant_type, s.coverage, s.status, s.deadline_date, s.is_test_data, s.writing_policy, new Date().toISOString())
    .run();
  return s;
}

export async function seedRequirement(env: Env, id: string, scholarshipId: string, rule: unknown, review = "VERIFIED", mandatory = 1) {
  await env.DB.prepare("INSERT INTO requirements (id, scholarship_id, type, rule, text, excerpt, source_url, mandatory, review_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, scholarshipId, (rule as any).kind, JSON.stringify(rule), `Rule ${id}`, "test excerpt", "https://example.org/test-call", mandatory, review)
    .run();
}
