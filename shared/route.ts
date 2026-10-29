// Study-route evaluation: deterministic, built on the eligibility engine. No probabilities, no LLM.
import { assess, type RuleResult } from "./eligibility";
import type { Profile } from "./profile";
import { effectiveCycle } from "./cycle";
import type { Country, Level, Requirement, Scholarship } from "./types";

/**
 * VERIFIED_FIT       reviewer-confirmed open/upcoming record AND every applicable mandatory rule met and verified.
 * POTENTIAL_FIT      nothing failed and nothing missing, but the record or its rules are not reviewer-confirmed.
 * NEEDS_CONFIRMATION missing information or a rule that needs a human decision (e.g. grade equivalence).
 * LIKELY_INELIGIBLE  the official text appears to exclude the student, but the rule is not reviewer-verified yet.
 * NOT_ELIGIBLE       a reviewer-verified rule excludes the student.
 * CLOSED             the round is closed (confirmed or per the official page): watch for the next call.
 */
export type Fit = "VERIFIED_FIT" | "POTENTIAL_FIT" | "NEEDS_CONFIRMATION" | "LIKELY_INELIGIBLE" | "NOT_ELIGIBLE" | "CLOSED";

export interface FitItem {
  id: string;
  name: string;
  country: Country;
  provider: string;
  officialUrl: string;
  fit: Fit;
  confirmedByReviewer: boolean;
  status: string;
  cycleState: string;
  statusReason: string | null;
  deadline: { date: string | null; confirmed: boolean };
  fundingClass: string;
  met: RuleResult[];
  notMet: RuleResult[];
  missing: RuleResult[];
  review: RuleResult[];
  /** Plain-English timing caveat, e.g. "apply after you're admitted". */
  timing: string | null;
  sourceCheckedAt: string | null;
  sourceCheck: string | null;
}

export interface RouteSummary {
  country: Country;
  counts: Record<Fit, number>;
  barriers: string[];
}

/** A guidance step. `to` is a Raasta page, `href` an official site. Procedures only: no fees or amounts here. */
export interface NextAction { title: string; why: string; to?: string; href?: string }

export interface RouteResult {
  items: FitItem[];
  routes: RouteSummary[];
  nextActions: NextAction[];
  missingProfile: string[];
  note: string;
}

const COUNTRIES: Country[] = ["CN", "DE", "IT", "KR"];
const MANUAL_REASON = "This condition needs a human check against the official text.";
// Awards you apply for once a German/Italian university has admitted or enrolled you (stated on their official pages).
const AFTER_ADMISSION = new Set(["de-deutschlandstipendium", "de-fes"]);
const ABROAD = new Set(["studying_in_china", "studying_in_germany_italy", "holds_scholarship"]);

// Students who need full funding see full awards first; everyone else sees the soonest deadline first.
const fundRank = (i: FitItem, p: Profile) => (p.fundingNeed === "full_only" ? (i.fundingClass === "full" ? 0 : i.fundingClass === "unknown" ? 1 : 2) : 0);
const soonest = (i: FitItem) => (i.deadline.date ? Date.parse(i.deadline.date) : Number.MAX_SAFE_INTEGER);

function timingOf(s: Scholarship, p: Profile): string | null {
  const abroad = !!p.journey && ABROAD.has(p.journey);
  if (abroad && s.applicant_type === "new") return "Meant for new applicants. Relevant only if you apply for your next degree.";
  if (!abroad && (s.applicant_type === "continuing" || AFTER_ADMISSION.has(s.id)))
    return "You apply after a university there has admitted or enrolled you, not from Pakistan beforehand.";
  return null;
}

const FITS: Fit[] = ["VERIFIED_FIT", "POTENTIAL_FIT", "NEEDS_CONFIRMATION", "LIKELY_INELIGIBLE", "NOT_ELIGIBLE", "CLOSED"];

export function classify(s: Scholarship, reqs: Requirement[], p: Profile, today: string): FitItem {
  const a = assess(s, reqs, p, today);
  const decisive = a.results.filter((r) => r.mandatory && r.applicable && r.scope === "scholarship_eligibility");
  const notMet = decisive.filter((r) => r.status === "NOT_MET");
  const confirmedByReviewer = s.verification_method === "human" && s.status.startsWith("VERIFIED_");
  const cycle = effectiveCycle(s.cycle_state ?? "unknown", s.proposed_deadline, today); // passed official deadline → closed
  const closed = s.status === "VERIFIED_CLOSED" || s.status === "CANCELLED" || (!confirmedByReviewer && cycle === "closed");
  // "Read it yourself" conditions we could not turn into a check don't block a potential fit; they are listed for the
  // student. Substantive review items (grade equivalence, conflicting sources, applicant type…) do.
  const isManual = (r: RuleResult) => r.reason === MANUAL_REASON;
  let fit: Fit;
  if (closed) fit = "CLOSED";
  else if (notMet.some((r) => r.ruleVerified)) fit = "NOT_ELIGIBLE";
  else if (notMet.length) fit = "LIKELY_INELIGIBLE"; // never shown as a potential fit
  else if (decisive.some((r) => r.status === "UNKNOWN" || (r.status === "NEEDS_REVIEW" && !isManual(r)))) fit = "NEEDS_CONFIRMATION";
  else if (
    confirmedByReviewer && (s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING") &&
    decisive.length > 0 && decisive.every((r) => r.status === "MET" && r.ruleVerified)
  )
    fit = "VERIFIED_FIT";
  else fit = "POTENTIAL_FIT";
  const dl = s.deadline_date ?? s.proposed_deadline ?? null;
  return {
    id: s.id,
    name: s.name,
    country: s.country,
    provider: s.provider,
    officialUrl: s.official_url,
    fit,
    confirmedByReviewer,
    status: s.status,
    cycleState: cycle,
    statusReason: s.status_reason ?? null,
    deadline: { date: dl, confirmed: confirmedByReviewer && !!s.deadline_date },
    fundingClass: s.funding_class ?? "unknown",
    met: a.results.filter((r) => r.applicable && r.status === "MET"),
    notMet: a.results.filter((r) => r.applicable && r.status === "NOT_MET"),
    missing: a.results.filter((r) => r.applicable && r.status === "UNKNOWN"),
    review: a.results.filter((r) => r.applicable && r.status === "NEEDS_REVIEW"),
    timing: timingOf(s, p),
    sourceCheckedAt: s.source_checked_at ?? null,
    sourceCheck: s.source_check ?? null,
  };
}

/** Profile questions that would sharpen the evaluation, in plain English. */
export function missingProfile(p: Profile): string[] {
  const out: string[] = [];
  if (!p.nationality) out.push("nationality");
  if (!p.targetLevel) out.push("the degree you want");
  if (!p.highestCompleted) out.push("your highest completed qualification");
  if (!p.grade) out.push("your grades (CGPA or percentage)");
  if (!p.languageTests?.length && !p.languageStatus) out.push("language test results (or that you have none yet)");
  if (p.gapYears === undefined) out.push("your study gap");
  if (p.budgetPkr === undefined) out.push("your budget");
  return out;
}

export function evaluateRoute(p: Profile, scholarships: Scholarship[], reqs: Requirement[], today: string): RouteResult {
  const targets = p.targetCountries?.length ? p.targetCountries : p.currentCountry ? [p.currentCountry] : COUNTRIES;
  const byId = new Map<string, Requirement[]>();
  for (const r of reqs) byId.set(r.scholarship_id, [...(byId.get(r.scholarship_id) ?? []), r]);
  const level = p.targetLevel as Level | undefined;

  const items = scholarships
    .filter((s) => !s.is_test_data) // test records never appear in recommendations
    .filter((s) => targets.includes(s.country))
    .filter((s) => !level || !s.levels?.length || s.levels.includes(level))
    .map((s) => classify(s, byId.get(s.id) ?? [], p, today))
    .sort((a, b) => FITS.indexOf(a.fit) - FITS.indexOf(b.fit) || Number(!!a.timing) - Number(!!b.timing) || fundRank(a, p) - fundRank(b, p) || soonest(a) - soonest(b) || a.name.localeCompare(b.name));

  const routes: RouteSummary[] = targets.map((country) => {
    const mine = items.filter((i) => i.country === country);
    const counts = Object.fromEntries(FITS.map((f) => [f, mine.filter((i) => i.fit === f).length])) as Record<Fit, number>;
    const barriers = new Set<string>();
    for (const i of mine) {
      for (const r of i.notMet) barriers.add(`${i.name}: ${r.reason}`);
      for (const r of i.missing) if (/language/i.test(r.reason)) barriers.add("No accepted language test result on your profile yet.");
    }
    return { country, counts, barriers: [...barriers].slice(0, 6) };
  });

  const missing = missingProfile(p);
  const nextActions = guidance(p, targets, items, missing);
  return {
    items,
    routes,
    nextActions,
    missingProfile: missing,
    note: "This shows which published rules you meet. It is not a chance of admission, a scholarship or a visa.",
  };
}

/**
 * Next steps for this student's situation and countries. Procedural only, each pointing at the official body;
 * fees, amounts and dates are deliberately left to the official pages.
 */
export function guidance(p: Profile, targets: Country[], items: FitItem[], missing: string[]): NextAction[] {
  const out: NextAction[] = [];
  const abroad = !!p.journey && ABROAD.has(p.journey);
  if (missing.length) out.push({ title: "Fill in what's missing", why: `We couldn't check some rules without ${missing.slice(0, 3).join(", ")}.` });
  if (items.some((i) => i.fit === "POTENTIAL_FIT" || i.fit === "VERIFIED_FIT"))
    out.push({ title: "Open the official page of each potential fit", why: "Records not yet confirmed by a reviewer are leads. Confirm the deadline and rules yourself before you apply." });

  if (abroad) {
    out.push({ title: "Ask your university's international office", why: "Awards for current students (university, city and province) are often announced to enrolled students first. Ask which ones you can apply for this year and when." });
    if (p.hasExistingScholarship || p.needsRenewal)
      out.push({ title: "Track your annual review like an application", why: "Renewals usually depend on grades, attendance and a yearly form. Add the review date and documents so they show on your dashboard." });
  } else {
    if (p.languageStatus === "moi")
      out.push({ title: "Ask each university about your English-medium (MOI) letter", why: "Some universities accept a letter from your university saying you were taught in English instead of IELTS; many scholarships still want a test score. Ask in writing before you apply." });
    if (!p.languageTests?.length)
      out.push({ title: "Book a language test", why: "Most awards ask for IELTS, TOEFL or similar, or HSK/TOPIK for courses taught in Chinese or Korean. Check which test your programme accepts before you book." });
    if (p.highestCompleted === "intermediate")
      out.push({ title: "Get your intermediate certificate equivalence (IBCC)", why: "For a bachelor's abroad, your FSc/FA/A-level documents are normally checked by IBCC. Start early: it takes time.", href: "https://ibcc.edu.pk" });
    else
      out.push({ title: "Get your degree attested by HEC", why: "Most calls ask for HEC-attested degree and transcript copies. Start early: it takes time.", href: "https://www.hec.gov.pk" });
  }

  for (const c of targets) {
    if (abroad && c === (p.currentCountry ?? (p.journey === "studying_in_china" ? "CN" : undefined))) continue;
    if (c === "CN") out.push({ title: "China: CSC applications go through the Campus China portal", why: "Chinese Government Scholarships are applied for online, either through HEC nomination (Type A) or directly with a university (Type B). Each university sets its own deadline.", href: "https://www.campuschina.org" });
    if (c === "DE") out.push({ title: "Germany: check admission rules and the visa money proof early", why: "Many master's programmes use uni-assist or their own portal, and the student visa needs proof that you can pay your living costs. Read the German Missions in Pakistan page.", href: "https://pakistan.diplo.de" });
    if (c === "IT") out.push({ title: "Italy: pre-enrol on Universitaly", why: "Non-EU students pre-enrol on Universitaly before the study visa. Universities may also ask for a CIMEA statement or Declaration of Value for your degree.", href: "https://www.universitaly.it" });
    if (c === "KR") out.push({ title: "Korea: Global Korea Scholarship (GKS)", why: "GKS is run by NIIED with an embassy track and a university track. Read the current year's guidelines on Study in Korea before choosing a track.", href: "https://www.studyinkorea.go.kr" });
  }
  out.push({ title: "Plan the real cost", why: "See costs with and without a scholarship and the cash you need before arrival.", to: "/costs" });
  return out;
}
