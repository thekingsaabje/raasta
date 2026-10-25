import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, History, Pencil, Printer, RotateCcw, Save } from "lucide-react";
import { Page } from "../components/Layout";
import { Modal, Notice, Skeleton, useToast } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link, useRouter } from "../lib/router";
import { fmtDate, useApi } from "../lib/use";
import { CATEGORY_LABEL, plan, type Rates } from "../../shared/planner";
import { Conversation, stepsFor } from "./costs/Conversation";
import { Results } from "./costs/Results";
import { STAGE_LABEL, money } from "./costs/bits";
import { answersFrom, contextOf, emptyAnswers, toInput, type Answers, type Reference } from "./costs/model";

const DRAFT_KEY = "raasta.costplan.draft.v1";
const COUNTRY = { CN: "China", DE: "Germany", IT: "Italy" } as const;

function loadDraft(): Answers | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...emptyAnswers(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}

export function Costs() {
  const { user } = useAuth();
  const { search, go } = useRouter();
  const toast = useToast();
  const planParam = search.get("plan");
  const [answers, setAnswers] = useState<Answers>(() => loadDraft() ?? emptyAnswers());
  const [phase, setPhase] = useState<"intro" | "chat" | "results">("intro");
  const [chatStart, setChatStart] = useState(0);
  const [planId, setPlanId] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const hasDraft = useMemo(() => !!loadDraft()?.country, []);

  const rates = useApi<{ rates: Record<string, number>; source: string | null; date: string | null; stale: boolean }>("/planner/rates");
  const refs = useApi<{ references: Reference[] }>(answers.country ? `/planner/references?country=${answers.country}` : null);
  const sch = useApi<{ scholarships: any[] }>("/scholarships");
  const saved = useApi<{ versions: any[] }>(user && (planParam || planId) ? `/me/plans/${planParam ?? planId}` : null);

  // Open a saved plan from the dashboard (?plan=…).
  useEffect(() => {
    if (!planParam || !saved.data?.versions?.length) return;
    const v = saved.data.versions[0];
    setAnswers(answersFrom(v.inputs.input, v.inputs.context ?? {}));
    setPlanId(v.plan_id);
    setVersion(v.version);
    setPhase("results");
  }, [planParam, saved.data]);

  // Keep a private draft in this browser only (never sent anywhere until the student saves).
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    } catch {
      /* storage unavailable: planner still works */
    }
  }, [answers]);

  const set = (fn: (a: Answers) => Answers) => setAnswers((a) => fn(a));
  const liveRates = { rates: rates.data?.rates ?? {}, source: rates.data?.source ?? null, date: rates.data?.date ?? null, stale: rates.data?.stale ?? true };
  const ratesObj: Rates = { pkrPer: { ...liveRates.rates, ...answers.rateOverrides }, source: liveRates.source ?? "your own rates", date: liveRates.date };
  const quick = useMemo(() => plan(toInput(answers, { pkrPer: liveRates.rates, source: liveRates.source ?? "", date: liveRates.date })), [answers, liveRates.rates]);
  const references = refs.data?.references ?? [];

  const reset = () => {
    if (!confirm("Start over? This clears the answers in this browser (saved plans are kept).")) return;
    setAnswers(emptyAnswers());
    setPlanId(null);
    setVersion(null);
    setPhase("intro");
    go("/costs", true);
  };

  const exportSummary = () => {
    const r = plan(toInput(answers, { pkrPer: liveRates.rates, source: liveRates.source ?? "", date: liveRates.date }));
    const m = (v: number) => money(v, answers.display, ratesObj);
    const lines = [
      `# Raasta cost plan — ${answers.country ? COUNTRY[answers.country] : ""} ${answers.level ?? ""} (${answers.months ?? "?"} months)`,
      `Generated ${new Date().toISOString().slice(0, 10)}. Exchange rates: ${ratesObj.source}${ratesObj.date ? `, ${ratesObj.date.slice(0, 10)}` : ""}. Estimates, not guarantees.`,
      "",
      ...r.scenarios.flatMap((s) => [`## ${s.title}`, `- Programme cost: ${m(s.programmeCost)}`, `- Scholarship covers: ${m(s.covered)}`, `- You still pay: ${m(s.remaining)} (first year ${m(s.remainingFirstYear)})`, `- Cash before/on arrival: ${m(s.upfrontCash)}`, `- Funding gap vs your funds: ${m(s.gap)}`, ...s.stages.map((st) => `  - ${STAGE_LABEL[st.stage]}: ${m(st.amount)}`), ""]),
      "## Cost lines",
      ...answers.costs.map((c) => `- ${c.label} (${CATEGORY_LABEL[c.category]}): ${c.amount === null ? "unknown" : `${c.amount} ${c.currency} ${c.freq}`} — ${c.source.status}${c.source.url ? ` — ${c.source.url}` : ""}`),
      "",
      "## Notes",
      ...r.conclusion.map((x) => `- ${x}`),
      ...r.missing.map((x) => `- Missing: ${x}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "raasta-cost-plan.md" }).click();
    URL.revokeObjectURL(url);
  };

  if (planParam && user && saved.loading) return <Page><Skeleton h={400} /></Page>;

  return (
    <Page>
      <div className="page-head no-print">
        <div>
          <h1>Cost Planner</h1>
          <p className="lead">What studying abroad really costs, with and without a scholarship, and how much cash you need at each stage.</p>
        </div>
        {phase !== "intro" && (
          <div className="row">
            {phase === "results" && <button className="btn btn-ghost btn-sm" onClick={() => { setChatStart(0); setPhase("chat"); }}><Pencil size={14} />Edit answers</button>}
            <button className="btn btn-link btn-sm" onClick={reset}><RotateCcw size={14} />Start over</button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {phase === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid grid-2" style={{ gap: 28, alignItems: "center" }}>
            <div className="stack" style={{ "--gap": "18px" } as any}>
              <h2>About 10 quick questions. Three clear answers.</h2>
              <ol className="muted" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.9, fontSize: 15.5 }}>
                <li>What it costs <strong>without</strong> a scholarship</li>
                <li>How <strong>potential</strong> scholarships could change that (never counted as money you have)</li>
                <li>What you still pay with a <strong>confirmed</strong> award</li>
              </ol>
              <p className="subtle">Official figures are used where we have them and every number shows where it came from. No bank statements, passports or logins needed.</p>
              <p className="tiny">Your answers are kept as a draft in this browser only. On a shared computer, use "Start over" when you're done.</p>
              <div className="row">
                <button className="btn btn-primary btn-lg" onClick={() => { setAnswers(emptyAnswers()); setChatStart(0); setPhase("chat"); }}>Start planning <ArrowRight size={16} /></button>
                {hasDraft && <button className="btn btn-ghost btn-lg" onClick={() => { setChatStart(Math.max(0, stepsFor(answers).length - 1)); setPhase(answers.costs.length ? "results" : "chat"); }}>Continue where you left off</button>}
              </div>
            </div>
            <div className="panel" style={{ boxShadow: "var(--shadow-float)" }}>
              <div className="label" style={{ marginBottom: 12 }}>Example output · illustration</div>
              {[["Without a scholarship", "b-neutral"], ["If awarded: a potential award", "b-warn"], ["With a confirmed award", "b-ok"]].map(([t, b]) => (
                <div key={t} className="row between" style={{ padding: "12px 0", borderTop: "1px solid var(--line)" }}><span style={{ fontWeight: 500 }}>{t}</span><span className={`badge ${b}`}>{b === "b-warn" ? "Potential" : b === "b-ok" ? "Confirmed" : "Baseline"}</span></div>
              ))}
              <p className="tiny" style={{ marginTop: 10 }}>Each shows the programme cost, what's covered, what you still pay, cash needed before arrival and your funding gap.</p>
            </div>
          </motion.div>
        )}

        {phase === "chat" && (
          <motion.div key="chat" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="planner-shell">
            <Conversation answers={answers} set={set} refs={references} scholarships={sch.data?.scholarships ?? []} onDone={() => setPhase("results")} startAt={chatStart} />
            <aside className="panel stack no-print" style={{ position: "sticky", top: 92, "--gap": "10px" } as any} aria-live="polite">
              <div className="label">Running estimate</div>
              <div className="tiny">Without a scholarship, whole programme</div>
              <div className="stat" style={{ fontSize: 28 }}>{money(quick.scenarios[0].programmeCost, answers.display, ratesObj)}</div>
              <div className="tiny">First year {money(quick.scenarios[0].firstYearCost, answers.display, ratesObj)}</div>
              <div className="divider" />
              <div className="tiny">{answers.costs.length} cost lines · {quick.missing.length} unknown</div>
              {references.length > 0 && <div className="tiny">{references.filter((r) => r.status === "VERIFIED").length} official figures available for {answers.country ? COUNTRY[answers.country] : ""}</div>}
            </aside>
          </motion.div>
        )}

        {phase === "results" && (
          <motion.div key="results" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="stack" style={{ "--gap": "18px" } as any}>
            {!answers.country && <Notice kind="info">Tip: answer the questions for country-specific official figures. <button className="btn btn-link btn-sm" onClick={() => setPhase("chat")}>Start the questions</button></Notice>}
            <div className="row between no-print">
              <div className="row" style={{ "--gap": "8px" } as any}>
                {answers.country && <span className={`flag flag-${answers.country}`}>{answers.country}</span>}
                <strong>{[answers.country && COUNTRY[answers.country], answers.level && (answers.level === "phd" ? "PhD" : answers.level === "master" ? "Master's" : "Bachelor's"), answers.university].filter(Boolean).join(" · ") || "Your plan"}</strong>
                {version && <span className="badge b-neutral">Saved · version {version}</span>}
              </div>
              <div className="row" style={{ "--gap": "6px" } as any}>
                {planId && <button className="btn btn-ghost btn-sm" onClick={() => setHistoryOpen(true)}><History size={14} />Versions</button>}
                <button className="btn btn-ghost btn-sm" onClick={exportSummary}><Download size={14} />Export summary</button>
                <button className="btn btn-ghost btn-sm" onClick={() => print()}><Printer size={14} />Print</button>
                {user ? <button className="btn btn-primary btn-sm" onClick={() => setSaveOpen(true)}><Save size={14} />{planId ? "Save new version" : "Save to dashboard"}</button> : <Link to="/signup" className="btn btn-primary btn-sm">Sign up to save</Link>}
              </div>
            </div>
            {rates.loading ? <Skeleton h={300} /> : <Results answers={answers} set={set} refs={references} liveRates={liveRates} />}
          </motion.div>
        )}
      </AnimatePresence>

      {user && <SaveModal open={saveOpen} onClose={() => setSaveOpen(false)} answers={answers} planId={planId} liveRates={liveRates} onSaved={(id, v) => { setPlanId(id); setVersion(v); saved.reload(); toast(v > 1 ? `Saved as version ${v}. Earlier versions are kept.` : "Saved to your dashboard"); }} />}
      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Saved versions">
        <div className="stack">
          {(saved.data?.versions ?? []).map((v: any) => (
            <div key={v.version} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
              <span><strong>Version {v.version}</strong><br /><span className="tiny">{fmtDate(v.created_at)} · gap without scholarship {money(v.summary.scenarios[0].gap, answers.display, ratesObj)}</span></span>
              <button className="btn btn-soft btn-sm" onClick={() => { setAnswers(answersFrom(v.inputs.input, v.inputs.context ?? {})); setVersion(v.version); setHistoryOpen(false); toast(`Loaded version ${v.version}. Saving creates a new version.`); }}>Load</button>
            </div>
          ))}
        </div>
      </Modal>
    </Page>
  );
}

function SaveModal({ open, onClose, answers, planId, liveRates, onSaved }: { open: boolean; onClose: () => void; answers: Answers; planId: string | null; liveRates: { rates: Record<string, number>; source: string | null; date: string | null }; onSaved: (planId: string, version: number) => void }) {
  const apps = useApi<{ applications: any[] }>(open ? "/me/applications" : null);
  const [title, setTitle] = useState("");
  const [appId, setAppId] = useState("");
  const [asNew, setAsNew] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (open && !title) setTitle([answers.country && COUNTRY[answers.country], answers.level && (answers.level === "phd" ? "PhD" : answers.level === "master" ? "Master's" : "Bachelor's"), "cost plan"].filter(Boolean).join(" "));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setErr(null);
    try {
      const r = await api.post("/me/plans", {
        planId: planId && !asNew ? planId : undefined,
        title,
        country: answers.country ?? null,
        applicationId: appId || null,
        input: toInput(answers, { pkrPer: liveRates.rates, source: liveRates.source ?? "your own rates", date: liveRates.date }),
        context: contextOf(answers),
      });
      onSaved(r.planId, r.version);
      onClose();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={planId && !asNew ? "Save a new version" : "Save to your dashboard"}>
      <div className="stack">
        <label className="field"><span>Name</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></label>
        <label className="field"><span>Link to an application (optional)</span>
          <select className="input" value={appId} onChange={(e) => setAppId(e.target.value)}><option value="">Not linked</option>{apps.data?.applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}</select>
        </label>
        {planId && <label className="row tiny"><input type="checkbox" checked={asNew} onChange={(e) => setAsNew(e.target.checked)} />Save as a separate new plan instead</label>}
        <p className="tiny">Saved privately to your account. Changing assumptions never changes a scholarship's or application's official status.</p>
        {err && <Notice kind="bad">{err}</Notice>}
        <button className="btn btn-primary" disabled={!title.trim()} onClick={save}>Save</button>
      </div>
    </Modal>
  );
}
