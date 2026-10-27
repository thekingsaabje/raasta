// Study-route evaluation: deterministic, built on the eligibility engine. No probabilities, no LLM.
import { assess, type RuleResult } from "./eligibility";
import type { Profile } from "./profile";
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
}

export interface RouteSummary {
  country: Country;
  counts: Record<Fit, number>;
  barriers: string[];
}

export interface RouteResult {
  items: FitItem[];
  routes: RouteSummary[];
  nextActions: { title: string; why: string; to?: string }[];
  missingProfile: string[];
  note: string;
}

const COUNTRIES: Country[] = ["CN", "DE", "IT"];
const MANUAL_REASON = "This condition needs a human check against the official text.";
const FITS: Fit[] = ["VERIFIED_FIT", "POTENTIAL_FIT", "NEEDS_CONFIRMATION", "LIKELY_INELIGIBLE", "NOT_ELIGIBLE", "CLOSED"];

export function classify(s: Scholarship, reqs: Requirement[], p: Profile, today: string): FitItem {
  const a = assess(s, reqs, p, today);
  const decisive = a.results.filter((r) => r.mandatory && r.applicable && r.scope === "scholarship_eligibility");
  const notMet = decisive.filter((r) => r.status === "NOT_MET");
  const confirmedByReviewer = s.verification_method === "human" && s.status.startsWith("VERIFIED_");
  const closed = s.status === "VERIFIED_CLOSED" || s.status === "CANCELLED" || (!confirmedByReviewer && s.cycle_state === "closed");
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
    cycleState: s.cycle_state ?? "unknown",
    statusReason: s.status_reason ?? null,
    deadline: { date: dl, confirmed: confirmedByReviewer && !!s.deadline_date },
    fundingClass: s.funding_class ?? "unknown",
    met: a.results.filter((r) => r.applicable && r.status === "MET"),
    notMet: a.results.filter((r) => r.applicable && r.status === "NOT_MET"),
    missing: a.results.filter((r) => r.applicable && r.status === "UNKNOWN"),
    review: a.results.filter((r) => r.applicable && r.status === "NEEDS_REVIEW"),
  };
}

/** Profile questions that would sharpen the evaluation, in plain English. */
export function missingProfile(p: Profile): string[] {
  const out: string[] = [];
  if (!p.nationality) out.push("nationality");
  if (!p.targetLevel) out.push("the degree you want");
  if (!p.highestCompleted) out.push("your highest completed qualification");
  if (!p.grade) out.push("your grades (CGPA or percentage)");
  if (!p.languageTests?.length) out.push("language test results (or that you have none yet)");
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
    .sort((a, b) => FITS.indexOf(a.fit) - FITS.indexOf(b.fit) || a.name.localeCompare(b.name));

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
  const nextActions: RouteResult["nextActions"] = [];
  if (missing.length) nextActions.push({ title: "Fill in what's missing", why: `We couldn't check some rules without ${missing.slice(0, 3).join(", ")}.` });
  if (!p.languageTests?.length) nextActions.push({ title: "Plan a language test", why: "Most awards ask for IELTS/TOEFL (or HSK for Chinese-taught programmes). Check which one your programme accepts." });
  if (p.journey === "applying_from_pakistan" || !p.journey)
    nextActions.push({ title: "Start document attestation early", why: "HEC degree attestation and IBCC equivalence take time; most calls ask for attested copies." });
  if (items.some((i) => i.fit === "POTENTIAL_FIT" || i.fit === "VERIFIED_FIT"))
    nextActions.push({ title: "Check the official page of each potential fit", why: "Records not yet confirmed by a reviewer are leads: confirm the deadline and rules yourself before applying." });
  if (p.needsRenewal) nextActions.push({ title: "Track your renewal as an application", why: "Add your annual review deadline and documents so they appear on your dashboard." });
  nextActions.push({ title: "Plan the real cost", why: "See costs with and without a scholarship and the cash you need before arrival.", to: "/costs" });

  return {
    items,
    routes,
    nextActions,
    missingProfile: missing,
    note: "This shows which published rules you meet. It is not a chance of admission, a scholarship or a visa.",
  };
}
