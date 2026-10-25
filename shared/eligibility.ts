// Deterministic eligibility engine. No LLM is involved; every outcome is traceable to a stored rule.
import type { EligibilityStatus, Requirement, Rule, Scholarship } from "./types";
import type { Profile } from "./profile";

export interface RuleResult {
  requirementId: string;
  text: string;
  status: EligibilityStatus;
  reason: string;
  ruleVerified: boolean;
  mandatory: boolean;
  sourceUrl: string | null;
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
      return p.hasExistingScholarship
        ? { status: "NOT_MET", reason: "This award cannot be combined with an existing scholarship, per the stored rule." }
        : { status: "MET", reason: "You do not hold a conflicting scholarship." };

    case "applicant_type": {
      if (!p.journey) return unknown("current study situation");
      const type = p.journey === "applying_from_pakistan" ? "new" : "continuing";
      return rule.allowed.includes(type)
        ? { status: "MET", reason: `Open to ${type} students.` }
        : { status: "NOT_MET", reason: `Only for ${rule.allowed.join("/")} students.` };
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
    let { status, reason } = checkRule(r.rule, p);
    if (r.review_status === "CONFLICTING") {
      status = "NEEDS_REVIEW";
      reason = "Official sources conflict on this rule. " + reason;
    }
    return { requirementId: r.id, text: r.text, status, reason, ruleVerified, mandatory: !!r.mandatory, sourceUrl: r.source_url };
  });

  const mandatory = results.filter((r) => r.mandatory);
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
  if (s.status === "VERIFIED_CLOSED" || s.status === "CANCELLED") deadline = { state: "passed", date: s.deadline_date };
  else if (s.deadline_date) deadline = { state: s.deadline_date < today ? "passed" : "open", date: s.deadline_date };

  return {
    scholarshipId: s.id,
    overall,
    summary,
    results,
    deadline,
    note: "Eligibility only means you can apply. Selection is competitive and decided by the provider.",
  };
}
