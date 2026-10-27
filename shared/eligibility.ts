// Deterministic eligibility engine. No LLM is involved; every outcome is traceable to a stored rule.
import type { EligibilityStatus, Requirement, Rule, RuleScope, Scholarship } from "./types";
import type { Profile } from "./profile";

export interface RuleResult {
  requirementId: string;
  text: string;
  status: EligibilityStatus;
  reason: string;
  ruleVerified: boolean;
  mandatory: boolean;
  sourceUrl: string | null;
  excerpt: string | null;
  scope: RuleScope;
  /** False when the rule is for another degree level than the student's goal. */
  applicable: boolean;
  nextAction: string;
}

const PROFILE_FIELD: Partial<Record<Rule["kind"], string>> = {
  nationality: "nationality",
  target_level: "intended degree",
  degree_completed: "highest qualification",
  min_grade: "grade and grading scale",
  max_age: "date of birth",
  language: "language test results",
  max_gap_years: "study gap",
  existing_scholarship: "current scholarship status",
  applicant_type: "current study situation",
  min_experience_years: "experience",
  field: "field of study",
};

/** One concrete next step per result, so every outcome is actionable. */
export function nextActionFor(rule: Rule, status: EligibilityStatus, ruleVerified: boolean): string {
  if (status === "UNKNOWN") return `Add your ${PROFILE_FIELD[rule.kind] ?? "details"} in your profile.`;
  if (status === "MET") return ruleVerified ? "Nothing to do for this rule." : "Confirm this rule on the official page; Raasta has not verified it yet.";
  if (status === "NEEDS_REVIEW") {
    if (rule.kind === "min_grade") return "Ask the university how your grading scale is assessed (equivalence), in writing.";
    if (rule.kind === "manual") return "Read this condition on the official page and check it against your documents.";
    return "Confirm with the provider or institution before relying on this.";
  }
  if (!ruleVerified) return "This rule is unverified; check the official page before ruling the award out.";
  if (rule.kind === "language") return "Book an accepted test, or check whether the provider accepts other proof.";
  if (rule.kind === "min_grade") return "Look for awards with a lower published minimum, or ask whether other evidence is considered.";
  return "Look for alternatives in your matches; this published rule excludes your current profile.";
}

export interface Assessment {
  scholarshipId: string;
  overall: EligibilityStatus;
  summary: string;
  results: RuleResult[];
  deadline: { state: "open" | "passed" | "unknown"; date: string | null };
  /** Eligibility is not selection: we never compute a chance of winning. */
  note: string;
}

const LEVEL_RANK = { intermediate: 0, bachelor: 1, master: 2, phd: 3 } as const;

function ageOn(birth: string, asOf: string): number {
  const b = new Date(birth + "T00:00:00Z");
  const a = new Date(asOf + "T00:00:00Z");
  let age = a.getUTCFullYear() - b.getUTCFullYear();
  const m = a.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && a.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

type Outcome = { status: EligibilityStatus; reason: string };
const unknown = (what: string): Outcome => ({ status: "UNKNOWN", reason: `We need your ${what} to check this.` });

export function checkRule(rule: Rule, p: Profile): Outcome {
  switch (rule.kind) {
    case "nationality":
      if (!p.nationality) return unknown("nationality");
      return rule.allowed.includes(p.nationality)
        ? { status: "MET", reason: `Open to ${p.nationality} nationals.` }
        : { status: "NOT_MET", reason: `Nationality ${p.nationality} is not in the eligible list.` };

    case "target_level":
      if (!p.targetLevel) return unknown("intended degree level");
      return rule.levels.includes(p.targetLevel)
        ? { status: "MET", reason: `Offered for ${p.targetLevel} study.` }
        : { status: "NOT_MET", reason: `Not offered for ${p.targetLevel} study.` };

    case "degree_completed": {
      if (!p.highestCompleted) return unknown("highest completed qualification");
      return LEVEL_RANK[p.highestCompleted] >= LEVEL_RANK[rule.level]
        ? { status: "MET", reason: `You have completed ${p.highestCompleted}.` }
        : { status: "NOT_MET", reason: `Requires a completed ${rule.level} qualification.` };
    }

    case "min_grade": {
      if (!p.grade) return unknown("grades (CGPA or percentage)");
      // Grading systems are not converted by arithmetic. Different scale → human review.
      if (p.grade.scale !== rule.scale)
        return {
          status: "NEEDS_REVIEW",
          reason: `Rule uses a ${rule.scale} scale and your grade uses ${p.grade.scale}. Equivalence must be confirmed by the institution.`,
        };
      const ok = rule.scale === "german" ? p.grade.value <= rule.min : p.grade.value >= rule.min;
      return ok
        ? { status: "MET", reason: `Your grade ${p.grade.value} meets the published minimum ${rule.min}.` }
        : { status: "NOT_MET", reason: `Published minimum is ${rule.min}; you entered ${p.grade.value}.` };
    }

    case "max_age": {
      if (!p.birthDate) return unknown("date of birth");
      const age = ageOn(p.birthDate, rule.asOf);
      return age <= rule.max
        ? { status: "MET", reason: `You will be ${age} on ${rule.asOf} (limit ${rule.max}).` }
        : { status: "NOT_MET", reason: `You will be ${age} on ${rule.asOf}; the limit is ${rule.max}.` };
    }

    case "language": {
      if (!p.languageTests || p.languageTests.length === 0) return unknown("language test results");
      const hit = rule.anyOf.find((r) =>
        p.languageTests!.some((t) => t.test.toUpperCase() === r.test.toUpperCase() && t.score >= r.min),
      );
      if (hit) return { status: "MET", reason: `${hit.test} score meets ${hit.min}.` };
      const sameTest = rule.anyOf.some((r) => p.languageTests!.some((t) => t.test.toUpperCase() === r.test.toUpperCase()));
      return sameTest
        ? { status: "NOT_MET", reason: `Your score is below: ${rule.anyOf.map((r) => `${r.test} ${r.min}`).join(" or ")}.` }
        : { status: "UNKNOWN", reason: `Accepted tests: ${rule.anyOf.map((r) => `${r.test} ${r.min}`).join(" or ")}. Add one of these, or check whether other proof is accepted.` };
    }

    case "max_gap_years":
      if (p.gapYears === undefined) return unknown("study-gap information");
      return p.gapYears <= rule.max
        ? { status: "MET", reason: `Your gap (${p.gapYears} yr) is within ${rule.max} yr.` }
        : { status: "NOT_MET", reason: `Published limit is ${rule.max} yr; you entered ${p.gapYears}.` };

    case "existing_scholarship":
      if (p.hasExistingScholarship === undefined) return unknown("current scholarship status");
      if (!rule.forbidden) return { status: "MET", reason: "Holding another award is not restricted by this rule." };
      // "Cannot be combined" means held at the same time; an award that ends before this one starts may not conflict.
      return p.hasExistingScholarship
        ? { status: "NEEDS_REVIEW", reason: "This award can't be held together with another scholarship. If your current award ends before this one starts, check with the provider whether you qualify." }
        : { status: "MET", reason: "You do not hold a conflicting scholarship." };

    case "applicant_type": {
      if (!p.journey) return unknown("current study situation");
      // Someone not yet enrolled anywhere abroad is always a new applicant. Someone already studying abroad may be
      // continuing at that university OR a new applicant to a different programme, so we can't decide for them.
      if (p.journey === "applying_from_pakistan")
        return rule.allowed.includes("new")
          ? { status: "MET", reason: "Open to new applicants." }
          : { status: "NOT_MET", reason: "Only for students already enrolled at the institution." };
      return rule.allowed.includes("new") && rule.allowed.includes("continuing")
        ? { status: "MET", reason: "Open to new and continuing students." }
        : {
            status: "NEEDS_REVIEW",
            reason: rule.allowed.includes("new")
              ? "Only for new applicants. If this is a new programme at a different university, you count as new."
              : "Only for students already enrolled there. Check whether you are enrolled at this institution.",
          };
    }

    case "min_experience_years":
      if (p.experienceYears === undefined) return unknown("work or research experience");
      return p.experienceYears >= rule.min
        ? { status: "MET", reason: `You have ${p.experienceYears} yr experience.` }
        : { status: "NOT_MET", reason: `Requires ${rule.min} yr; you entered ${p.experienceYears}.` };

    case "field": {
      const f = p.targetField ?? p.field;
      if (!f) return unknown("field of study");
      const ok = rule.anyOf.some((x) => f.toLowerCase().includes(x.toLowerCase()));
      // Free-text fields are fuzzy, so a miss is a review item, not a rejection.
      return ok
        ? { status: "MET", reason: `Your field matches: ${rule.anyOf.join(", ")}.` }
        : { status: "NEEDS_REVIEW", reason: `Eligible fields: ${rule.anyOf.join(", ")}. Check whether yours counts.` };
    }

    case "manual":
      return { status: "NEEDS_REVIEW", reason: "This condition needs a human check against the official text." };
  }
}

export function assess(s: Scholarship, reqs: Requirement[], p: Profile, today = new Date().toISOString().slice(0, 10)): Assessment {
  const results: RuleResult[] = reqs.map((r) => {
    const ruleVerified = r.review_status === "VERIFIED";
    // Level-specific rules ("Master's applicants need …") only apply to students aiming for that level.
    let applicable = true;
    let status: EligibilityStatus;
    let reason: string;
    const levels = r.rule?.forLevels;
    if (levels?.length && !p.targetLevel) ({ status, reason } = { status: "UNKNOWN", reason: `Applies to ${levels.join("/")} applicants. Add your intended degree to check.` });
    else if (levels?.length && !levels.includes(p.targetLevel!)) {
      applicable = false;
      ({ status, reason } = { status: "MET", reason: `Only applies to ${levels.join("/")} applicants.` });
    } else {
      try {
        ({ status, reason } = checkRule(r.rule, p));
      } catch {
        // Malformed rule data must never break a page; it becomes a review item.
        ({ status, reason } = { status: "NEEDS_REVIEW", reason: "This rule's stored data is incomplete; check the official page." });
      }
    }
    if (r.review_status === "CONFLICTING") {
      status = "NEEDS_REVIEW";
      reason = "Official sources conflict on this rule. " + reason;
    }
    return {
      requirementId: r.id,
      text: r.text,
      status,
      reason,
      ruleVerified,
      mandatory: !!r.mandatory,
      sourceUrl: r.source_url,
      excerpt: r.excerpt,
      scope: r.scope ?? "scholarship_eligibility",
      applicable,
      nextAction: applicable ? nextActionFor(r.rule ?? { kind: "manual" }, status, ruleVerified) : "Nothing to do for your degree level.",
    };
  });

  // Only applicable rules about applying for the award decide the eligibility verdict; admission, selection,
  // finance and visa rules are shown separately and never turn into a "chance".
  const mandatory = results.filter((r) => r.mandatory && r.applicable && r.scope === "scholarship_eligibility");
  let overall: EligibilityStatus;
  if (mandatory.some((r) => r.status === "NOT_MET" && r.ruleVerified)) overall = "NOT_MET";
  else if (mandatory.some((r) => r.status === "NOT_MET")) overall = "NEEDS_REVIEW";
  else if (mandatory.some((r) => r.status === "UNKNOWN")) overall = "UNKNOWN";
  else if (mandatory.some((r) => r.status === "NEEDS_REVIEW" || !r.ruleVerified)) overall = "NEEDS_REVIEW";
  else if (mandatory.length === 0) overall = "UNKNOWN";
  else overall = "MET";

  const counts = (st: EligibilityStatus) => mandatory.filter((r) => r.status === st).length;
  const summary =
    overall === "MET"
      ? "You meet every published mandatory rule we hold for this award."
      : `${counts("MET")} met, ${counts("NOT_MET")} not met, ${counts("UNKNOWN")} unknown, ${counts("NEEDS_REVIEW")} need review` +
        (mandatory.some((r) => !r.ruleVerified) ? " — some rules are not yet verified against the official source." : ".");

  let deadline: Assessment["deadline"] = { state: "unknown", date: s.deadline_date };
  const dl = s.deadline_date ?? s.proposed_deadline ?? null;
  if (s.status === "VERIFIED_CLOSED" || s.status === "CANCELLED" || s.cycle_state === "closed") deadline = { state: "passed", date: dl };
  else if (dl) deadline = { state: dl < today ? "passed" : "open", date: dl };

  return {
    scholarshipId: s.id,
    overall,
    summary,
    results,
    deadline,
    note: "Eligibility only means you can apply. Selection is competitive and decided by the provider.",
  };
}
