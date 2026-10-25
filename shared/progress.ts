// Checklist progress. Progress is task completion only; it is never a probability of success.
import type { StudentStatus, VerifiedStatus } from "./types";

export interface TaskLike {
  id: string;
  title: string;
  application_id: string | null;
  requirement_type: "mandatory" | "conditional" | "recommended";
  applicable: number | boolean;
  due_date: string | null;
  due_confirmed: number | boolean;
  depends_on: string[];
  student_status: StudentStatus;
  verified_status: VerifiedStatus;
}

const STUDENT_DONE: StudentStatus[] = ["COMPLETED_BY_STUDENT", "SUBMITTED"];
export const isStudentDone = (t: TaskLike) => STUDENT_DONE.includes(t.student_status) || t.verified_status === "VERIFIED" || t.verified_status === "RECEIVED";
export const isVerified = (t: TaskLike) => t.verified_status === "VERIFIED" || t.verified_status === "RECEIVED";

export function blockedBy(t: TaskLike, all: TaskLike[]): string[] {
  const byId = new Map(all.map((x) => [x.id, x]));
  return t.depends_on.filter((id) => {
    const dep = byId.get(id);
    return dep !== undefined && !!dep.applicable && !isStudentDone(dep);
  });
}

export interface Progress {
  total: number;
  done: number;
  verified: number;
  percent: number;
  mandatoryTotal: number;
  mandatoryRemaining: number;
  blocked: number;
}

export function progress(tasks: TaskLike[]): Progress {
  // Recommended tasks are optional, so they do not count against progress.
  const counted = tasks.filter((t) => !!t.applicable && t.requirement_type !== "recommended");
  const done = counted.filter(isStudentDone).length;
  const mandatory = counted.filter((t) => t.requirement_type === "mandatory");
  return {
    total: counted.length,
    done,
    verified: counted.filter(isVerified).length,
    percent: counted.length ? Math.round((done / counted.length) * 100) : 0,
    mandatoryTotal: mandatory.length,
    mandatoryRemaining: mandatory.filter((t) => !isStudentDone(t)).length,
    blocked: counted.filter((t) => !isStudentDone(t) && blockedBy(t, tasks).length > 0).length,
  };
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86_400_000);
}

const TYPE_RANK = { mandatory: 0, conditional: 1, recommended: 2 } as const;

/** Top next actions: open, unblocked, mandatory first, then confirmed earliest deadline. */
export function nextActions(tasks: TaskLike[], n = 3): TaskLike[] {
  return tasks
    .filter((t) => !!t.applicable && !isStudentDone(t) && blockedBy(t, tasks).length === 0 && t.student_status !== "BLOCKED")
    .sort((a, b) => {
      const r = TYPE_RANK[a.requirement_type] - TYPE_RANK[b.requirement_type];
      if (r) return r;
      const ad = a.due_confirmed && a.due_date ? a.due_date : "9999";
      const bd = b.due_confirmed && b.due_date ? b.due_date : "9999";
      return ad < bd ? -1 : ad > bd ? 1 : 0;
    })
    .slice(0, n);
}
