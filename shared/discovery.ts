// Live discovery: deterministic reading of official pages. No LLM, no probabilities.
// Every extracted value carries a verbatim quote from the fetched page text; anything not found stays "unknown"/"not stated".
// A discovery is research evidence only. It never verifies anything (see SOURCE_POLICY.md).
import type { Profile } from "./profile";
import type { Country, Level } from "./types";

/* ───────────────────────── Official-domain gate ───────────────────────── */

/** Official bodies and public universities (domains only). Anything else found by search is dropped. */
export const LISTED_DOMAINS = [
  // Germany
  "daad.de", "daad.pk", "deutschlandstipendium.de", "boell.de", "fes.de", "kaad.de", "kas.de", "freiheit.org", "rosalux.de", "hss.de",
  "studienstiftung.de", "uni-assist.de", "study-in-germany.de", "tum.de", "rwth-aachen.de", "lmu.de", "kit.edu", "tu-berlin.de", "fu-berlin.de",
  "hu-berlin.de", "tu-dresden.de", "tu-darmstadt.de", "tu-braunschweig.de", "tuhh.de", "fau.de",
  // Italy
  "esteri.it", "studyinitaly.esteri.it", "universitaly.it", "cimea.it", "polimi.it", "polito.it", "unimi.it", "unibo.it", "unipd.it", "uniroma1.it",
  "uniroma2.it", "uniroma3.it", "unito.it", "unifi.it", "unipi.it", "unina.it", "unitn.it", "units.it", "univr.it", "unive.it", "unisi.it",
  "unipv.it", "unige.it", "unimib.it", "unical.it", "unict.it", "unipr.it", "unimore.it", "santannapisa.it", "sns.it",
  "er-go.it", "laziodisco.it", "dsu.toscana.it", "edisu.piemonte.it",
  // China
  "campuschina.org", "csc.edu.cn", "studyinchina.edu.cn", "anso.org.cn",
  // Pakistan
  "hec.gov.pk",
] as const;

/** Domain shapes used only by public universities / government (reviewer still checks each one). */
const PATTERN_HOSTS = [
  /\.edu\.cn$/, /\.ac\.cn$/, /\.gov\.cn$/, /\.gov\.pk$/, /\.edu\.pk$/,
  /(^|\.)(uni|tu|th|hs|fh)-[a-z-]+\.de$/, /(^|\.)uni[a-z]+\.it$/, /(^|\.)poli[a-z]+\.it$/,
];

export type HostTier = "registered" | "listed" | "pattern";

const endsWithDomain = (host: string, d: string) => host === d || host.endsWith("." + d);

/** null = not an official source → never used as evidence. */
export function classifyHost(url: string, registeredHosts: string[]): HostTier | null {
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    host = u.hostname.toLowerCase().replace(/^www\d?\./, "");
  } catch {
    return null;
  }
  if (registeredHosts.some((d) => endsWithDomain(host, d.replace(/^www\d?\./, "")))) return "registered";
  if (LISTED_DOMAINS.some((d) => endsWithDomain(host, d))) return "listed";
  if (PATTERN_HOSTS.some((re) => re.test(host))) return "pattern";
  return null;
}

export function countryOfHost(host: string): Country | "PK" | null {
  if (/\.(cn)$|campuschina\.org$/.test(host)) return "CN";
  if (/\.de$|kit\.edu$|daad\.de$/.test(host)) return "DE";
  if (/\.it$/.test(host)) return "IT";
  if (/\.pk$/.test(host)) return "PK";
  return null;
}

/* ───────────────────────── Queries ───────────────────────── */

const COUNTRY_NAME: Record<Country, string> = { CN: "China", DE: "Germany", IT: "Italy" };
const LEVEL_WORD: Record<Level, string> = { bachelor: "bachelor", master: "master's", phd: "PhD" };

export function buildQueries(p: Profile, country: Country): string[] {
  const level = LEVEL_WORD[p.targetLevel ?? "master"];
  const field = (p.targetField ?? "").trim();
  const year = new Date().getUTCFullYear() + 1;
  return [
    `${level} ${field} scholarship international students ${COUNTRY_NAME[country]} ${year}`.replace(/\s+/g, " ").trim(),
    `${level} ${field} English-taught admission requirements ${COUNTRY_NAME[country]} international applicants`.replace(/\s+/g, " ").trim(),
  ];
}

/* ───────────────────────── Page text ───────────────────────── */

/** HTML → plain text that keeps block boundaries as newlines (so quotes stay readable). Untrusted data: never interpreted. */
export function pageText(html: string, maxBytes = 400_000): string {
  let s = html.slice(0, maxBytes);
  const main = s.match(/<main[\s\S]*?<\/main>/i) ?? s.match(/<article[\s\S]*?<\/article>/i);
  if (main) s = main[0];
  return s
    .replace(/<(script|style|noscript|nav|header|footer|form|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|li|h[1-6]|tr|div|section|dd|dt|td|th)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&euro;/gi, "€").replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/ ?\n[ \n]*/g, "\n")
    .trim();
}

export function pageTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").replace(/&[a-z#0-9]+;/gi, " ").trim().slice(0, 200) || null : null;
}

/** Sentence-sized chunks. Every chunk is an exact substring of `text`. */
export function sentences(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split(/(?<=[.!?。；;])\s+/);
    for (let p of parts) {
      p = p.trim();
      while (p.length > 400) {
        const cut = p.lastIndexOf(" ", 380);
        const at = cut > 100 ? cut : 380;
        out.push(p.slice(0, at).trim());
        p = p.slice(at).trim();
      }
      if (p.length >= 3) out.push(p);
    }
  }
  return out;
}

export const isVerbatim = (quote: string, text: string) => quote.length > 0 && text.includes(quote);

/* ───────────────────────── Dates and timezones ───────────────────────── */

const MONTHS: Record<string, number> = {};
[
  ["january", "jan", "gennaio", "januar", "jänner"], ["february", "feb", "febbraio", "februar"], ["march", "mar", "marzo", "märz", "maerz"],
  ["april", "apr", "aprile"], ["may", "maggio", "mai"], ["june", "jun", "giugno", "juni"], ["july", "jul", "luglio", "juli"],
  ["august", "aug", "agosto"], ["september", "sep", "sept", "settembre"], ["october", "oct", "ottobre", "oktober", "okt"],
  ["november", "nov", "novembre"], ["december", "dec", "dicembre", "dezember", "dez"],
].forEach((names, i) => names.forEach((n) => (MONTHS[n] = i + 1)));
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const iso = (y: number, m: number, d: number) => {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCDate() === d ? `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : null;
};

interface DateAt { date: string; start: number; end: number }

/** Dates with their positions, in text order. dd/mm/yyyy is read day-first only when `dayFirst` (Italian/German/Pakistani sites);
 *  otherwise it is skipped when both parts are ≤ 12 (ambiguous). */
function datesAt(s: string, dayFirst = false): DateAt[] {
  const out: DateAt[] = [];
  const push = (v: string | null, m: RegExpMatchArray) => {
    if (v && !out.some((o) => m.index! < o.end && m.index! + m[0].length > o.start)) out.push({ date: v, start: m.index!, end: m.index! + m[0].length });
  };
  for (const m of s.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th|°|\\.)?\\s+(${MONTH_RE})\\.?,?\\s+(\\d{4})`, "gi"))) push(iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]), m);
  for (const m of s.matchAll(new RegExp(`\\b(${MONTH_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`, "gi"))) push(iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]), m);
  for (const m of s.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(iso(+m[1], +m[2], +m[3]), m);
  for (const m of s.matchAll(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g)) push(iso(+m[3], +m[2], +m[1]), m);
  for (const m of s.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) if (dayFirst || +m[1] > 12) push(iso(+m[3], +m[2], +m[1]), m);
  for (const m of s.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日/g)) push(iso(+m[1], +m[2], +m[3]), m);
  return out.sort((a, b) => a.start - b.start);
}

export function findDates(s: string, dayFirst = false): string[] {
  return [...new Set(datesAt(s, dayFirst).map((d) => d.date))];
}

const RANGE_JOIN = /^\s*(?:until|till|to|through|thru|–|—|-|al|fino al|bis|and)\s*$/i;
const OPENS_BEFORE = /(?:opens?|opening|starts?|starting|begins?|from|dal|ab|apertura)\s+(?:on\s+|the\s+|il\s+|am\s+)?$/i;

export interface TimeZoneInfo { label: string; zone: string | null; fixedOffsetMin: number | null }

const TZ: [RegExp, TimeZoneInfo][] = [
  [/\bCEST\b|\bMESZ\b|Central European Summer Time/i, { label: "CEST (UTC+2)", zone: null, fixedOffsetMin: 120 }],
  [/\bCET\b|\bMEZ\b/, { label: "CET (UTC+1)", zone: null, fixedOffsetMin: 60 }],
  [/Central European Time|Italian time|Rome time|ora italiana|German time|Berlin time/i, { label: "Central European time (Rome/Berlin)", zone: "Europe/Rome", fixedOffsetMin: null }],
  [/Beijing time|China Standard Time|北京时间|GMT\s?\+\s?8|UTC\s?\+\s?8/i, { label: "China time (UTC+8)", zone: null, fixedOffsetMin: 480 }],
  [/Pakistan (Standard )?Time|\bPKT\b/i, { label: "Pakistan time (UTC+5)", zone: null, fixedOffsetMin: 300 }],
  [/\bUTC\b|\bGMT\b/, { label: "UTC", zone: null, fixedOffsetMin: 0 }],
];

export function findTimeZone(s: string): TimeZoneInfo | null {
  for (const [re, info] of TZ) if (re.test(s)) return info;
  return null;
}

/** "12:00", "ore 12.00", "at 5 p.m." → "HH:MM". A dotted time needs a lead word so dates like 15.12.2026 are never read as times. */
export function findTime(s: string): string | null {
  let h: number, min: number, ampm: string;
  const colon = s.match(/\b(\d{1,2}):(\d{2})\s*(a\.?m\.?|p\.?m\.?)?(?![\d:])/i) ?? s.match(/(?:\bore|\bh|\bat|\bby|\buntil|\bUhr)\s+(\d{1,2})\.(\d{2})\s*(a\.?m\.?|p\.?m\.?)?(?![\d.])/i);
  if (colon) [h, min, ampm] = [+colon[1], +colon[2], colon[3] ?? ""];
  else {
    const m = s.match(/\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)(?=\W|$)/i);
    if (!m) return null;
    [h, min, ampm] = [+m[1], 0, m[2]];
  }
  ampm = ampm.toLowerCase().replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function zoneOffsetMin(utcMs: number, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return (Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - utcMs) / 60000;
}

/** Published local deadline → the same moment in Pakistan time (UTC+5, no DST). null when time or zone is not stated. */
export function toPakistanTime(date: string, time: string | null, tz: TimeZoneInfo | null): string | null {
  if (!time || !tz) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let offset = tz.fixedOffsetMin;
  if (offset === null && tz.zone) offset = zoneOffsetMin(guess - zoneOffsetMin(guess, tz.zone) * 60000, tz.zone);
  if (offset === null) return null;
  const pkt = new Date(guess - offset * 60000 + 300 * 60000);
  return `${pkt.toISOString().slice(0, 10)} ${pkt.toISOString().slice(11, 16)} PKT`;
}

/* ───────────────────────── Extraction ───────────────────────── */

export type Scope = "admission" | "scholarship";
export interface Quoted<T> { value: T; quote: string }
export interface DeadlineFound { date: string; opens: string | null; time: string | null; timezone: TimeZoneInfo | null; quote: string }
export type FeeCategory = "application_fee" | "tuition" | "semester_contribution" | "deposit" | "accommodation" | "benefit";
export interface FeeFound { category: FeeCategory; amount: number; currency: string; unit: "once" | "year" | "semester" | "month" | "unknown"; quote: string }
export type EnglishState = "IELTS_REQUIRED" | "ALTERNATIVE_TESTS" | "MOI_ACCEPTED" | "WAIVER_WITH_APPROVAL" | "NOT_STATED" | "UNKNOWN_OR_CONFLICTING";
export interface EnglishFinding {
  state: EnglishState;
  tests: { test: string; min: number | null }[];
  moiMentioned: boolean;
  moiRejected: boolean;
  quotes: string[];
  reason: string;
}
export interface DocFound { key: DocKey; quote: string; format: string[] }
export interface Extract {
  kind: "scholarship" | "programme" | "both" | "unknown";
  levels: Quoted<Level>[];
  deadlines: DeadlineFound[];
  /** Dates not next to deadline wording (e.g. in tables). Shown as "check which applies", never used as deadlines. */
  otherDates: Quoted<string>[];
  fees: FeeFound[];
  english: Record<Scope, EnglishFinding>;
  documents: DocFound[];
  mentions: { pakistan: string | null; developingCountries: string | null; portal: string | null };
  textLength: number;
}

const DEADLINE_WORDS = /deadline|apply by|applications? (?:must|should|can|may) be (?:submitted|received|sent)|closing date|closes on|application period|application window|no later than|until|by \d|scadenz[ae]|entro il|entro e non oltre|bewerbungsschluss|bewerbungsfrist|frist|截止|申请时间/i;

const LEVEL_RES: [Level, RegExp][] = [
  ["bachelor", /\bbachelor|undergraduate|laurea triennale|本科/i],
  ["master", /\bmaster|postgraduate|graduate (?:programme|program|degree|studies)|laurea magistrale|硕士/i],
  ["phd", /\bph\.?\s?d\b|doctoral|doctorate|dottorato|promotion\b|博士/i],
];

const SCHOLARSHIP_WORD = /scholarship|stipend|fellowship|bursary|grant\b|award|borsa|borse|stipendium|stipendien|奖学金|diritto allo studio/i;
const PROGRAMME_WORD = /admission|programme|program\b|curriculum|course of study|degree course|study programme|corso di laurea|studiengang|招生/i;

const CURRENCIES: [RegExp, string][] = [[/€|eur\b|euros?\b/i, "EUR"], [/rmb|cny|yuan|元|¥/i, "CNY"], [/usd|us\$|\$/i, "USD"], [/pkr|rs\.?\b|rupees/i, "PKR"]];
const AMOUNT_RE = /(€|EUR|euros?|RMB|CNY|¥|yuan|USD|US\$|\$|PKR|Rs\.?)\s?(\d[\d.,' ]*\d|\d)|(\d[\d.,' ]*\d|\d)\s?(€|EUR\b|euros?\b|RMB\b|CNY\b|yuan\b|元|USD\b|PKR\b)/gi;

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[' ]/g, "");
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",";
    s = s.replace(dec === "." ? /,/g : /\./g, "").replace(",", ".");
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? "," : ".";
    const groups = s.split(sep);
    const thousands = groups.length > 1 && groups.slice(1).every((g) => g.length === 3);
    s = thousands ? groups.join("") : s.replace(sep, ".");
  }
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function feeCategory(s: string): FeeCategory | null {
  if (/application fee|registration fee|processing fee|admission fee|contributo (?:di|per) (?:iscrizione|ammissione|partecipazione)|bewerbungsgebühr|报名费|申请费/i.test(s)) return "application_fee";
  if (/semester (?:contribution|fee)|semesterbeitrag|semester ticket/i.test(s)) return "semester_contribution";
  if (/deposit|caution money|guarantee|保证金|押金/i.test(s)) return "deposit";
  if (/stipend|monthly allowance|living allowance|scholarship (?:amount|of|worth|is)|grant of|amount of the (?:scholarship|grant|award)|importo|奖学金/i.test(s)) return "benefit";
  if (/tuition|tasse|contribuzione|studiengebühr|学费/i.test(s)) return "tuition";
  if (/accommodation|housing|dormitory|residence fee|rent\b|住宿/i.test(s)) return "accommodation";
  return null;
}

function feeUnit(s: string, cat: FeeCategory): FeeFound["unit"] {
  if (/per (?:academic )?year|per annum|annual|yearly|\/\s?year|a year|each year|all'anno|annuo|pro jahr|每年|\/年/i.test(s)) return "year";
  if (/per semester|each semester|a semester|\/\s?semester|pro semester|每学期/i.test(s)) return "semester";
  if (/per month|monthly|\/\s?month|a month|al mese|mensil|pro monat|每月|\/月/i.test(s)) return "month";
  if (/one[- ]?time|once|non-refundable|una tantum|einmalig/i.test(s) || cat === "application_fee" || cat === "deposit") return "once";
  if (cat === "semester_contribution") return "semester";
  return "unknown";
}

const TESTS: [string, RegExp, RegExp][] = [
  ["IELTS", /\bIELTS\b/i, /IELTS[^0-9]{0,30}?(\d(?:[.,]\d)?)\b/i],
  ["TOEFL", /\bTOEFL\b/i, /TOEFL[^0-9]{0,30}?(\d{2,3})\b/i],
  ["Duolingo", /\bDuolingo\b|\bDET\b/i, /(?:Duolingo|DET)[^0-9]{0,30}?(\d{2,3})\b/i],
  ["PTE", /\bPTE\b|Pearson Test/i, /PTE[^0-9]{0,30}?(\d{2})\b/i],
  ["Cambridge", /Cambridge (?:English|C1|C2|Advanced|Proficiency|First)|\bCAE\b|\bCPE\b/i, /$^/],
  ["TOEIC", /\bTOEIC\b/i, /TOEIC[^0-9]{0,30}?(\d{3})\b/i],
];
const ENGLISH_TEST_WORD = /english (?:language )?(?:proficiency|requirement|skills|level|certificate|test)|proof of english|knowledge of english|IELTS|TOEFL|Duolingo|\bPTE\b|Cambridge English/i;
const MOI_STRONG = /medium of instruction|\bMOI\b|language of instruction|english as (?:the )?(?:medium|language) of/i;
// "Programmes taught in English" describes the course, not the student's MOI: only count it for a previous degree.
const MOI_PREVIOUS = /(?:previous|prior|earlier|former|completed|obtained|undergraduate|bachelor'?s?|first) (?:degree|studies|qualification)[^.]{0,80}(?:taught (?:entirely |exclusively |wholly )?in english|english[- ]taught)|english[- ]taught (?:previous|prior|bachelor)/i;
const isMoi = (s: string) => MOI_STRONG.test(s) || MOI_PREVIOUS.test(s);
const isEnglish = (s: string) => ENGLISH_TEST_WORD.test(s) || isMoi(s);
const ACCEPT_WORD = /accept|recogni[sz]|sufficient|exempt|waiv|valid|in lieu|instead|equivalent|considered|no (?:need|test)|not (?:need|required)|do(?:es)? not have to/i;
const NEGATION = /\bnot (?:be )?accept|not sufficient|not recogni|cannot be|will not|won't|no longer|is not valid|are not valid|not considered|not exempt/i;
const DISCRETION = /\bmay\b|might|upon request|on request|at the discretion|case[- ]by[- ]case|subject to|approval|can be (?:waived|exempted)|individual(?:ly)? (?:assess|evaluat)/i;
const WAIVER_WORD = /waive|waiver|exempt|exemption|esonero|befreiung/i;

function englishFor(sents: string[]): EnglishFinding {
  const relevant = sents.filter(isEnglish);
  const tests = new Map<string, number | null>();
  for (const s of relevant)
    for (const [name, re, score] of TESTS)
      if (re.test(s)) {
        const m = s.match(score);
        const v = m ? Number(m[1].replace(",", ".")) : null;
        tests.set(name, tests.get(name) ?? v);
      }
  const moiSents = relevant.filter(isMoi);
  const moiYes = moiSents.filter((s) => ACCEPT_WORD.test(s) && !NEGATION.test(s));
  const moiNo = moiSents.filter((s) => NEGATION.test(s));
  const waivers = relevant.filter((s) => WAIVER_WORD.test(s) && !NEGATION.test(s));
  const testList = [...tests].map(([test, min]) => ({ test, min }));
  const base = { tests: testList, moiMentioned: moiSents.length > 0, moiRejected: moiNo.length > 0 };
  const q = (xs: string[]) => [...new Set(xs)].slice(0, 4);

  if (moiYes.length && moiNo.length)
    return { ...base, state: "UNKNOWN_OR_CONFLICTING", quotes: q([...moiYes, ...moiNo]), reason: "The page both accepts and rejects a medium-of-instruction letter. Ask the office which applies to you." };
  if (moiYes.length) {
    const discretionary = moiYes.some((s) => DISCRETION.test(s));
    return discretionary
      ? { ...base, state: "WAIVER_WITH_APPROVAL", quotes: q(moiYes), reason: "An English-taught previous degree can count, but only with the office's approval." }
      : { ...base, state: "MOI_ACCEPTED", quotes: q(moiYes), reason: "The page accepts proof that your previous degree was taught in English." };
  }
  if (waivers.length && waivers.some((s) => DISCRETION.test(s)))
    return { ...base, state: "WAIVER_WITH_APPROVAL", quotes: q(waivers), reason: "The English requirement can be waived, but only with the office's approval." };
  if (testList.length >= 2 || (testList.length === 1 && testList[0].test !== "IELTS"))
    return { ...base, state: "ALTERNATIVE_TESTS", quotes: q(relevant.filter((s) => TESTS.some(([, re]) => re.test(s)))), reason: `Accepted tests named on the page: ${testList.map((t) => t.test).join(", ")}.` };
  if (testList.length === 1)
    return { ...base, state: "IELTS_REQUIRED", quotes: q(relevant.filter((s) => /IELTS/i.test(s))), reason: "IELTS is the only English test named on this page." };
  if (relevant.length)
    return { ...base, state: "UNKNOWN_OR_CONFLICTING", quotes: q(relevant), reason: "The page mentions English requirements but names no test, score or MOI rule that could be read." };
  return { ...base, state: "NOT_STATED", quotes: [], reason: "This page says nothing about English requirements." };
}

/* Documents: detection patterns and general guidance (the official call always decides). */
export type DocKey =
  | "passport" | "transcript" | "degree" | "cv" | "motivation" | "recommendation" | "language_cert" | "moi_letter" | "research_proposal"
  | "physical_exam" | "police_certificate" | "dov_cimea" | "aps" | "income_documents" | "proof_of_funds" | "portfolio" | "gre_gmat" | "photo";

export interface DocGuide { label: string; what: string; why: string; issuer: string; how: string; translation: string; legalization: string; validity: string; fee: string }

const PK_LEGAL = "From Pakistan, academic documents are usually attested by HEC, and some countries also ask for MOFA attestation or embassy legalization. Check what this call asks for.";
export const DOC_GUIDE: Record<DocKey, [RegExp, DocGuide]> = {
  passport: [/passport/i, { label: "Passport", what: "Your valid passport (photo page copy).", why: "Identity and nationality check.", issuer: "Directorate General of Immigration & Passports (Pakistan)", how: "Apply or renew through the passport office / online portal.", translation: "Not needed (bilingual).", legalization: "Not usually needed.", validity: "Many calls want validity covering the whole study period. Check the call.", fee: "Set by the passport office. Check their current fee." }],
  transcript: [/transcript|mark ?sheet|records? of (?:study|academic)|academic record|成绩单/i, { label: "Transcripts", what: "Official record of all courses and grades.", why: "Shows your grades and the subjects you studied.", issuer: "Your university's Controller of Examinations / Registrar", how: "Request sealed official copies from your university.", translation: "Needed if not in English (or the call's language).", legalization: PK_LEGAL, validity: "No expiry, but some calls want recent certified copies.", fee: "Set by your university and HEC. Check their current fees." }],
  degree: [/degree certificate|diploma|graduation certificate|certificate of (?:graduation|degree)|bachelor'?s? certificate|毕业证/i, { label: "Degree certificate", what: "Your final degree (or a provisional certificate if not yet graduated).", why: "Proves you completed the qualification needed for entry.", issuer: "Your university", how: "Collect the original; request a provisional certificate if the final one is not issued yet.", translation: "Needed if not in English (or the call's language).", legalization: PK_LEGAL, validity: "No expiry.", fee: "Set by your university and HEC. Check their current fees." }],
  cv: [/\bCV\b|curriculum vitae|résumé|resume/i, { label: "CV", what: "A short CV of your education, work and achievements.", why: "Gives the committee an overview of you.", issuer: "You", how: "Write it yourself (Europass format is common in Europe).", translation: "Write it in the call's language.", legalization: "Not needed.", validity: "Keep it current.", fee: "None." }],
  motivation: [/motivation letter|letter of motivation|statement of purpose|personal statement|\bSOP\b|cover letter|study plan|lettera motivazionale|motivationsschreiben/i, { label: "Motivation letter / study plan", what: "Your own letter explaining why this programme and why you.", why: "Used to judge your motivation and fit.", issuer: "You", how: "Write it yourself. The Writing Studio can coach you but will not write it for you.", translation: "Write it in the call's language.", legalization: "Not needed.", validity: "Write a new one for each call.", fee: "None." }],
  recommendation: [/recommendation letter|letters? of recommendation|reference letter|referee|letters? of reference|推荐信/i, { label: "Recommendation letters", what: "Letters from teachers or supervisors who know your work.", why: "An independent view of your ability.", issuer: "Your professors / employers", how: "Ask early. Give them the deadline and how the letter must be sent.", translation: "Usually in English.", legalization: "Not usually needed.", validity: "Usually recent.", fee: "None." }],
  language_cert: [/IELTS|TOEFL|language certificate|proof of (?:english|language)|Duolingo|\bPTE\b|language proficiency/i, { label: "Language certificate", what: "An accepted language test result, or the accepted alternative.", why: "Shows you can study in the programme's language.", issuer: "The test provider (e.g. British Council / IDP for IELTS)", how: "Book a test date early enough for results to arrive before the deadline.", translation: "Not needed.", legalization: "Not needed.", validity: "Test results have a validity period set by the provider and the call. Check both.", fee: "Set by the test provider. Check their current fee." }],
  moi_letter: [/medium of instruction|\bMOI\b|language of instruction/i, { label: "Medium of Instruction (MOI) letter", what: "A letter from your university confirming your degree was taught in English.", why: "Some calls accept it instead of an English test.", issuer: "Your university's Registrar / Controller of Examinations", how: "Request it in writing (draft below). Raasta never writes the certificate itself.", translation: "Not needed (issued in English).", legalization: PK_LEGAL, validity: "Check the call; some want it recently issued.", fee: "Set by your university." }],
  research_proposal: [/research proposal|research plan|project proposal|研究计划/i, { label: "Research proposal", what: "Your plan for the research you want to do.", why: "Required for research degrees.", issuer: "You (often discussed with a supervisor)", how: "Write it yourself, following any length/format rules.", translation: "Write it in the call's language.", legalization: "Not needed.", validity: "Write a new one per call.", fee: "None." }],
  physical_exam: [/physical exam|medical (?:exam|certificate|check)|health certificate|foreigner physical examination|体检/i, { label: "Medical / physical examination form", what: "A medical form completed by a doctor.", why: "Health requirement for the visa or university.", issuer: "A hospital or doctor accepted by the call", how: "Use the official form named in the call.", translation: "Use the official bilingual form if one is given.", legalization: "Check the call.", validity: "Often valid for only a few months. Check the call.", fee: "Set by the hospital." }],
  police_certificate: [/non-criminal|police (?:clearance|certificate|character)|criminal record|无犯罪/i, { label: "Police / non-criminal record certificate", what: "A certificate showing no criminal record.", why: "Required by some scholarships and visas.", issuer: "Police (Character Certificate) in Pakistan", how: "Apply through your provincial police service.", translation: "Needed if not in English.", legalization: PK_LEGAL, validity: "Often valid for only a few months. Check the call.", fee: "Set by the issuing office." }],
  dov_cimea: [/declaration of value|dichiarazione di valore|\bDOV\b|CIMEA|statement of comparability|attestato di comparabilit/i, { label: "Declaration of Value / CIMEA statement", what: "An Italian recognition document for your foreign qualification.", why: "Italian universities use it to check your degree.", issuer: "Italian embassy/consulate (DOV) or CIMEA (statement)", how: "Apply through the embassy or CIMEA's online service, as the call says.", translation: "Follow the issuer's rules.", legalization: PK_LEGAL, validity: "Check the call.", fee: "Set by the issuer. Check their current fee." }],
  aps: [/\bAPS\b|Akademische Prüfstelle/i, { label: "APS certificate", what: "Academic Evaluation Centre certificate (Germany).", why: "Some German procedures require it for certain countries.", issuer: "APS at the German embassy", how: "Apply through the APS office named in the call.", translation: "Follow APS rules.", legalization: "Follow APS rules.", validity: "Check the call.", fee: "Set by APS. Check their current fee." }],
  income_documents: [/ISEE|income and asset|family income|economic condition|reddito|patrimonio|condizione economica/i, { label: "Family income and asset documents", what: "Official proof of your family's income and assets.", why: "Needed for need-based aid (e.g. Italian DSU).", issuer: "Employers, tax office (FBR), banks, property authorities", how: "Collect the exact documents the call lists. They usually need translation and legalization.", translation: "Usually needed into Italian or English.", legalization: PK_LEGAL, validity: "Usually tied to a specific tax year. Check the call.", fee: "Set by each issuer." }],
  proof_of_funds: [/proof of (?:funds|financial)|financial (?:guarantee|statement|means)|bank statement|blocked account|sperrkonto|sufficient funds/i, { label: "Proof of funds", what: "Evidence you can pay living costs.", why: "Visa or admission requirement. This is money you show, not a fee.", issuer: "Your bank / sponsor", how: "Use the format the call or embassy asks for.", translation: "Usually in English.", legalization: "Check the call.", validity: "Usually recent (weeks). Check the call.", fee: "Set by your bank." }],
  portfolio: [/portfolio/i, { label: "Portfolio", what: "Samples of your work.", why: "Required for design, architecture and arts programmes.", issuer: "You", how: "Follow the format and size limits in the call.", translation: "Captions in the call's language.", legalization: "Not needed.", validity: "Make it current.", fee: "None." }],
  gre_gmat: [/\bGRE\b|\bGMAT\b/i, { label: "GRE / GMAT", what: "A standardized test score.", why: "Some programmes use it to compare applicants.", issuer: "ETS (GRE) / GMAC (GMAT)", how: "Book early. Scores are sent electronically.", translation: "Not needed.", legalization: "Not needed.", validity: "Set by the test provider and the programme. Check both.", fee: "Set by the test provider." }],
  photo: [/passport[- ]size photo|photograph|证件照/i, { label: "Photo", what: "A recent passport-style photo.", why: "Identity.", issuer: "Any photo studio", how: "Follow the size/background rules in the call.", translation: "Not needed.", legalization: "Not needed.", validity: "Recent.", fee: "Small studio fee." }],
};

const FORMAT_WORDS = /certified cop(?:y|ies)|notari[sz]ed|apostille|legali[sz]ed|original|scanned|PDF|sealed|translated|sworn translation|copia conforme|beglaubigt/gi;

export function extractPage(text: string, opts: { dayFirst?: boolean } = {}): Extract {
  const sents = sentences(text);
  const scholWords = (text.match(new RegExp(SCHOLARSHIP_WORD, "gi")) ?? []).length;
  const progWords = (text.match(new RegExp(PROGRAMME_WORD, "gi")) ?? []).length;
  const kind: Extract["kind"] = scholWords >= 2 && progWords >= 2 ? "both" : scholWords >= 1 && scholWords >= progWords ? "scholarship" : progWords >= 1 ? "programme" : "unknown";

  const levels: Quoted<Level>[] = [];
  for (const [lv, re] of LEVEL_RES) {
    const s = sents.find((x) => re.test(x));
    if (s) levels.push({ value: lv, quote: s });
  }

  const deadlines: DeadlineFound[] = [];
  const otherDates: Quoted<string>[] = [];
  for (const s of sents) {
    const ds = datesAt(s, opts.dayFirst);
    if (!ds.length) continue;
    if (!DEADLINE_WORDS.test(s)) {
      for (const d of ds) if (otherDates.length < 6 && !otherDates.some((o) => o.value === d.date)) otherDates.push({ value: d.date, quote: s });
      continue;
    }
    // "15 January until 1 March": the first date opens the window, the second is the deadline.
    for (let i = 0; i < ds.length; i++) {
      const next = ds[i + 1];
      const opensRange = !!next && RANGE_JOIN.test(s.slice(ds[i].end, next.start));
      const isOpening = OPENS_BEFORE.test(s.slice(Math.max(0, ds[i].start - 30), ds[i].start));
      if (opensRange || isOpening) continue;
      const prev = ds[i - 1];
      const opens = prev && (RANGE_JOIN.test(s.slice(prev.end, ds[i].start)) || OPENS_BEFORE.test(s.slice(Math.max(0, prev.start - 30), prev.start))) ? prev.date : null;
      if (!deadlines.some((d) => d.date === ds[i].date)) deadlines.push({ date: ds[i].date, opens, time: findTime(s.slice(ds[i].start)) ?? findTime(s), timezone: findTimeZone(s), quote: s });
    }
  }

  const fees: FeeFound[] = [];
  for (const s of sents) {
    const cat = feeCategory(s);
    if (!cat) continue;
    for (const m of s.matchAll(AMOUNT_RE)) {
      const cur = m[1] ?? m[4];
      const amount = parseAmount(m[2] ?? m[3]);
      const currency = CURRENCIES.find(([re]) => re.test(cur))?.[1];
      if (!amount || !currency) continue;
      if (/^\d{4}$/.test(String(amount)) && amount >= 2000 && amount <= 2100) continue; // a year, not money
      fees.push({ category: cat, amount, currency, unit: feeUnit(s, cat), quote: s });
    }
  }

  const scopeOf = (s: string): Scope => (SCHOLARSHIP_WORD.test(s) ? "scholarship" : PROGRAMME_WORD.test(s) ? "admission" : kind === "scholarship" ? "scholarship" : "admission");
  const english = {
    admission: englishFor(sents.filter((s) => scopeOf(s) === "admission")),
    scholarship: englishFor(sents.filter((s) => scopeOf(s) === "scholarship")),
  };

  const documents: DocFound[] = [];
  for (const [key, [re]] of Object.entries(DOC_GUIDE) as [DocKey, [RegExp, DocGuide]][]) {
    const s = sents.find((x) => re.test(x));
    if (s) documents.push({ key, quote: s, format: [...new Set((s.match(FORMAT_WORDS) ?? []).map((f) => f.toLowerCase()))] });
  }

  return {
    kind,
    levels,
    deadlines,
    otherDates,
    fees,
    english,
    documents,
    mentions: {
      pakistan: sents.find((s) => /pakistan/i.test(s)) ?? null,
      developingCountries: sents.find((s) => /developing countr|low[- ]income countr|DAC list|least developed/i.test(s)) ?? null,
      portal: sents.find((s) => /online (?:application|portal|system)|application portal|apply online|upload|submit (?:online|through|via)/i.test(s)) ?? null,
    },
    textLength: text.length,
  };
}

/** Every quote in an extract must come verbatim from the page text. Returns the offending quotes (empty = OK). */
export function unverifiableQuotes(x: Extract, text: string): string[] {
  const qs = [
    ...x.levels.map((l) => l.quote), ...x.deadlines.map((d) => d.quote), ...x.otherDates.map((d) => d.quote), ...x.fees.map((f) => f.quote), ...x.documents.map((d) => d.quote),
    ...x.english.admission.quotes, ...x.english.scholarship.quotes,
    ...[x.mentions.pakistan, x.mentions.developingCountries, x.mentions.portal].filter((q): q is string => !!q),
  ];
  return qs.filter((q) => !isVerbatim(q, text));
}

/* ───────────────────────── Conflicts ───────────────────────── */

const ROUND_WORD = /\b(?:spring|summer|autumn|fall|winter)\b|round|intake|session|semester|(?:first|second|third|1st|2nd|3rd) (?:call|deadline|window)|phase|sommersemester|wintersemester|sessione|tornata/i;

export interface Conflict { field: string; detail: string; quotes: string[] }

export function findConflicts(x: Extract, catalogue?: { name: string; date: string | null } | null): Conflict[] {
  const out: Conflict[] = [];
  const dates = [...new Set(x.deadlines.map((d) => d.date))];
  // Dates labelled as rounds/intakes ("Spring 2027 …", "second call") are separate cycles, not a conflict.
  const rounds = x.deadlines.every((d) => ROUND_WORD.test(d.quote));
  if (dates.length > 1 && !rounds)
    out.push({ field: "deadline", detail: `The page shows ${dates.length} different dates near deadline wording (${dates.join(", ")}). They may be different rounds or levels. Check which applies to you.`, quotes: x.deadlines.map((d) => d.quote).slice(0, 4) });
  for (const scope of ["admission", "scholarship"] as Scope[])
    if (x.english[scope].state === "UNKNOWN_OR_CONFLICTING" && x.english[scope].moiMentioned && x.english[scope].moiRejected)
      out.push({ field: `english_${scope}`, detail: x.english[scope].reason, quotes: x.english[scope].quotes });
  if (catalogue?.date && dates.length && !dates.includes(catalogue.date))
    out.push({ field: "deadline_vs_catalogue", detail: `Raasta's catalogue record "${catalogue.name}" has ${catalogue.date}, but this page shows ${dates.join(", ")}.`, quotes: x.deadlines.map((d) => d.quote).slice(0, 2) });
  return out;
}

/* ───────────────────────── Personal evaluation ───────────────────────── */

const LEVEL_RANK: Record<string, number> = { intermediate: 0, bachelor: 1, master: 2, phd: 3 };
const YEARS: Record<Level, number> = { bachelor: 4, master: 2, phd: 3 };

export type Eligibility = "LOOKS_POSSIBLE" | "NEEDS_CONFIRMATION" | "LIKELY_NOT_FOR_YOU";
export type Verification = "NOT_VERIFIED" | "REVIEWER_CONFIRMED" | "CONFLICTING";
export type Cycle = "DEADLINE_AHEAD" | "DEADLINE_PASSED" | "SEVERAL_DATES" | "UNKNOWN";

export interface EnglishPlan {
  scope: Scope;
  state: EnglishState;
  reason: string;
  quotes: string[];
  youMeet: "yes" | "no" | "unknown";
  advice: string;
}

export interface TimelineStep { key: string; title: string; due: string | null; why: string; buffer: boolean }
export interface ChecklistItem extends DocGuide { key: DocKey; foundQuote: string; formatOnPage: string[]; upload: string; deadline: string }

export interface FeeTotal { currency: string; total: number; years: number; parts: FeeFound[] }
export interface Evaluation {
  eligibility: { value: Eligibility; reasons: string[] };
  competitiveness: { value: "NOT_ASSESSED"; reason: string };
  readiness: { stepsLeft: number; ready: string[] };
  verification: { value: Verification; reason: string };
  cycle: { value: Cycle; deadline: DeadlineFound | null; pakistanTime: string | null };
  english: EnglishPlan[];
  fees: { totals: FeeTotal[]; excluded: FeeFound[]; benefits: FeeFound[]; note: string };
  checklist: ChecklistItem[];
  timeline: TimelineStep[];
  nextAction: TimelineStep | null;
}

function userTest(p: Profile, test: string) {
  return (p.languageTests ?? []).find((t) => t.test.toLowerCase().includes(test.toLowerCase()) || test.toLowerCase().includes(t.test.toLowerCase()));
}

/** pageTests: every test named anywhere on the page, used as the fallback when a waiver is refused. */
function englishPlan(scope: Scope, f: EnglishFinding, p: Profile, pageTests: EnglishFinding["tests"]): EnglishPlan {
  const fallback = f.tests.length ? f.tests : pageTests;
  let youMeet: EnglishPlan["youMeet"] = "unknown";
  let advice: string;
  const has = f.tests.map((t) => ({ t, mine: userTest(p, t.test) })).filter((x) => x.mine);
  if (f.state === "IELTS_REQUIRED" || f.state === "ALTERNATIVE_TESTS") {
    if (has.some((x) => x.t.min !== null && x.mine!.score >= x.t.min)) youMeet = "yes";
    else if (has.length && has.every((x) => x.t.min !== null && x.mine!.score < x.t.min)) youMeet = "no";
    advice = f.state === "IELTS_REQUIRED"
      ? `Book IELTS early enough for results before the deadline${f.tests[0]?.min ? ` (minimum on the page: ${f.tests[0].min})` : ""}.${f.moiRejected ? " The page says an MOI letter is not accepted." : ""}`
      : `You can choose one of: ${f.tests.map((t) => (t.min ? `${t.test} ${t.min}` : t.test)).join(", ")}.${f.moiRejected ? " The page says an MOI letter is not accepted." : ""}`;
  } else if (f.state === "MOI_ACCEPTED") advice = "Request an MOI letter from your university's Registrar (draft below). Keep the page quote as proof that it is accepted.";
  else if (f.state === "WAIVER_WITH_APPROVAL")
    advice = `Email the admissions office before the deadline and ask whether your English-taught degree qualifies (draft below). Do not rely on it until they confirm in writing.${fallback.length ? ` If they say no, you'll need one of: ${fallback.map((t) => (t.min ? `${t.test} ${t.min}` : t.test)).join(", ")}.` : ""}`;
  else if (f.state === "NOT_STATED") advice = "This page doesn't say. Look for the programme's admission page, or ask the office. Don't assume no test is needed.";
  else advice = "Unclear or contradictory. Ask the office in writing (draft below) before you book or skip a test.";
  return { scope, state: f.state, reason: f.reason, quotes: f.quotes, youMeet, advice };
}

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export function evaluateDiscovery(x: Extract, p: Profile, today: string, review: { state: string; conflicts: Conflict[] }): Evaluation {
  /* Eligibility: only what the page states; missing → needs confirmation, never "not eligible". */
  const reasons: string[] = [];
  let eligibility: Eligibility = "LOOKS_POSSIBLE";
  const pageLevels = x.levels.map((l) => l.value);
  if (!p.targetLevel) (eligibility = "NEEDS_CONFIRMATION"), reasons.push("Add the degree you want to your profile.");
  else if (!pageLevels.length) (eligibility = "NEEDS_CONFIRMATION"), reasons.push("The page doesn't say which degree levels it covers.");
  else if (!pageLevels.includes(p.targetLevel)) (eligibility = "LIKELY_NOT_FOR_YOU"), reasons.push(`The page mentions ${pageLevels.join("/")} but not ${p.targetLevel} (not reviewer-confirmed).`);
  else reasons.push(`The page mentions ${p.targetLevel} level.`);
  if (p.targetLevel && p.highestCompleted !== undefined && LEVEL_RANK[p.highestCompleted] < LEVEL_RANK[p.targetLevel] - 1) {
    if (eligibility === "LOOKS_POSSIBLE") eligibility = "NEEDS_CONFIRMATION";
    reasons.push("Your completed qualification may be below the usual entry level. Check the entry requirements.");
  }
  if (x.mentions.pakistan) reasons.push("Pakistan is mentioned on the page (see quote).");
  else if (x.mentions.developingCountries) {
    if (eligibility === "LOOKS_POSSIBLE") eligibility = "NEEDS_CONFIRMATION";
    reasons.push("The page refers to a country list. Check that Pakistan is on it.");
  } else reasons.push("Nationality rules were not found on this page.");
  reasons.push("Your field of study isn't checked automatically. Check the programme list on the page.");

  /* Cycle */
  const upcoming = x.deadlines.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const distinct = new Set(x.deadlines.map((d) => d.date)).size;
  const cycleValue: Cycle = !x.deadlines.length ? "UNKNOWN" : distinct > 1 && upcoming.length > 1 ? "SEVERAL_DATES" : upcoming.length ? "DEADLINE_AHEAD" : "DEADLINE_PASSED";
  const deadline = upcoming[0] ?? null;

  /* English (admission and scholarship separately) */
  const pageTests = [...x.english.admission.tests, ...x.english.scholarship.tests].filter((t, i, a) => a.findIndex((u) => u.test === t.test) === i);
  const english = (["admission", "scholarship"] as Scope[]).map((s) => englishPlan(s, x.english[s], p, pageTests));
  const needsTest = english.some((e) => (e.state === "IELTS_REQUIRED" || e.state === "ALTERNATIVE_TESTS") && e.youMeet !== "yes");
  const moiRoute = english.some((e) => e.state === "MOI_ACCEPTED" || e.state === "WAIVER_WITH_APPROVAL");
  const askOffice = english.some((e) => e.state === "UNKNOWN_OR_CONFLICTING" || e.state === "WAIVER_WITH_APPROVAL");

  /* Fees: once + yearly × years + semester × 2 × years + monthly × 12 × years, per currency; unknown units excluded and listed. */
  const years = YEARS[p.targetLevel ?? "master"];
  const costs = x.fees.filter((f) => f.category !== "benefit");
  const byCat = new Map<string, FeeFound>();
  for (const f of costs.filter((f) => f.unit !== "unknown")) {
    const k = `${f.category}|${f.currency}`;
    if (!byCat.has(k) || byCat.get(k)!.amount < f.amount) byCat.set(k, f); // upper end when the page lists several amounts
  }
  const mult = { once: 1, year: years, semester: 2 * years, month: 12 * years, unknown: 0 };
  const totals = new Map<string, FeeTotal>();
  for (const f of byCat.values()) {
    const t = totals.get(f.currency) ?? { currency: f.currency, total: 0, years, parts: [] };
    t.total += f.amount * mult[f.unit];
    t.parts.push(f);
    totals.set(f.currency, t);
  }

  /* Documents */
  const deadlineText = deadline ? `${deadline.date}${deadline.time ? " " + deadline.time : ""}${deadline.timezone ? " " + deadline.timezone.label : " (timezone not stated)"}` : "Not stated on the page";
  const checklist: ChecklistItem[] = x.documents.map((d) => ({
    key: d.key,
    ...DOC_GUIDE[d.key][1],
    foundQuote: d.quote,
    formatOnPage: d.format,
    upload: x.mentions.portal ? `Stated on page: "${x.mentions.portal.slice(0, 160)}"` : "Not stated on this page",
    deadline: deadlineText,
  }));
  if (moiRoute && !checklist.some((c) => c.key === "moi_letter"))
    checklist.push({ key: "moi_letter", ...DOC_GUIDE.moi_letter[1], foundQuote: english.find((e) => e.state === "MOI_ACCEPTED" || e.state === "WAIVER_WITH_APPROVAL")!.quotes[0], formatOnPage: [], upload: "Not stated on this page", deadline: deadlineText });

  /* Timeline: Raasta planning buffers counted back from the earliest upcoming deadline. */
  const due = (n: number) => (deadline ? (addDays(deadline.date, -n) < today ? today : addDays(deadline.date, -n)) : null);
  const steps: TimelineStep[] = [];
  if (!deadline) steps.push({ key: "watch", title: "Find the current deadline on the official page", due: null, why: "No upcoming deadline was found. Watch the page or ask the office.", buffer: false });
  if (askOffice) steps.push({ key: "ask_office", title: "Email the office about the English requirement", due: due(60), why: "The page leaves the English rule unclear or needs approval.", buffer: true });
  const backupTest = !needsTest && english.some((e) => e.state === "WAIVER_WITH_APPROVAL" && pageTests.length > 0 && e.youMeet !== "yes");
  if (needsTest) steps.push({ key: "english_test", title: "Book and take an accepted English test", due: due(45), why: "Results must arrive before the deadline.", buffer: true });
  else if (backupTest) steps.push({ key: "english_test", title: "If the office hasn't approved the waiver: take an accepted English test", due: due(45), why: "A waiver needs approval. Keep a backup so you don't miss the deadline.", buffer: true });
  if (moiRoute) steps.push({ key: "moi_letter", title: "Request your MOI letter from your university", due: due(40), why: "Universities can take weeks to issue letters.", buffer: true });
  if (checklist.some((c) => c.key === "transcript" || c.key === "degree") && (p.nationality ?? "PK") === "PK")
    steps.push({ key: "attestation", title: "Get your degree and transcripts attested (HEC, if the call asks)", due: due(45), why: "Attestation takes time and may be needed before translation or legalization.", buffer: true });
  if (checklist.some((c) => c.key === "recommendation")) steps.push({ key: "referees", title: "Ask your referees for recommendation letters", due: due(35), why: "Give referees several weeks.", buffer: true });
  if (checklist.some((c) => c.key === "motivation" || c.key === "research_proposal")) steps.push({ key: "writing", title: "Draft your motivation letter / proposal", due: due(21), why: "Leave time for feedback and revisions.", buffer: true });
  steps.push({ key: "documents", title: "Collect every document on the checklist", due: due(14), why: "Scans, translations and formats checked against the call.", buffer: true });
  steps.push({ key: "submit", title: "Submit on the official portal", due: deadline ? due(7) : null, why: deadline ? `Aim a week early. Official deadline: ${deadlineText}.` : "Deadline unknown.", buffer: !!deadline });
  steps.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"));
  if (!deadline) steps.sort((a, b) => (a.key === "watch" ? -1 : b.key === "watch" ? 1 : 0));

  const ready: string[] = [];
  if (english.every((e) => e.youMeet === "yes" || e.state === "NOT_STATED")) ready.push("English requirement (as far as stated)");
  if (p.highestCompleted && p.targetLevel && LEVEL_RANK[p.highestCompleted] >= LEVEL_RANK[p.targetLevel] - 1) ready.push("Entry qualification level");

  const verification: Verification = review.state === "REVIEWER_CONFIRMED" ? "REVIEWER_CONFIRMED" : review.state === "CONFLICTING" || review.conflicts.length ? "CONFLICTING" : "NOT_VERIFIED";
  return {
    eligibility: { value: eligibility, reasons },
    competitiveness: { value: "NOT_ASSESSED", reason: "Raasta doesn't estimate your chances. Official pages rarely publish selection statistics." },
    readiness: { stepsLeft: steps.filter((s) => s.key !== "watch").length, ready },
    verification: {
      value: verification,
      reason: verification === "REVIEWER_CONFIRMED" ? "A Raasta reviewer checked this page against the official source." : verification === "CONFLICTING" ? "Found on an official page, but some details conflict (see below). Not verified." : "Found on an official page. Not yet verified by a Raasta reviewer.",
    },
    cycle: { value: cycleValue, deadline, pakistanTime: deadline ? toPakistanTime(deadline.date, deadline.time, deadline.timezone) : null },
    english,
    fees: {
      totals: [...totals.values()],
      excluded: costs.filter((f) => f.unit === "unknown"),
      benefits: x.fees.filter((f) => f.category === "benefit"),
      note: `Sum of the fees found on this page for ${years} years (upper ends where several amounts are listed). Costs not on this page (rent, living, visa) are not included. Use the Cost Planner for the full picture.`,
    },
    checklist,
    timeline: steps,
    nextAction: steps[0] ?? null,
  };
}

/* ───────────────────────── Email drafts (requests only, never certificates) ───────────────────────── */

export function moiRequestEmail(p: { name?: string; university?: string; degree?: string }) {
  return `Subject: Request for a Medium of Instruction (MOI) letter

Dear Registrar / Controller of Examinations,

I am a graduate of ${p.university ?? "[your university]"} (${p.degree ?? "[degree and years of study]"}, Registration No. [number]). I am applying to universities abroad and need an official letter confirming that the medium of instruction for my entire degree programme was English.

Could you please issue this letter on university letterhead, signed and stamped, stating my full name, registration number, degree title, dates of enrolment and that English was the medium of instruction throughout?

Please let me know the fee and how long it will take.

Kind regards,
${p.name ?? "[your full name]"}
[phone] · [email]`;
}

export function askOfficeEmail(programme: string, url: string) {
  return `Subject: English language requirement: question about medium of instruction

Dear Admissions Office,

I would like to apply for ${programme} (${url}). My bachelor's degree from Pakistan was taught entirely in English, and my university can issue an official Medium of Instruction letter.

Could you please confirm in writing whether this letter is accepted instead of an English test for (a) admission and (b) the scholarship? If not, which tests and minimum scores do you accept?

Thank you,
[your full name]
[nationality] · [email]`;
}
