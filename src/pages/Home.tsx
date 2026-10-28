import { AnimatePresence, animate, motion, useInView } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight, BadgeCheck, BookOpenCheck, ChevronDown, Compass, FileSearch, FileText, Globe2, GraduationCap, HelpCircle, Languages, ListChecks,
  MessageSquareQuote, PenLine, Quote, RefreshCw, Route as RouteIcon, Search, ShieldCheck, Sparkles, Wallet, X,
} from "lucide-react";
import { Link } from "../lib/router";
import { COUNTRY, fmtDate, useApi } from "../lib/use";
import { Logo } from "../components/Layout";
import { initials } from "../components/ScholarshipCard";
import { FUNDING_LABEL } from "../../shared/funding";

const EASE = [0.22, 1, 0.36, 1] as const;
const TILE: Record<string, string> = { CN: "#b3261e", DE: "#1f2421", IT: "#146b3a" };
const today = new Date().toISOString().slice(0, 10);

/* ───────── shared bits ───────── */

/** How well-checked a record is. 3 = a reviewer confirmed it, 2 = official quotes on file, 1 = lead only. Never a chance of success. */
function evidenceLevel(s: any): 1 | 2 | 3 {
  if (s.verification_method === "human" && String(s.status).startsWith("VERIFIED_")) return 3;
  if ((s.rule_count ?? 0) > 0) return 2;
  return 1;
}
const EV_LABEL = { 1: "Lead", 2: "Quoted", 3: "Verified" } as const;
const HEIGHTS = [6, 9, 7, 12, 10, 14, 11, 16, 13, 18, 15, 20];

function Meter({ level, delay = 0 }: { level: 1 | 2 | 3; delay?: number }) {
  return (
    <div className={`meter ev-${level}`} title="How well-checked this record is. It is not your chance of winning.">
      <span className="lab">{EV_LABEL[level]}</span>
      <span className="bars" aria-hidden>
        {HEIGHTS.map((h, i) => (
          <motion.i
            key={i}
            className={i < level * 4 ? "on" : ""}
            style={{ height: h }}
            initial={{ scaleY: 0.15, opacity: 0.4 }}
            whileInView={{ scaleY: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: delay + i * 0.025, duration: 0.45, ease: EASE }}
          />
        ))}
      </span>
    </div>
  );
}

function fundingAmount(s: any): { big: string | null; small: string } {
  const c = s.coverage ?? {};
  if (c.stipend?.amount) return { big: `${c.stipend.currency} ${Number(c.stipend.amount).toLocaleString("en-GB")}`, small: c.stipend.period === "month" ? "per month" : "per year" };
  if (c.tuition === "full") return { big: "Full tuition", small: c.accommodation && c.accommodation !== "none" ? "+ housing" : "documented" };
  return { big: null, small: FUNDING_LABEL[(s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL] };
}

const levelsText = (s: any) => (s.levels ?? []).map((l: string) => (l === "phd" ? "PhD" : l[0].toUpperCase() + l.slice(1))).join(", ");

function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`h-sec ${className}`}>{children}</section>;
}

function Rise({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 22, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, margin: "-70px" }} transition={{ duration: 0.7, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/* ───────── hero ───────── */

function Hero({ featured }: { featured: any[] }) {
  const words = ["Study", "abroad", "on", "a"];
  return (
    <section className="h-hero container">
      <h1 className="display" style={{ margin: 0 }}>
        <span className="h-title">
          {words.map((w, i) => (
            <motion.span key={w} style={{ display: "inline-block", marginRight: "0.22em" }} aria-hidden initial={{ opacity: 0, y: 26, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.06 * i, duration: 0.8, ease: EASE }}>
              {w}
            </motion.span>
          ))}
          <span className="sr-only">Study abroad on a scholarship</span>
          <motion.em style={{ display: "inline-block" }} aria-hidden initial={{ opacity: 0, y: 26, filter: "blur(10px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.3, duration: 0.8, ease: EASE }}>
            scholarship
          </motion.em>
          <motion.span className="h-sticker" aria-hidden initial={{ opacity: 0, scale: 0.4, rotate: -24 }} animate={{ opacity: 1, scale: 1, rotate: 8 }} transition={{ delay: 0.75, type: "spring", stiffness: 260, damping: 14 }} whileHover={{ rotate: -4, scale: 1.08 }}>
            from Pakistan
          </motion.span>
        </span>
      </h1>
      <motion.p className="h-lead" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7, ease: EASE }}>
        Find funding in <strong>China, Germany and Italy</strong>, see which published rules you meet, plan the real cost, and follow a step-by-step plan, with every fact linked to its official source.
      </motion.p>
      <motion.div className="h-actions" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7, ease: EASE }}>
        <a href="#scholarships" className="btn btn-primary btn-lg btn-pill"><Sparkles size={16} />Explore scholarships</a>
        <Link to="/route" className="btn btn-ghost btn-lg btn-pill btn-arrow">Check eligibility <ArrowRight size={16} /></Link>
      </motion.div>

      <div className="h-feature-row">
        {featured.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.08, duration: 0.6, ease: EASE }}>
            <Link to={`/scholarships/${s.id}`} className="h-feature">
              <span className="tag">Looks open · not verified</span>
              <span className="h-tile" style={{ background: TILE[s.country] ?? "#333" }} aria-hidden>{initials(s.provider)}</span>
              <span style={{ minWidth: 0 }}>
                <strong className="clamp1" style={{ display: "block", fontSize: 14.5 }}>{s.name}</strong>
                <span className="tiny">{COUNTRY[s.country]?.name} · deadline on official page {fmtDate(s.proposed_deadline)}</span>
              </span>
            </Link>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.86, duration: 0.6, ease: EASE }}>
          <Link to="/app/discover" className="h-feature h-feature-dash">
            <span className="h-tile" style={{ background: "#fff", color: "var(--brand-2)", border: "1px solid var(--mint-2)" }} aria-hidden><Compass size={17} /></span>
            <span>
              <strong style={{ display: "block", fontSize: 14.5 }}>Discover live</strong>
              <span className="tiny">Search official university pages for your profile</span>
            </span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────── catalogue table ───────── */

type Chip = { key: string; label: string; test: (s: any) => boolean; mint?: boolean };
const CHIPS: Chip[] = [
  { key: "all", label: "All", test: () => true },
  { key: "open", label: "Looks open now", mint: true, test: (s) => s.cycle_state === "open" || s.cycle_state === "upcoming" || s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING" },
  { key: "full", label: "Full funding", mint: true, test: (s) => s.funding_class === "full" },
  { key: "CN", label: "China", test: (s) => s.country === "CN" },
  { key: "DE", label: "Germany", test: (s) => s.country === "DE" },
  { key: "IT", label: "Italy", test: (s) => s.country === "IT" },
  { key: "bachelor", label: "Bachelor", test: (s) => (s.levels ?? []).includes("bachelor") },
  { key: "master", label: "Master", test: (s) => (s.levels ?? []).includes("master") },
  { key: "phd", label: "PhD", test: (s) => (s.levels ?? []).includes("phd") },
  { key: "continuing", label: "Already studying", test: (s) => s.applicant_type !== "new" },
  { key: "verified", label: "Reviewer verified", test: (s) => evidenceLevel(s) === 3 },
];
const PER_PAGE = 10;

function Promo({ to, icon, title, sub, cta }: { to: string; icon: ReactNode; title: string; sub: string; cta: string }) {
  return (
    <Link to={to} className="h-promo">
      <span className="h-tile" style={{ background: "#fff", color: "var(--brand-2)", border: "1px solid var(--mint-2)" }} aria-hidden>{icon}</span>
      <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 14 }}>{title}</strong><span className="tiny">{sub}</span></span>
      <span className="btn btn-primary btn-sm btn-pill btn-arrow" style={{ marginLeft: "auto" }}>{cta} <ArrowRight size={14} /></span>
    </Link>
  );
}

function Catalogue({ all }: { all: any[] | null }) {
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("all");
  const [page, setPage] = useState(1);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const c = CHIPS.find((x) => x.key === chip)!;
    return (all ?? []).filter((s) => !s.is_test_data && c.test(s) && (!t || `${s.name} ${s.provider} ${s.funding_summary ?? ""}`.toLowerCase().includes(t)));
  }, [all, q, chip]);
  useEffect(() => setPage(1), [q, chip]);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const rows = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <section id="scholarships" className="container" style={{ scrollMarginTop: 90 }}>
      <Rise>
        <div className="h-cat">
          <div className="h-search">
            <Search size={18} color="var(--ink-3)" />
            <input aria-label="Search scholarships" placeholder="Search scholarships, universities or cities" value={q} onChange={(e) => setQ(e.target.value)} />
            {q ? (
              <button className="btn btn-soft btn-sm icon-btn btn-pill" aria-label="Clear search" onClick={() => setQ("")}><X size={14} /></button>
            ) : (
              <span className="hint" aria-hidden><span>CSC</span><span>DAAD</span><span>Politecnico</span></span>
            )}
            <Link to="/scholarships" className="btn btn-ghost btn-sm btn-pill">Full catalogue</Link>
          </div>
          <div className="h-chips" role="group" aria-label="Filter scholarships">
            {CHIPS.map((c) => (
              <button key={c.key} className={`h-chip ${c.mint ? "mint" : ""}`} aria-pressed={chip === c.key} onClick={() => setChip(c.key)}>{c.label}</button>
            ))}
          </div>
          <div role="table" aria-label="Scholarships">
            <div className="h-thead" role="row">
              <span role="columnheader">Scholarship</span><span role="columnheader">Funding</span><span role="columnheader">Conditions</span>
              <span role="columnheader" title="How well-checked the record is, never your chances">Evidence</span><span role="columnheader" style={{ textAlign: "right" }}>Actions</span>
            </div>
            {!all && Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-row"><div className="skel" style={{ height: 30, gridColumn: "1 / -1" }} /></div>)}
            {all && rows.length === 0 && <p className="muted" style={{ padding: 24, textAlign: "center", borderTop: "1px solid var(--line)" }}>Nothing matches yet. Try another filter, or <Link to="/app/discover">search official pages live</Link>.</p>}
            <AnimatePresence mode="popLayout" initial={false}>
              {rows.map((s, i) => {
                const f = fundingAmount(s);
                return (
                  <motion.div key={s.id} layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, delay: i * 0.025, ease: EASE }}>
                    {i === 4 && <Promo to="/route" icon={<RouteIcon size={17} />} title="Not sure which of these fits you?" sub="Answer a few questions and get your routes, with the official evidence for each." cta="Find my route" />}
                    {i === 8 && <Promo to="/costs" icon={<Wallet size={17} />} title="Know the real cost before you apply" sub="Tuition, living, visa and deposits from official figures, in PKR." cta="Plan costs" />}
                    <div className="h-row" role="row">
                      <div className="c1 row" style={{ "--gap": "12px", flexWrap: "nowrap" } as any}>
                        <span className="h-tile" style={{ background: TILE[s.country] ?? "#333" }} aria-hidden>{initials(s.provider)}</span>
                        <div style={{ minWidth: 0 }}>
                          <Link to={`/scholarships/${s.id}`} className="nm clamp1">{s.name}</Link>
                          <span className="tiny">{COUNTRY[s.country]?.name} · {levelsText(s) || "levels n/a"}</span>
                        </div>
                      </div>
                      <div className="c2">
                        {f.big ? <div className="h-amount">{f.big}</div> : <div className="h-amount muted">{f.small}</div>}
                        {f.big && <span className="tiny">{f.small}</span>}
                      </div>
                      <div className="c3 h-cond clamp2">{s.funding_summary ?? s.status_reason ?? "See the official page for conditions."}</div>
                      <div className="c4"><Meter level={evidenceLevel(s)} delay={i * 0.03} /></div>
                      <div className="c5" style={{ textAlign: "right" }}>
                        <Link to={`/scholarships/${s.id}`} className="btn btn-primary h-get btn-arrow" aria-label={`View ${s.name}`}>View <ArrowRight size={13} /></Link>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {all && list.length > 0 && (
            <div className="h-pager">
              <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, list.length)} of {list.length} catalogued awards</span>
              <div className="pg">
                <button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">‹</button>
                {Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => setPage(n)}>{n}</button>)}
                <button disabled={page === pages} onClick={() => setPage(page + 1)} aria-label="Next page">›</button>
              </div>
            </div>
          )}
        </div>
      </Rise>
      <Rise delay={0.05}>
        <p className="tiny" style={{ textAlign: "center", marginTop: 14 }}>
          Evidence shows how well-checked a record is (lead → quoted from the official page → verified by a Raasta reviewer). It is never your chance of winning.
        </p>
      </Rise>
    </section>
  );
}

/* ───────── how it works ───────── */

function HowItWorks() {
  const steps = [
    [<RouteIcon key="r" size={18} />, "Answer a few questions", "Where you are, what you want to study, grades exactly as on your transcript. Skip anything you don't know."],
    [<ListChecks key="l" size={18} />, "Get routes with evidence", "Each rule shows met, not met or unknown, quoted from the official page. Missing information is never counted against you."],
    [<BookOpenCheck key="b" size={18} />, "Follow your plan", "Documents, deadlines in Pakistan time, English or MOI steps and real costs, saved to your dashboard."],
  ] as const;
  return (
    <Section className="container">
      <div className="h-how">
        <div>
          <Rise><div className="h-sec-head"><h2>How it works</h2><p>Every step is grounded in the official source, so you can check it yourself.</p></div></Rise>
          <div className="h-steps">
            {steps.map(([icon, t, d], i) => (
              <Rise key={t} delay={0.08 * i}>
                <div className="h-step"><div className="ic">{icon}</div><h3>{t}</h3><p>{d}</p></div>
              </Rise>
            ))}
          </div>
          <Rise delay={0.2}><Link to="/route" className="btn btn-primary btn-pill btn-arrow" style={{ marginTop: 32 }}>Start in two minutes <ArrowRight size={15} /></Link></Rise>
        </div>
        <Rise delay={0.1}>
          <div className="h-preview" aria-label="Example of route results (illustration)">
            <div className="row between" style={{ marginBottom: 12 }}><strong style={{ fontSize: 14 }}>Your routes · Master's</strong><span className="badge b-test">Illustration</span></div>
            {[
              ["Germany", "2 potential fits", "b-warn", [1, 1, 0]],
              ["Italy", "3 potential fits", "b-warn", [1, 1, 1]],
              ["China", "1 needs confirmation", "b-neutral", [1, 0, 0]],
            ].map(([c, t, tone, dots], i) => (
              <motion.div key={c as string} className="sunk row between" style={{ marginBottom: 8, flexWrap: "nowrap" } as any} initial={{ opacity: 0, x: 18 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.25 + i * 0.12, duration: 0.6, ease: EASE }}>
                <span className="row" style={{ "--gap": "10px" } as any}><Globe2 size={16} color="var(--ink-3)" /><strong style={{ fontSize: 14 }}>{c as string}</strong></span>
                <span className="row" style={{ "--gap": "8px" } as any}>
                  {(dots as number[]).map((d, j) => <span key={j} className="dot" style={{ color: d ? "var(--ok)" : "var(--line-2)" }} />)}
                  <span className={`badge ${tone}`}>{t as string}</span>
                </span>
              </motion.div>
            ))}
            {[
              ["Pakistani nationals eligible", "Met", "b-ok"],
              ["IELTS 6.5 or MOI letter", "Unknown", "b-neutral"],
              ["Deadline 15 Dec 2026, 16:00 PKT", "From official page", "b-info"],
            ].map(([t, s, tone], i) => (
              <motion.div key={t} className="row between" style={{ padding: "11px 4px", borderTop: "1px solid var(--line)", flexWrap: "nowrap" } as any} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.6 + i * 0.1 }}>
                <span style={{ fontSize: 13.5 }}>{t}</span><span className={`badge ${tone}`}>{s}</span>
              </motion.div>
            ))}
          </div>
        </Rise>
      </div>
    </Section>
  );
}

/* ───────── marquee of official sources (names only: we read them, we are not partnered) ───────── */

const SOURCES = ["DAAD", "HEC Pakistan", "Heinrich Böll Stiftung", "Politecnico di Milano", "Università di Padova", "Tsinghua University", "Peking University", "Beihang University", "ER.GO", "DSU Toscana", "Deutschlandstipendium", "KAAD", "Friedrich-Ebert-Stiftung", "Fudan University", "Zhejiang University", "LazioDISCO", "Study in Italy", "ANSO"];

function Marquee() {
  const items = [...SOURCES, ...SOURCES];
  return (
    <div>
      <p className="tiny" style={{ textAlign: "center", marginBottom: 14 }}>Official sources Raasta reads. Named for reference only: we are not partnered with them.</p>
      <div className="marquee" aria-label="Official sources Raasta reads">
        <div className="marquee-track">{items.map((n, i) => <span key={i} aria-hidden={i >= SOURCES.length}>{n}</span>)}</div>
      </div>
    </div>
  );
}

/* ───────── bento ───────── */

function Bento() {
  const chips = [
    [<Quote key="q" size={14} />, "Quotes word-for-word from official pages"],
    [<ShieldCheck key="s" size={14} />, "Never marked verified by a machine"],
    [<HelpCircle key="h" size={14} />, "Missing information = unknown, never a fail"],
  ] as const;
  return (
    <Section className="container">
      <Rise><div className="h-sec-head"><h2>Built on evidence, <em>not hype</em></h2><p>Raasta shows its work. Every number, date and rule comes with the sentence it was taken from.</p></div></Rise>
      <div className="bento">
        <Rise className="wide">
          <div style={{ height: "100%" }}>
            <FileSearch size={22} color="var(--brand-2)" />
            <h3>Live discovery with step-by-step guides</h3>
            <p style={{ maxWidth: 440 }}>Raasta reads official university pages and PDF calls for your profile: deadlines in Pakistan time, English or MOI rules for admission and the scholarship separately, a document checklist and a timeline.</p>
            <div className="row" style={{ marginTop: 18, "--gap": "8px" } as any}>
              {[[<Languages key="l" size={13} />, "MOI letter accepted"], [<FileText key="f" size={13} />, "Official PDF read"], [<Wallet key="w" size={13} />, "EUR 3,900 / year"]].map(([ic, t], i) => (
                <motion.span key={i} className="float-chip" animate={{ y: [0, -4, 0] }} transition={{ duration: 4 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.6 }}>{ic}{t as string}</motion.span>
              ))}
            </div>
          </div>
        </Rise>
        <Rise delay={0.08}>
          <div style={{ height: "100%" }}>
            <BadgeCheck size={22} color="var(--brand-2)" />
            <h3>Evidence index</h3>
            <p>How well-checked each record is. It is never your chance of winning.</p>
            <div className="stack" style={{ "--gap": "10px", marginTop: 18 } as any}>
              <Meter level={1} /><Meter level={2} delay={0.1} /><Meter level={3} delay={0.2} />
            </div>
          </div>
        </Rise>
        <Rise delay={0.04}>
          <div style={{ height: "100%" }}>
            <MessageSquareQuote size={22} color="var(--brand-2)" />
            <h3>Open and transparent</h3>
            <div className="stack" style={{ "--gap": "8px", marginTop: 14, alignItems: "flex-start" } as any}>
              {chips.map(([ic, t], i) => (
                <motion.span key={t} className="float-chip" style={{ marginLeft: i * 14 }} animate={{ y: [0, -5, 0] }} transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut", delay: i * 0.8 }}>{ic}{t}</motion.span>
              ))}
            </div>
          </div>
        </Rise>
        <Rise delay={0.08}>
          <div style={{ height: "100%" }}>
            <RefreshCw size={22} color="var(--brand-2)" />
            <h3>Watched for changes</h3>
            <p>Official pages are re-checked several times a day. When one changes, a person reviews it before anything you rely on changes.</p>
          </div>
        </Rise>
        <Rise delay={0.12}>
          <div style={{ height: "100%" }}>
            <PenLine size={22} color="var(--brand-2)" />
            <h3>Writing that stays yours</h3>
            <p>The Writing Studio follows each provider's rules: coaching or editing only where drafting help isn't allowed, and it never invents achievements.</p>
          </div>
        </Rise>
      </div>
    </Section>
  );
}

/* ───────── FAQ ───────── */

const FAQ: [ReactNode, string, string][] = [
  [<GraduationCap key="1" size={15} />, "Is Raasta a consultancy or an agent?", "No. Raasta is a self-service tool. You apply through official systems yourself, and we never ask for university portal passwords."],
  [<ShieldCheck key="2" size={15} />, "How do you know a scholarship is real and current?", "Every record links to its official source and shows when it was read. Research quotes official pages, but a record only shows as verified after a Raasta reviewer has checked the current call. Until then it is labelled “not yet verified”."],
  [<BadgeCheck key="3" size={15} />, "Will Raasta tell me my chances?", "No. We show which published rules you meet. Selection is competitive and decided by the provider, so we never show a probability of success."],
  [<Languages key="4" size={15} />, "I don't have IELTS. Can I use an MOI letter?", "Sometimes. Raasta checks each official page separately for admission and for the scholarship: IELTS only, other tests, MOI accepted, a waiver with approval, or not stated. We draft the request email; we never write the certificate."],
  [<Compass key="5" size={15} />, "Where do the scholarships come from?", "From official provider, university and government pages: a curated catalogue plus live discovery that reads official pages for your profile. Agent and forum sites are never used as evidence."],
  [<FileText key="6" size={15} />, "Will Raasta write my SOP?", "Only where the provider allows drafting help. Otherwise the Writing Studio limits itself to editing or coaching."],
  [<HelpCircle key="7" size={15} />, "What if something is wrong?", "Every scholarship page has a “Report an error” button. Reports go to a review queue and corrections keep their history."],
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section className="narrow">
      <Rise><div className="h-sec-head"><h2>Questions</h2></div></Rise>
      <div className="h-faq">
        {FAQ.map(([icon, q, a], i) => (
          <div key={q} className="h-faq-item">
            <button className="h-faq-q" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span className="qi">{icon}</span>{q}<ChevronDown size={18} className="chev" />
            </button>
            <AnimatePresence initial={false}>
              {open === i && (
                <motion.div className="h-faq-a" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                  <p>{a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ───────── mint band (honest: no fake reviews or follower counts) ───────── */

const DOTS = [[6, 22], [12, 62], [20, 36], [28, 74], [72, 26], [80, 64], [88, 38], [94, 72], [16, 84], [84, 86], [4, 48], [96, 52]];

function MintBand() {
  return (
    <section className="mint-band">
      <div className="mint-dots" aria-hidden>
        {DOTS.map(([x, y], i) => (
          <motion.i key={i} style={{ left: `${x}%`, top: `${y}%` }} initial={{ opacity: 0, scale: 0.6 }} whileInView={{ opacity: 0.7, scale: 1 }} viewport={{ once: true }} animate={{ y: [0, -8, 0] }} transition={{ opacity: { delay: i * 0.05 }, scale: { delay: i * 0.05 }, y: { duration: 5 + (i % 4), repeat: Infinity, ease: "easeInOut" } }} />
        ))}
      </div>
      <div className="container" style={{ position: "relative" }}>
        <Rise><h2>Made for students who do the work themselves</h2></Rise>
        <Rise delay={0.1}>
          <div className="mint-card">
            <Logo size={40} />
            <h3 style={{ fontFamily: "var(--serif)", fontSize: 26, fontWeight: 400, margin: "12px 0 4px" }}>Raasta</h3>
            <p className="subtle">Free while in beta · no agent fees</p>
            <Link to="/signup" className="btn btn-primary btn-pill btn-arrow" style={{ marginTop: 18, width: "100%" }}>Create a free account <ArrowRight size={15} /></Link>
          </div>
        </Rise>
        <Rise delay={0.15}><p className="subtle" style={{ marginTop: 22 }}>No fake reviews or follower counts. Raasta is new: judge it by its sources.</p></Rise>
      </div>
    </section>
  );
}

/* ───────── live numbers ───────── */

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: EASE, onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v.toLocaleString("en-GB")}</span>;
}

function Numbers() {
  const { data } = useApi<{ sources: number; scholarships: number; discoveries: number; costFigures: number; asOf: string }>("/stats");
  const items: [keyof NonNullable<typeof data>, string][] = [
    ["sources", "Official sources tracked"],
    ["scholarships", "Scholarship records"],
    ["discoveries", "Official pages discovered"],
    ["costFigures", "Official cost figures"],
  ];
  return (
    <section className="night">
      <div className="container">
        <Rise>
          <h2>The numbers behind Raasta</h2>
          <p className="label-n">Live from our database{data ? `, ${fmtDate(data.asOf)}` : ""}. Coverage is still growing; an award missing here may still exist.</p>
        </Rise>
        <div className="night-stats">
          {items.map(([k, label], i) => (
            <Rise key={k} delay={i * 0.06}>
              <div className="v">{data ? <CountUp to={Number(data[k])} /> : "–"}</div>
              <div className="k">{label}</div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────── page ───────── */

export function Home() {
  const { data } = useApi<{ scholarships: any[] }>("/scholarships");
  const all = data?.scholarships ?? null;
  const featured = useMemo(
    () =>
      (all ?? [])
        .filter((s) => !s.is_test_data && (s.cycle_state === "open" || s.cycle_state === "upcoming") && s.proposed_deadline && s.proposed_deadline >= today)
        .sort((a, b) => a.proposed_deadline.localeCompare(b.proposed_deadline))
        .slice(0, 2),
    [all],
  );
  return (
    <>
      <Hero featured={featured} />
      <Catalogue all={all} />
      <HowItWorks />
      <Marquee />
      <Bento />
      <Faq />
      <MintBand />
      <Numbers />
    </>
  );
}
