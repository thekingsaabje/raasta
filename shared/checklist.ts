// Generates a starting checklist for an application. Items that come from a stored, verified
// requirement carry its source; generic items are marked for confirmation on the official page.
import type { Requirement, Scholarship } from "./types";

export interface TaskDraft {
  key: string;
  title: string;
  instructions: string;
  reason: string;
  requirement_type: "mandatory" | "conditional" | "recommended";
  depends_on: string[];
  documents: string[];
  source_url: string | null;
  source_verified_at: string | null;
  due_date: string | null;
  due_confirmed: boolean;
  next_action: string;
}

const CONFIRM = "Confirm the exact requirement on the official page before relying on this.";

export function generateChecklist(s: Scholarship, reqs: Requirement[]): TaskDraft[] {
  const deadlineConfirmed = s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING";
  const t: TaskDraft[] = [
    {
      key: "read_call",
      title: `Read the official ${s.name} notice`,
      instructions: `Open the official page and read the full current call, including eligibility, documents and deadline.`,
      reason: "Every other step depends on the current official rules.",
      requirement_type: "mandatory",
      depends_on: [],
      documents: [],
      source_url: s.official_url,
      source_verified_at: s.last_verified_at,
      due_date: null,
      due_confirmed: false,
      next_action: "Open the official page",
    },
    {
      key: "passport",
      title: "Check passport validity",
      instructions: "Make sure your passport is valid for the period the provider and visa rules require. " + CONFIRM,
      reason: "Applications and visas usually need a valid passport.",
      requirement_type: "mandatory",
      depends_on: [],
      documents: ["Passport"],
      source_url: null,
      source_verified_at: null,
      due_date: null,
      due_confirmed: false,
      next_action: "Check the expiry date",
    },
    {
      key: "transcripts",
      title: "Collect degree and transcripts",
      instructions: "Gather your degree certificate and transcripts. Check whether attestation (e.g. HEC/IBCC) or certified translation is required. " + CONFIRM,
      reason: "Academic documents are needed to prove qualification.",
      requirement_type: "mandatory",
      depends_on: ["read_call"],
      documents: ["Degree certificate", "Transcripts"],
      source_url: null,
      source_verified_at: null,
      due_date: null,
      due_confirmed: false,
      next_action: "List which attestations the call asks for",
    },
    {
      key: "statement",
      title: "Prepare the required written statement",
      instructions: "Prepare the study plan, motivation letter or SOP the call asks for, within its word limit. Use the Writing Studio.",
      reason: "Most calls ask for a personal statement.",
      requirement_type: "conditional",
      depends_on: ["read_call"],
      documents: ["Statement"],
      source_url: null,
      source_verified_at: null,
      due_date: null,
      due_confirmed: false,
      next_action: "Open Writing Studio",
    },
    {
      key: "references",
      title: "Request recommendation letters",
      instructions: "Ask referees early. Check how many letters are needed and in what format. " + CONFIRM,
      reason: "Referees need time.",
      requirement_type: "conditional",
      depends_on: ["read_call"],
      documents: ["Recommendation letters"],
      source_url: null,
      source_verified_at: null,
      due_date: null,
      due_confirmed: false,
      next_action: "Pick two referees",
    },
  ];

  for (const r of reqs) {
    if (r.rule.kind !== "language") continue;
    t.push({
      key: `req_${r.id}`,
      title: "Get the required language test result",
      instructions: r.text,
      reason: "Listed as a requirement for this award.",
      requirement_type: r.mandatory ? "mandatory" : "conditional",
      depends_on: [],
      documents: ["Language certificate"],
      source_url: r.source_url,
      source_verified_at: r.verified_at,
      due_date: null,
      due_confirmed: false,
      next_action: "Book a test date",
    });
  }

  t.push({
    key: "submit",
    title: `Submit through the official route${s.application_route ? `: ${s.application_route}` : ""}`,
    instructions: "You submit through the official system yourself and complete every declaration. Keep the confirmation.",
    reason: "Only the official route counts.",
    requirement_type: "mandatory",
    depends_on: t.filter((x) => x.requirement_type === "mandatory").map((x) => x.key),
    documents: [],
    source_url: s.official_url,
    source_verified_at: s.last_verified_at,
    due_date: s.deadline_date,
    due_confirmed: deadlineConfirmed && !!s.deadline_date,
    next_action: "Upload confirmation once submitted",
  });

  return t;
}
