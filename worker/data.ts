import type { Requirement, Scholarship } from "../shared/types";
import type { Profile } from "../shared/profile";
import { parseJsonCols } from "./util";

export const SCH_JSON = ["levels", "coverage"];
export const TASK_JSON = ["depends_on", "documents"];

export async function getScholarship(db: D1Database, id: string): Promise<Scholarship | null> {
  const row = await db.prepare("SELECT * FROM scholarships WHERE id = ?").bind(id).first<Record<string, unknown>>();
  return row ? (parseJsonCols(row, SCH_JSON) as unknown as Scholarship) : null;
}

export async function listRequirements(db: D1Database, scholarshipId?: string): Promise<Requirement[]> {
  const stmt = scholarshipId
    ? db.prepare("SELECT * FROM requirements WHERE scholarship_id = ? ORDER BY id").bind(scholarshipId)
    : db.prepare("SELECT * FROM requirements ORDER BY scholarship_id, id");
  const { results } = await stmt.all<Record<string, unknown>>();
  return results.map((r) => parseJsonCols(r, ["rule"]) as unknown as Requirement);
}

export async function getProfile(db: D1Database, userId: string): Promise<Profile> {
  const row = await db.prepare("SELECT data FROM profiles WHERE user_id = ?").bind(userId).first<{ data: string }>();
  return row ? (JSON.parse(row.data) as Profile) : {};
}

export async function listTasks(db: D1Database, userId: string, applicationId?: string) {
  const stmt = applicationId
    ? db.prepare("SELECT * FROM tasks WHERE user_id = ? AND application_id = ? ORDER BY sort, created_at").bind(userId, applicationId)
    : db.prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY sort, created_at").bind(userId);
  const { results } = await stmt.all<Record<string, unknown>>();
  return results.map((r) => parseJsonCols(r, TASK_JSON)) as any[];
}

export async function notify(db: D1Database, userId: string, kind: string, dedupeKey: string, title: string, body: string) {
  const prefs = await db.prepare("SELECT * FROM notification_prefs WHERE user_id = ?").bind(userId).first<Record<string, number>>();
  const map: Record<string, string> = { deadline: "deadlines", document: "documents", opportunity: "opportunities", renewal: "renewals", change: "deadlines" };
  if (prefs) {
    if (prefs.paused) return false;
    const col = map[kind];
    if (col && prefs[col] === 0) return false;
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const n = await db.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND created_at > ?").bind(userId, weekAgo).first<{ n: number }>();
    // Corrections to published errors are always delivered; other alerts respect the weekly limit.
    if (kind !== "change" && n && n.n >= prefs.max_per_week) return false;
  }
  const r = await db
    .prepare("INSERT OR IGNORE INTO notifications (id, user_id, kind, dedupe_key, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), userId, kind, dedupeKey, title, body, new Date().toISOString())
    .run();
  return (r.meta.changes ?? 0) > 0;
}
