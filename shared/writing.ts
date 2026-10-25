// Writing Studio rules. Assistance level follows the provider's policy; facts come only from the student.
import type { WritingMode } from "./types";
import type { Profile } from "./profile";

export const DOC_KINDS = {
  sop: "Statement of purpose",
  motivation: "Motivation letter",
  study_plan: "Study plan",
  research_proposal: "Research proposal",
  cv: "Academic CV",
  essay: "Scholarship essay",
  recommendation_request: "Recommendation-letter request",
  enquiry: "University enquiry",
  interview: "Interview preparation",
} as const;
export type DocKind = keyof typeof DOC_KINDS;

export interface Capabilities {
  outline: boolean;
  draft: boolean;
  edit: boolean;
  coach: boolean;
  warning: string | null;
}

export function capabilities(mode: WritingMode): Capabilities {
  switch (mode) {
    case "DRAFTING_ALLOWED":
      return { outline: true, draft: true, edit: true, coach: true, warning: null };
    case "EDITING_ONLY":
      return { outline: false, draft: false, edit: true, coach: true, warning: "This provider permits editing help only. Raasta will not draft text for you." };
    case "COACHING_ONLY":
      return { outline: false, draft: false, edit: false, coach: true, warning: "This provider permits coaching only. You write every word; Raasta asks questions and checks requirements." };
    case "POLICY_UNCONFIRMED":
      return {
        outline: false,
        draft: false,
        edit: false,
        coach: true,
        warning: "We have not confirmed this provider's rules on AI or outside help, so Raasta limits itself to coaching until it is confirmed.",
      };
  }
}

export interface Fact {
  id: string;
  category: string;
  text: string;
}

export interface CheckInput {
  content: string;
  wordLimit: number | null;
  requiredSections: string[];
  profile: Profile;
  facts: Fact[];
  institution: string | null;
  knownInstitutions?: string[];
}

export interface Issue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export const wordCount = (s: string) => (s.trim().match(/\S+/g) ?? []).length;

export function checkDocument(i: CheckInput): Issue[] {
  const issues: Issue[] = [];
  const text = i.content;
  const lower = text.toLowerCase();
  const words = wordCount(text);

  if (i.wordLimit && words > i.wordLimit)
    issues.push({ severity: "error", code: "over_limit", message: `${words} words; the limit is ${i.wordLimit}.` });

  for (const s of i.requiredSections)
    if (!lower.includes(s.toLowerCase()))
      issues.push({ severity: "error", code: "missing_section", message: `Required section not found: "${s}".` });

  // Grades mentioned in the text must match the profile.
  const gpa = text.match(/\b(?:c?gpa)\s*(?:of\s*)?(\d(?:\.\d{1,2})?)/i);
  if (gpa && i.profile.grade && i.profile.grade.scale !== "100") {
    const v = Number(gpa[1]);
    if (Math.abs(v - i.profile.grade.value) > 0.005)
      issues.push({ severity: "error", code: "grade_mismatch", message: `Text says GPA ${v}, your profile says ${i.profile.grade.value}.` });
  }
  const pct = text.match(/\b(\d{2}(?:\.\d)?)\s*%/);
  if (pct && i.profile.grade?.scale === "100" && Math.abs(Number(pct[1]) - i.profile.grade.value) > 0.05)
    issues.push({ severity: "warning", code: "grade_mismatch", message: `Text mentions ${pct[1]}%, your profile says ${i.profile.grade.value}%. Check it.` });

  // Mentions of another institution in a document meant for this one.
  if (i.institution && i.knownInstitutions)
    for (const other of i.knownInstitutions)
      if (other !== i.institution && lower.includes(other.toLowerCase()) && !i.facts.some((f) => f.text.toLowerCase().includes(other.toLowerCase())))
        issues.push({ severity: "error", code: "wrong_institution", message: `Mentions "${other}", but this document is for ${i.institution}.` });

  if (i.institution && words > 80 && !lower.includes(i.institution.toLowerCase()))
    issues.push({ severity: "warning", code: "institution_absent", message: `The text never names ${i.institution}.` });

  if (/\[(?:todo|add|insert)[^\]]*\]/i.test(text))
    issues.push({ severity: "error", code: "placeholder", message: "Text still contains placeholders like [add ...]." });

  if (i.facts.length === 0)
    issues.push({ severity: "warning", code: "no_facts", message: "Your fact bank is empty. Add real experiences before writing." });

  return issues;
}

/** Coaching questions are always allowed; they help the student write in their own words. */
export function coachingQuestions(kind: DocKind): string[] {
  const common = [
    "What specific moment made you choose this field?",
    "Which course, project or result best shows your ability? What exactly did you do?",
    "What do you want to do in the 5 years after this degree, and why does this programme help?",
  ];
  const extra: Partial<Record<DocKind, string[]>> = {
    study_plan: ["Which modules or research groups at this university match your plan?", "What will you study each year?"],
    research_proposal: ["What is your research question in one sentence?", "What method will you use and what data do you need?"],
    motivation: ["Why this country and this university, specifically?"],
    cv: ["List every degree, date, grade and award exactly as on your documents."],
  };
  return [...(extra[kind] ?? []), ...common];
}

/** Outline built only from the student's own facts. Only offered when drafting is allowed. */
export function outlineFromFacts(kind: DocKind, facts: Fact[], institution: string | null): string {
  const pick = (cat: string) => facts.filter((f) => f.category === cat).map((f) => `- ${f.text}`);
  const section = (title: string, cat: string) => {
    const items = pick(cat);
    return `## ${title}\n${items.length ? items.join("\n") : `[add your ${cat} facts first]`}`;
  };
  return [
    `# ${DOC_KINDS[kind]}${institution ? ` — ${institution}` : ""}`,
    section("Academic background", "academic"),
    section("Projects and research", "project"),
    section("Experience", "experience"),
    section("Motivation", "motivation"),
    section("Future goals", "goal"),
  ].join("\n\n");
}
