export type Country = "CN" | "DE" | "IT";
export type Level = "bachelor" | "master" | "phd";

export const OPPORTUNITY_STATUSES = [
  "VERIFIED_OPEN",
  "VERIFIED_UPCOMING",
  "VERIFIED_CLOSED",
  "CANCELLED",
  "NEEDS_REVIEW",
  "CONFLICTING_SOURCES",
  "UNKNOWN",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export type EligibilityStatus = "MET" | "NOT_MET" | "UNKNOWN" | "NEEDS_REVIEW";

export const WRITING_MODES = ["DRAFTING_ALLOWED", "EDITING_ONLY", "COACHING_ONLY", "POLICY_UNCONFIRMED"] as const;
export type WritingMode = (typeof WRITING_MODES)[number];

export const STUDENT_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED_BY_STUDENT",
  "SUBMITTED",
  "BLOCKED",
  "NEEDS_REVIEW",
] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const VERIFIED_STATUSES = ["NONE", "RECEIVED", "VERIFIED", "NEEDS_REVIEW"] as const;
export type VerifiedStatus = (typeof VERIFIED_STATUSES)[number];

export const APPLICATION_STAGES = [
  "planning",
  "prepared",
  "reviewed",
  "submitted",
  "received",
  "under_evaluation",
  "admitted",
  "rejected",
] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export interface Scholarship {
  id: string;
  name: string;
  country: Country;
  provider: string;
  source_id: string | null;
  official_url: string;
  levels: Level[];
  applicant_type: "new" | "continuing" | "both";
  funding_summary: string | null;
  coverage: Coverage;
  application_route: string | null;
  deadline_date: string | null;
  deadline_text: string | null;
  academic_year: string | null;
  status: OpportunityStatus;
  writing_policy: WritingMode;
  is_test_data: number;
  retrieved_at: string | null;
  last_verified_at: string | null;
  evidence_note: string | null;
  version: number;
  updated_at: string;
  verification_method?: "agent_evidence" | "human" | null;
  funding_class?: FundingClass;
  monitor_url?: string | null;
}

/** What a scholarship actually pays. Unknown parts stay undefined, never assumed. */
export interface Coverage {
  tuition?: "full" | "partial" | "none";
  tuitionAmount?: { amount: number; currency: string; period: "year" | "once" };
  stipend?: { amount: number; currency: string; period: "month" | "year" };
  accommodation?: "full" | "partial" | "none";
  insurance?: "full" | "none";
  travel?: "full" | "partial" | "none";
  paymentStarts?: string;
}

export interface Requirement {
  id: string;
  scholarship_id: string;
  type: string;
  rule: Rule;
  text: string;
  excerpt: string | null;
  original_excerpt: string | null;
  source_url: string | null;
  applies_to: string | null;
  mandatory: number;
  review_status: "VERIFIED" | "NEEDS_REVIEW" | "CONFLICTING";
  retrieved_at: string | null;
  verified_at: string | null;
  version: number;
  scope?: RuleScope;
}

/** What a rule decides. Eligibility to apply is not admission, selection, finances or a visa. */
export const RULE_SCOPES = ["scholarship_eligibility", "admission", "selection", "financial", "visa"] as const;
export type RuleScope = (typeof RULE_SCOPES)[number];

export const FUNDING_CLASSES = ["full", "partial", "tuition_only", "stipend_only", "unknown"] as const;
export type FundingClass = (typeof FUNDING_CLASSES)[number];

export type Rule =
  | { kind: "nationality"; allowed: string[] }
  | { kind: "target_level"; levels: Level[] }
  | { kind: "degree_completed"; level: "intermediate" | Level }
  | { kind: "min_grade"; scale: "4" | "5" | "100" | "german"; min: number }
  | { kind: "max_age"; max: number; asOf: string }
  | { kind: "language"; anyOf: { test: string; min: number }[] }
  | { kind: "max_gap_years"; max: number }
  | { kind: "existing_scholarship"; forbidden: boolean }
  | { kind: "applicant_type"; allowed: ("new" | "continuing")[] }
  | { kind: "min_experience_years"; min: number }
  | { kind: "field"; anyOf: string[] }
  | { kind: "manual" };
