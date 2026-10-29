import { motion } from "motion/react";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Copy, ExternalLink, FileCheck2, Languages, ListChecks, Search, Wallet } from "lucide-react";
import { Notice, Skeleton, stagger, useToast } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { Link, useRouter } from "../../lib/router";
import { COUNTRY, fmtDate, useApi } from "../../lib/use";
import { useAuth } from "../../lib/auth";

const ELIG: Record<string, [string, string]> = {
  LOOKS_POSSIBLE: ["Eligibility: looks possible", "b-warn"],
  NEEDS_CONFIRMATION: ["Eligibility: needs confirmation", "b-neutral"],
  LIKELY_NOT_FOR_YOU: ["Eligibility: likely not for you", "b-bad"],
};
const VERIF: Record<string, [string, string]> = {
  NOT_VERIFIED: ["Not verified", "b-neutral"],
  REVIEWER_CONFIRMED: ["Reviewer checked", "b-ok"],
  CONFLICTING: ["Conflicting details", "b-bad"],
};
const CYCLE: Record<string, string> = { DEADLINE_AHEAD: "Deadline ahead", DEADLINE_PASSED: "Deadline passed", SEVERAL_DATES: "Several dates", UNKNOWN: "Deadline unknown" };
const ENGLISH: Record<string, string> = {
  IELTS_REQUIRED: "IELTS required",
  ALTERNATIVE_TESTS: "Other tests accepted",
  MOI_ACCEPTED: "MOI letter accepted",
  WAIVER_WITH_APPROVAL: "Waiver possible with approval",
  NOT_STATED: "Not stated on this page",
  UNKNOWN_OR_CONFLICTING: "Unclear or conflicting",
};
const HOW: Record<string, string> = { html: "read", pdf: "official PDF read", pasted: "text pasted by a Raasta reviewer" };
const TIER: Record<string, string> = { registered: "Registered official source", listed: "Official domain", pattern: "University-style domain (reviewer checks)" };
const fmtMoney = (n: number, c: string) => `${c} ${n.toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;
const UNIT: Record<string, string> = { once: "one-time", year: "/ year", semester: "/ semester", month: "/ month", unknown: "(frequency not stated)" };

const Quote = ({ children }: { children: ReactNode }) => (
  <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--line-2)", fontSize: 13.5, color: "var(--ink-2)" }}>"{children}"</blockquote>
);

export function Discover() {
  const isAdmin = useAuth().user?.role === "admin";
  const prof = useApi<{ profile: any }>("/me/profile");
  const status = useApi<any>("/me/discover/status");
  const latest = useApi<any>("/me/discover/latest");
  const [countries, setCountries] = useState<string[]>([]);
  const [level, setLevel] = useState("master");
  const [field, setField] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const p = prof.data?.profile;
    if (!p) return;
    setCountries((p.targetCountries?.length ? p.targetCountries : ["DE", "IT"]).slice(0, 4));
    if (p.targetLevel) setLevel(p.targetLevel);
    if (p.targetField) setField(p.targetField);
  }, [prof.data]);
  useEffect(() => {
    if (latest.data?.run && !result) setResult({ ...latest.data.run, items: latest.data.items });
  }, [latest.data]);

  if (prof.loading || status.loading) return <Skeleton h={420} />;
  const profile = prof.data?.profile ?? {};
  const tests = (profile.languageTests ?? []) as { test: string; score: number }[];

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const body = { profile: { ...profile, targetLevel: level, targetField: field.trim() || undefined, targetCountries: countries }, countries };
      setResult(await api.post("/me/discover", body));
      status.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Search failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ "--gap": "22px" } as any}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Discover</h1>
          <p className="muted" style={{ maxWidth: 720 }}>
            Raasta reads official university and scholarship pages for your profile and shows what each page actually says, quoted word for word.
            Nothing here is verified until a Raasta reviewer checks it. Always confirm on the official page.
          </p>
        </div>
      </div>

      {/* Provider, quota and coverage details are operational: admins only. Students just search. */}
      {status.data && isAdmin && (
        <Notice kind={status.data.openWebSearch ? "info" : "warn"}>
          {status.data.openWebSearch
            ? <span>Searching official websites with {status.data.provider} and Raasta's registered sources. Searches used this month: {status.data.usedThisMonth} of {status.data.monthlyCap} (a hard stop keeps it free).</span>
            : <span>Open-web search isn't connected yet, so only Raasta's registered official sources and the links on them are read. Results are real, but this can't find pages on other sites yet.</span>}
        </Notice>
      )}

      <section className="panel stack" style={{ "--gap": "16px" } as any} aria-label="Search settings">
        <div className="field">
          <span>Countries</span>
          <div className="chips" role="group" aria-label="Countries">
            {(["DE", "IT", "CN", "KR"] as const).map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={countries.includes(c)}
                onClick={() => setCountries((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>{COUNTRY[c].name}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-2" style={{ gap: 14 }}>
          <label className="field"><span>Degree you want</span>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="bachelor">Bachelor</option><option value="master">Master</option><option value="phd">PhD</option>
            </select>
          </label>
          <label className="field"><span>Field (optional)</span>
            <input className="input" value={field} maxLength={120} placeholder="e.g. computer science" onChange={(e) => setField(e.target.value)} />
          </label>
        </div>
        <p className="tiny">
          English tests in your profile: {tests.length ? tests.map((t) => `${t.test} ${t.score}`).join(", ") : "none"} · <Link to="/app/profile">Edit profile</Link>
        </p>
        {countries.includes("CN") && <p className="tiny">China: the main CSC portal (campuschina.org) blocks automated reading, so results for China are limited.</p>}
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={busy || countries.length === 0} onClick={run}>
          <Search size={16} />{busy ? "Reading official pages… (up to a minute)" : "Search official sources"}
        </button>
        {error && <Notice kind="bad">{error}</Notice>}
      </section>

      {busy && <Skeleton h={220} />}
      {!busy && result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: any }) {
  return (
    <section className="stack" style={{ "--gap": "14px" } as any} aria-label="Discovery results">
      <div className="row between">
        <h2 style={{ fontSize: 22 }}>{result.items.length} page{result.items.length === 1 ? "" : "s"} found</h2>
        <span className="tiny">Searched {fmtDate(result.createdAt)} · {result.providers.map((p: string) => (p === "tavily" ? "open-web search" : "official-source crawl")).join(" + ")}</span>
      </div>
      {result.notes?.length > 0 && (
        <details className="tiny"><summary>What happened during this search ({result.notes.length})</summary>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{result.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}</ul>
        </details>
      )}
      {result.items.length === 0 && <Notice kind="info">No official page with usable details was found this time. That doesn't mean nothing exists. Try another country or field, or check the catalogue.</Notice>}
      <motion.div className="stack" style={{ "--gap": "14px" } as any} variants={stagger.container} initial="hidden" animate="show">
        {result.items.map((it: any) => <ResultCard key={it.id} item={it} />)}
      </motion.div>
    </section>
  );
}

function ResultCard({ item }: { item: any }) {
  const [open, setOpen] = useState(false);
  const ev = item.evaluation;
  const [eLabel, eTone] = ELIG[ev.eligibility.value];
  const [vLabel, vTone] = VERIF[ev.verification.value];
  const d = ev.cycle.deadline;
  return (
    <motion.article variants={stagger.item} className="panel stack" style={{ "--gap": "12px" } as any} aria-label={item.title}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ "--gap": "4px" } as any}>
          <h3 style={{ fontFamily: "var(--serif)", fontSize: 20 }}>{item.title}</h3>
          <a className="tiny row" style={{ "--gap": "5px" } as any} href={item.url} target="_blank" rel="noopener noreferrer nofollow">{item.host}<ExternalLink size={12} /></a>
          <span className="tiny">{TIER[item.hostTier]} · {HOW[item.sourceFormat] ?? "read"} {fmtDate(item.fetchedAt)}</span>
        </div>
        {item.country && COUNTRY[item.country] && <span className={`flag flag-${item.country}`}>{item.country}</span>}
      </div>
      <div className="row" style={{ "--gap": "6px", flexWrap: "wrap" } as any} aria-label="Status">
        <span className={`badge ${eTone}`}>{eLabel}</span>
        <span className="badge b-neutral" title={ev.competitiveness.reason}>Chances: not estimated</span>
        <span className="badge b-neutral">Readiness: {ev.readiness.stepsLeft} step{ev.readiness.stepsLeft === 1 ? "" : "s"} left</span>
        <span className={`badge ${vTone}`}>{vLabel}</span>
        <span className="badge b-neutral">{CYCLE[ev.cycle.value]}</span>
      </div>
      <div className="grid grid-2" style={{ gap: 10 }}>
        <div className="sunk stack" style={{ "--gap": "4px" } as any}>
          <span className="row tiny" style={{ "--gap": "6px" } as any}><CalendarClock size={13} />Deadline</span>
          <strong>{d ? `${fmtDate(d.date)}${d.time ? ` · ${d.time}` : ""}` : "Not found on this page"}</strong>
          {d && <span className="tiny">{d.timezone ? d.timezone.label : "Timezone not stated"}{ev.cycle.pakistanTime ? ` · ${ev.cycle.pakistanTime}` : ""}</span>}
        </div>
        <div className="sunk stack" style={{ "--gap": "4px" } as any}>
          <span className="row tiny" style={{ "--gap": "6px" } as any}><Languages size={13} />English</span>
          <span className="tiny"><strong>Admission:</strong> {ENGLISH[ev.english[0].state]}</span>
          <span className="tiny"><strong>Scholarship:</strong> {ENGLISH[ev.english[1].state]}</span>
        </div>
      </div>
      {ev.nextAction && <p className="tiny"><strong>Next step:</strong> {ev.nextAction.title}{ev.nextAction.due ? ` (by ${fmtDate(ev.nextAction.due)})` : ""}</p>}
      <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{open ? "Hide details" : "Details, documents and plan"}
      </button>
      {open && <Detail id={item.id} />}
    </motion.article>
  );
}

function Detail({ id }: { id: string }) {
  const { data, error } = useApi<any>(`/me/discoveries/${id}`);
  const toast = useToast();
  const { go } = useRouter();
  const [saving, setSaving] = useState(false);
  if (error) return <Notice kind="bad">{error}</Notice>;
  if (!data) return <Skeleton h={200} />;
  const it = data.discovery;
  const ev = it.evaluation;
  const x = it.extract;
  const showEmails = ev.english.some((e: any) => ["MOI_ACCEPTED", "WAIVER_WITH_APPROVAL", "UNKNOWN_OR_CONFLICTING", "NOT_STATED"].includes(e.state));

  async function save() {
    setSaving(true);
    try {
      const r = await api.post(`/me/discoveries/${id}/roadmap`);
      toast(r.created ? "Saved to your applications as an unverified lead" : "Already in your applications");
      go(`/app/applications/${r.applicationId}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }
  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => toast("Copied"), () => toast("Copy failed: select the text instead"));

  return (
    <div className="stack" style={{ "--gap": "18px", borderTop: "1px solid var(--line)", paddingTop: 16 } as any}>
      <Notice kind="warn">{ev.verification.reason} {it.sourceFormat === "pdf" ? "Raasta read this official PDF (converted to text) on" : it.sourceFormat === "pasted" ? "A Raasta reviewer copied this text from the official page on" : "Raasta read this page on"} {fmtDate(it.fetchedAt)}; it may have changed since.</Notice>
      {it.conflicts.length > 0 && (
        <Block title="Conflicts to check" icon={<ListChecks size={15} />}>
          {it.conflicts.map((c: any, i: number) => <div key={i} className="stack" style={{ "--gap": "6px" } as any}><span className="tiny">{c.detail}</span>{c.quotes.map((q: string, j: number) => <Quote key={j}>{q}</Quote>)}</div>)}
        </Block>
      )}

      <Block title="Eligibility (from this page only)" icon={<FileCheck2 size={15} />}>
        <ul className="tiny" style={{ margin: 0, paddingLeft: 18 }}>{ev.eligibility.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
        {x.levels.slice(0, 2).map((l: any) => <Quote key={l.value}>{l.quote}</Quote>)}
        {x.mentions.pakistan && <Quote>{x.mentions.pakistan}</Quote>}
        <p className="tiny">{ev.competitiveness.reason}</p>
      </Block>

      <Block title="Deadline" icon={<CalendarClock size={15} />}>
        {x.deadlines.length === 0 && <p className="tiny">No deadline found next to deadline wording on this page. Don't assume one; check the page or ask the office.</p>}
        {x.deadlines.map((d: any) => (
          <div key={d.date} className="stack" style={{ "--gap": "4px" } as any}>
            <span className="tiny"><strong>{fmtDate(d.date)}</strong>{d.opens ? ` (opens ${fmtDate(d.opens)})` : ""}{d.time ? ` · ${d.time}` : " · time not stated"} · {d.timezone ? d.timezone.label : "timezone not stated"}</span>
            <Quote>{d.quote}</Quote>
          </div>
        ))}
        {ev.cycle.pakistanTime && <p className="tiny">In Pakistan time: <strong>{ev.cycle.pakistanTime}</strong></p>}
        {x.otherDates.length > 0 && (
          <details className="tiny"><summary>Other dates on this page (not identified as deadlines)</summary>
            {x.otherDates.map((o: any) => <div key={o.value} style={{ marginTop: 6 }}><strong>{fmtDate(o.value)}</strong><Quote>{o.quote}</Quote></div>)}
          </details>
        )}
      </Block>

      <Block title="English requirement (admission and scholarship checked separately)" icon={<Languages size={15} />}>
        {ev.english.map((e: any) => (
          <div key={e.scope} className="sunk stack" style={{ "--gap": "6px" } as any}>
            <span className="tiny"><strong>{e.scope === "admission" ? "Admission" : "Scholarship"}:</strong> {ENGLISH[e.state]}{e.youMeet !== "unknown" ? ` · your score ${e.youMeet === "yes" ? "meets" : "is below"} the minimum on the page` : ""}</span>
            <span className="tiny">{e.reason}</span>
            <span className="tiny"><strong>What to do:</strong> {e.advice}</span>
            {e.quotes.map((q: string, i: number) => <Quote key={i}>{q}</Quote>)}
          </div>
        ))}
        {showEmails && (
          <details>
            <summary className="tiny">Email drafts: ask for an MOI letter, or ask the office (requests only; Raasta never writes certificates)</summary>
            {[["MOI letter request to your university", it.emails.moiRequest], ["Question to the admissions office", it.emails.askOffice]].map(([label, text]) => (
              <div key={label} className="stack" style={{ "--gap": "6px", marginTop: 10 } as any}>
                <div className="row between"><strong className="tiny">{label}</strong><button className="btn btn-ghost btn-sm" onClick={() => copy(text)}><Copy size={13} />Copy</button></div>
                <pre className="sunk" style={{ whiteSpace: "pre-wrap", fontSize: 13, margin: 0, fontFamily: "inherit" }}>{text}</pre>
              </div>
            ))}
          </details>
        )}
      </Block>

      <Block title="Fees found on this page" icon={<Wallet size={15} />}>
        {ev.fees.totals.length === 0 && ev.fees.excluded.length === 0 && <p className="tiny">No fees stated on this page.</p>}
        {ev.fees.totals.map((t: any) => (
          <div key={t.currency} className="stack" style={{ "--gap": "4px" } as any}>
            <strong>{fmtMoney(t.total, t.currency)} for {t.years} years</strong>
            {t.parts.map((f: any, i: number) => <div key={i}><span className="tiny">{f.category.replace("_", " ")}: {fmtMoney(f.amount, f.currency)} {UNIT[f.unit]}</span><Quote>{f.quote}</Quote></div>)}
          </div>
        ))}
        {ev.fees.excluded.length > 0 && <p className="tiny">Not added (frequency not stated): {ev.fees.excluded.map((f: any) => fmtMoney(f.amount, f.currency)).join(", ")}</p>}
        {ev.fees.benefits.length > 0 && <p className="tiny">Scholarship benefits on the page (income, not a cost): {ev.fees.benefits.map((f: any) => `${fmtMoney(f.amount, f.currency)} ${UNIT[f.unit]}`).join(", ")}</p>}
        <p className="tiny">{ev.fees.note} <Link to="/costs">Open the Cost Planner</Link></p>
      </Block>

      <Block title="Document checklist" icon={<ListChecks size={15} />}>
        {ev.checklist.length === 0 && <p className="tiny">No documents listed on this page. The full list is usually in the official call.</p>}
        <p className="tiny">General guidance. The official call decides. "Found on the page" is the exact text.</p>
        {ev.checklist.map((c: any) => (
          <details key={c.key} className="sunk">
            <summary><strong>{c.label}</strong></summary>
            <dl className="tiny" style={{ display: "grid", gridTemplateColumns: "minmax(90px, max-content) 1fr", gap: "4px 12px", margin: "10px 0" }}>
              {[["What", c.what], ["Why", c.why], ["Issued by", c.issuer], ["How", c.how], ["Translation", c.translation], ["Legalization", c.legalization], ["Validity", c.validity], ["Format", c.formatOnPage.length ? `Stated on page: ${c.formatOnPage.join(", ")}` : "Not stated on this page"], ["Fee", c.fee], ["Upload", c.upload], ["Deadline", c.deadline]].map(([k, v]) => (
                <Fragment key={k}><dt style={{ fontWeight: 600 }}>{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>
              ))}
            </dl>
            <Quote>{c.foundQuote}</Quote>
          </details>
        ))}
      </Block>

      <Block title="Your timeline" icon={<CalendarClock size={15} />}>
        <ol className="tiny" style={{ margin: 0, paddingLeft: 18 }}>
          {ev.timeline.map((s: any) => <li key={s.key} style={{ marginBottom: 6 }}><strong>{s.title}</strong>{s.due ? `, by ${fmtDate(s.due)}` : ""}<br />{s.why}{s.buffer ? " (Raasta planning date, not an official one.)" : ""}</li>)}
        </ol>
      </Block>

      <div className="row" style={{ "--gap": "10px", flexWrap: "wrap" } as any}>
        <button className="btn btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save to my roadmap"}</button>
        <a className="btn btn-ghost" href={it.url} target="_blank" rel="noopener noreferrer nofollow">Open the official page <ExternalLink size={14} /></a>
      </div>
    </div>
  );
}

function Block({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="stack" style={{ "--gap": "8px" } as any}>
      <h4 className="row" style={{ "--gap": "7px", fontSize: 15 } as any}>{icon}{title}</h4>
      {children}
    </section>
  );
}
