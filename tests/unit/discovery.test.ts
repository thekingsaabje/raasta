import { describe, expect, it } from "vitest";
import {
  classifyHost, evaluateDiscovery, extractPage, findConflicts, findDates, findTime, isVerbatim, moiRequestEmail, pageText, parseAmount,
  toPakistanTime, unverifiableQuotes,
} from "../../shared/discovery";
import type { Profile } from "../../shared/profile";

// Fixtures written for tests only; the product never shows static results as live.
const SCHOLARSHIP_PAGE = `<html><head><title>International Excellence Scholarships 2027/28</title></head><body>
<nav>Home | News</nav>
<main>
<h1>International Excellence Scholarships 2027/28</h1>
<p>The University offers scholarships for international students enrolling in Master's degree programmes taught in English.</p>
<p>Applicants from all countries, including Pakistan, are eligible.</p>
<p>The scholarship amount is € 8,000 per year, paid in instalments.</p>
<p>Tuition fee: € 2.500,00 per year. A non-refundable application fee of € 30 must be paid online.</p>
<p>The application deadline is 15 January 2027 at 13:00 CET.</p>
<h2>English requirements</h2>
<p>Applicants must prove English at B2 level with IELTS 6.0, TOEFL iBT 80 or Duolingo 105.</p>
<p>Applicants whose previous degree was taught entirely in English may be exempted upon request, subject to approval of the admissions office.</p>
<h2>Documents</h2>
<ul><li>Copy of passport</li><li>Transcript of records (certified copy, PDF)</li><li>Degree certificate</li><li>CV in Europass format</li><li>Motivation letter</li><li>Two recommendation letters</li></ul>
<p>All documents must be uploaded to the online application portal.</p>
</main><footer>© University</footer></body></html>`;

const PROGRAMME_PAGE_MOI = `<main><h1>MSc Data Science: admission</h1>
<p>Admission to the master programme requires a bachelor degree in a related field.</p>
<p>English proficiency: a certificate stating that English was the medium of instruction of your bachelor degree is accepted as proof of English.</p>
<p>Applications are open until 31 March 2027.</p></main>`;

const NO_DATE_PAGE = `<main><h1>PhD scholarships</h1><p>Scholarships for doctoral candidates in engineering. The call will be published soon.</p>
<p>The scholarship covers tuition and a monthly stipend.</p></main>`;

const CONFLICT_PAGE = `<main><h1>Master scholarship call</h1>
<p>Scholarship applications: deadline 10 December 2026.</p>
<p>Second round scholarship deadline 20 February 2027.</p>
<p>For the scholarship, a medium of instruction letter is accepted as proof of English.</p>
<p>For the scholarship, a medium of instruction letter will not be accepted; IELTS is required.</p></main>`;

const pk = (over: Partial<Profile> = {}): Profile => ({ nationality: "PK", targetLevel: "master", highestCompleted: "bachelor", ...over });
const TODAY = "2026-10-27";
const run = (html: string, p: Profile, conflictsCatalogue?: { name: string; date: string | null }) => {
  const text = pageText(html);
  const x = extractPage(text);
  const conflicts = findConflicts(x, conflictsCatalogue);
  return { text, x, conflicts, ev: evaluateDiscovery(x, p, TODAY, { state: "NEEDS_REVIEW", conflicts }) };
};

describe("official-domain gate", () => {
  it("keeps registered, listed and university-style hosts; drops agents, forums and odd protocols", () => {
    const reg = ["boell.de"];
    expect(classifyHost("https://www.boell.de/en/scholarships", reg)).toBe("registered");
    expect(classifyHost("https://www.polimi.it/x", reg)).toBe("listed");
    expect(classifyHost("https://yz.tsinghua.edu.cn/en/", reg)).toBe("pattern");
    expect(classifyHost("https://www.uni-heidelberg.de/en", reg)).toBe("pattern");
    expect(classifyHost("https://scholarship-agent.com/italy", reg)).toBeNull();
    expect(classifyHost("https://reddit.com/r/italy", reg)).toBeNull();
    expect(classifyHost("https://polimi.it.evil.com/", reg)).toBeNull();
    expect(classifyHost("javascript:alert(1)", reg)).toBeNull();
  });
});

describe("evidence", () => {
  it("every extracted value is quoted verbatim from the page text", () => {
    const { text, x } = run(SCHOLARSHIP_PAGE, pk());
    expect(unverifiableQuotes(x, text)).toEqual([]);
    expect(x.deadlines[0].quote).toContain("15 January 2027");
    expect(text).not.toContain("Home | News"); // nav removed
  });
  it("a quote that is not on the page is detected", () => {
    const { text, x } = run(SCHOLARSHIP_PAGE, pk());
    const tampered = { ...x, deadlines: [{ ...x.deadlines[0], quote: "The deadline is 1 May 2027." }] };
    expect(unverifiableQuotes(tampered, text)).toEqual(["The deadline is 1 May 2027."]);
    expect(isVerbatim("", text)).toBe(false);
  });
});

describe("profile matching", () => {
  it("master applicant: level stated → looks possible; bachelor-only seeker → likely not for you (never 'not eligible')", () => {
    expect(run(SCHOLARSHIP_PAGE, pk()).ev.eligibility.value).toBe("LOOKS_POSSIBLE");
    const b = run(SCHOLARSHIP_PAGE, pk({ targetLevel: "bachelor", highestCompleted: "intermediate" })).ev.eligibility;
    expect(b.value).toBe("LIKELY_NOT_FOR_YOU");
    expect(b.reasons.join(" ")).toMatch(/not reviewer-confirmed/);
  });
  it("missing profile data → needs confirmation, not a rejection", () => {
    expect(run(SCHOLARSHIP_PAGE, { nationality: "PK" }).ev.eligibility.value).toBe("NEEDS_CONFIRMATION");
  });
  it("competitiveness is never estimated; verification is never automatic", () => {
    const { ev } = run(SCHOLARSHIP_PAGE, pk());
    expect(ev.competitiveness.value).toBe("NOT_ASSESSED");
    expect(ev.verification.value).toBe("NOT_VERIFIED");
  });
});

describe("deadlines and timezones", () => {
  it("reads date, time and timezone and converts to Pakistan time", () => {
    const { ev } = run(SCHOLARSHIP_PAGE, pk());
    expect(ev.cycle.value).toBe("DEADLINE_AHEAD");
    expect(ev.cycle.deadline).toMatchObject({ date: "2027-01-15", time: "13:00" });
    expect(ev.cycle.deadline!.timezone!.label).toMatch(/CET/);
    expect(ev.cycle.pakistanTime).toBe("2027-01-15 17:00 PKT");
  });
  it("named European time follows daylight saving", () => {
    const tz = { label: "Central European time", zone: "Europe/Rome", fixedOffsetMin: null };
    expect(toPakistanTime("2027-01-15", "12:00", tz)).toBe("2027-01-15 16:00 PKT");
    expect(toPakistanTime("2027-06-15", "12:00", tz)).toBe("2027-06-15 15:00 PKT");
  });
  it("no timezone on the page → no conversion; no date → unknown, never guessed", () => {
    const moi = run(PROGRAMME_PAGE_MOI, pk()).ev;
    expect(moi.cycle.deadline).toMatchObject({ date: "2027-03-31", time: null, timezone: null });
    expect(moi.cycle.pakistanTime).toBeNull();
    const none = run(NO_DATE_PAGE, pk({ targetLevel: "phd", highestCompleted: "master" })).ev;
    expect(none.cycle.value).toBe("UNKNOWN");
    expect(none.cycle.deadline).toBeNull();
    expect(none.nextAction!.key).toBe("watch");
    expect(none.timeline.every((s) => s.due === null)).toBe(true);
  });
  it("an application window gives an opening date and one deadline; table dates without deadline wording are never deadlines", () => {
    const x = extractPage(pageText("<main><p>Scholarship application period. Spring 2027: 15 January 2027 until 1 March 2027</p><table><tr><td>Borsa di studio</td><td>24/08/2026 ore 16.00</td></tr></table></main>"), { dayFirst: true });
    expect(x.deadlines).toEqual([expect.objectContaining({ date: "2027-03-01", opens: "2027-01-15" })]);
    expect(x.otherDates.map((d) => d.value)).toEqual(["2026-08-24"]);
    const y = extractPage(pageText("<main><p>Scholarship portal: the online application portal opens on January 15, 2027, and closes on March 1, 2027.</p></main>"));
    expect(y.deadlines).toEqual([expect.objectContaining({ date: "2027-03-01", opens: "2027-01-15" })]);
    expect(findDates("06/08/2026")).toEqual([]); // ambiguous unless the site is day-first
    expect(findDates("06/08/2026", true)).toEqual(["2026-08-06"]);
  });
  it("date parsing: formats, languages, ambiguous slashes skipped, dates are not times", () => {
    expect(findDates("entro il 5 marzo 2027 e il 2027-04-01, 15.12.2026, 31/01/2027, 03/04/2027, 2027年1月20日")).toEqual(["2027-03-05", "2027-04-01", "2026-12-15", "2027-01-31", "2027-01-20"]);
    expect(findDates("December 1st, 2026 and 31 February 2027")).toEqual(["2026-12-01"]);
    expect(findTime("deadline 15.12.2026")).toBeNull();
    expect(findTime("entro le ore 12.00 del 15.12.2026")).toBe("12:00");
    expect(findTime("by 5 p.m.")).toBe("17:00");
  });
});

describe("conflicts", () => {
  it("two dates and contradictory MOI statements are flagged with both quotes", () => {
    const { conflicts, ev } = run(CONFLICT_PAGE, pk());
    const fields = conflicts.map((c) => c.field);
    expect(fields).toContain("deadline");
    expect(fields).toContain("english_scholarship");
    expect(ev.cycle.value).toBe("SEVERAL_DATES");
    expect(ev.verification.value).toBe("CONFLICTING");
    expect(conflicts.find((c) => c.field === "english_scholarship")!.quotes).toHaveLength(2);
  });
  it("dates labelled as rounds are several cycles, not a conflict", () => {
    const x = extractPage(pageText("<main><p>Scholarship application periods.</p><p>Spring 2027: 15 January 2027 until 1 March 2027</p><p>Fall 2027: 15 July 2027 until 1 September 2027</p></main>"));
    expect(findConflicts(x)).toEqual([]);
    expect(evaluateDiscovery(x, pk(), TODAY, { state: "NEEDS_REVIEW", conflicts: [] }).cycle.value).toBe("SEVERAL_DATES");
  });
  it("page vs Raasta catalogue disagreement is a conflict", () => {
    const { conflicts } = run(PROGRAMME_PAGE_MOI, pk(), { name: "Catalogue record", date: "2027-02-28" });
    expect(conflicts.map((c) => c.field)).toEqual(["deadline_vs_catalogue"]);
  });
});

describe("English and MOI decision (admission and scholarship separately)", () => {
  it("alternative tests + MOI waiver needing approval", () => {
    const { x, ev } = run(SCHOLARSHIP_PAGE, pk());
    const any = [x.english.admission, x.english.scholarship];
    expect(any.some((e) => e.state === "WAIVER_WITH_APPROVAL")).toBe(true);
    const plan = ev.english.find((e) => e.state === "WAIVER_WITH_APPROVAL")!;
    expect(plan.advice).toMatch(/confirm in writing/);
    expect(plan.advice).toMatch(/If they say no, you'll need one of: IELTS 6, TOEFL 80, Duolingo 105/);
    expect(ev.timeline.map((s) => s.key)).toEqual(expect.arrayContaining(["ask_office", "english_test", "moi_letter"]));
    expect(ev.checklist.map((c) => c.key)).toContain("moi_letter");
  });
  it("'programmes taught in English' is the course language, not an MOI rule", () => {
    const x = extractPage(pageText("<main><p>Scholarships for Master's degree programmes taught in English.</p></main>"));
    expect(x.english.scholarship.state).toBe("NOT_STATED");
    expect(x.english.admission.state).toBe("NOT_STATED");
  });
  it("tests named with scores → alternative tests, and the student's score is compared", () => {
    const x = extractPage(pageText("<main><p>Admission requires English: IELTS 6.5 or TOEFL iBT 90.</p></main>"));
    expect(x.english.admission.state).toBe("ALTERNATIVE_TESTS");
    expect(x.english.admission.tests).toEqual([{ test: "IELTS", min: 6.5 }, { test: "TOEFL", min: 90 }]);
    const yes = evaluateDiscovery(x, pk({ languageTests: [{ test: "IELTS", score: 7 }] }), TODAY, { state: "NEEDS_REVIEW", conflicts: [] });
    expect(yes.english[0].youMeet).toBe("yes");
    const no = evaluateDiscovery(x, pk({ languageTests: [{ test: "IELTS", score: 6 }] }), TODAY, { state: "NEEDS_REVIEW", conflicts: [] });
    expect(no.english[0].youMeet).toBe("no");
    const unknown = evaluateDiscovery(x, pk(), TODAY, { state: "NEEDS_REVIEW", conflicts: [] });
    expect(unknown.english[0].youMeet).toBe("unknown");
  });
  it("IELTS only → IELTS required; MOI explicitly accepted → MOI accepted; silence → not stated; vague → unknown", () => {
    expect(extractPage(pageText("<main><p>Admission: applicants must submit IELTS with a minimum score of 6.0.</p></main>")).english.admission.state).toBe("IELTS_REQUIRED");
    expect(run(PROGRAMME_PAGE_MOI, pk()).x.english.admission.state).toBe("MOI_ACCEPTED");
    expect(run(NO_DATE_PAGE, pk()).x.english.scholarship.state).toBe("NOT_STATED");
    expect(extractPage(pageText("<main><p>Admission requires good English language proficiency.</p></main>")).english.admission.state).toBe("UNKNOWN_OR_CONFLICTING");
  });
  it("MOI rejected is recorded", () => {
    const x = extractPage(pageText("<main><p>Admission: a medium of instruction letter is not accepted. IELTS 6.5 is required.</p></main>"));
    expect(x.english.admission.state).toBe("IELTS_REQUIRED");
    expect(x.english.admission.moiRejected).toBe(true);
  });
  it("the MOI email is a request to the university, never a certificate", () => {
    const e = moiRequestEmail({ name: "A Student" });
    expect(e).toMatch(/^Subject: Request for/);
    expect(e).toMatch(/Could you please issue/);
    expect(e).not.toMatch(/This is to certify/i);
  });
});

describe("total fees", () => {
  it("sums once + yearly × years per currency, keeps benefits separate", () => {
    const { ev } = run(SCHOLARSHIP_PAGE, pk());
    // master = 2 years: tuition 2,500 × 2 + application fee 30 = 5,030 EUR
    expect(ev.fees.totals).toHaveLength(1);
    expect(ev.fees.totals[0]).toMatchObject({ currency: "EUR", total: 5030, years: 2 });
    expect(ev.fees.benefits.map((b) => b.amount)).toEqual([8000]);
  });
  it("amounts with unknown frequency are excluded and listed", () => {
    const x = extractPage(pageText("<main><p>Tuition: € 3,000.</p></main>"));
    const ev = evaluateDiscovery(x, pk(), TODAY, { state: "NEEDS_REVIEW", conflicts: [] });
    expect(ev.fees.totals).toEqual([]);
    expect(ev.fees.excluded.map((f) => f.amount)).toEqual([3000]);
  });
  it("parses European and English number formats; years are not money", () => {
    expect(parseAmount("2.500,00")).toBe(2500);
    expect(parseAmount("1,500.50")).toBe(1500.5);
    expect(parseAmount("18,000")).toBe(18000);
    expect(parseAmount("12,5")).toBe(12.5);
    expect(extractPage(pageText("<main><p>Tuition 2027 € per year: see list.</p></main>")).fees).toEqual([]);
  });
});

describe("document checklist", () => {
  it("lists what was found, with general guidance and 'not stated' for the rest", () => {
    const { ev } = run(SCHOLARSHIP_PAGE, pk());
    const keys = ev.checklist.map((c) => c.key);
    expect(keys).toEqual(expect.arrayContaining(["passport", "transcript", "degree", "cv", "motivation", "recommendation"]));
    const t = ev.checklist.find((c) => c.key === "transcript")!;
    for (const f of ["what", "why", "issuer", "how", "translation", "legalization", "validity", "fee", "upload", "deadline"] as const) expect(t[f]).toBeTruthy();
    expect(t.formatOnPage).toEqual(expect.arrayContaining(["certified copy", "pdf"]));
    expect(t.upload).toMatch(/online application portal/);
    expect(t.deadline).toMatch(/2027-01-15 13:00 CET/);
    expect(JSON.stringify(ev.checklist)).not.toMatch(/PKR \d|Rs\.? ?\d/); // no unsourced fee numbers
  });
  it("timeline counts back from the deadline, flags buffers, and starts with the next action", () => {
    const { ev } = run(SCHOLARSHIP_PAGE, pk());
    const submit = ev.timeline.find((s) => s.key === "submit")!;
    expect(submit.due).toBe("2027-01-08");
    expect(submit.buffer).toBe(true);
    expect(ev.nextAction).toEqual(ev.timeline[0]);
    expect(ev.timeline.map((s) => s.key)).toContain("attestation");
  });
});
