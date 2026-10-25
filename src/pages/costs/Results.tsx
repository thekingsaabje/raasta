import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Plus, Trash2 } from "lucide-react";
import { CATEGORY_LABEL, PLAN_CATEGORIES, plan, type CostLine, type Rates } from "../../../shared/planner";
import { Notice, stagger } from "../../components/ui";
import { Link } from "../../lib/router";
import { fmtDate } from "../../lib/use";
import { MoneyField } from "./Conversation";
import { EvidenceBadge, STAGE_LABEL, money } from "./bits";
import { toInput, upsertLine, removeLine, userSource, type Answers, type Reference } from "./model";

const CUR = ["PKR", "EUR", "CNY", "USD"];

export function Results({ answers: a, set, refs, liveRates }: { answers: Answers; set: (fn: (a: Answers) => Answers) => void; refs: Reference[]; liveRates: { rates: Record<string, number>; source: string | null; date: string | null; stale: boolean } }) {
  const rates: Rates = { pkrPer: { ...liveRates.rates, ...a.rateOverrides }, source: liveRates.source ?? "your own rates", date: liveRates.date };
  const input = useMemo(() => toInput(a, { pkrPer: liveRates.rates, source: liveRates.source ?? "your own rates", date: liveRates.date }), [a, liveRates]);
  const result = useMemo(() => plan(input), [input]);
  const [sel, setSel] = useState(0);
  const s = result.scenarios[Math.min(sel, result.scenarios.length - 1)];
  const m = (v: number) => money(v, a.display, rates);
  const usedCurrencies = [...new Set([...a.costs.map((c) => c.currency), a.display, ...a.awards.flatMap((w) => [w.stipend?.currency, (w.tuition as any).currency].filter(Boolean) as string[])])].filter((c) => c !== "PKR");
  const proof = refs.filter((r) => r.kind === "proof_of_funds" && r.country === a.country);
  const maxCat = Math.max(1, ...s.rows.map((r) => r.cost));

  return (
    <div className="stack" style={{ "--gap": "24px" } as any}>
      {/* Currency + rates */}
      <div className="panel row between" style={{ padding: "14px 18px", alignItems: "flex-start" }}>
        <div className="stack" style={{ "--gap": "4px" } as any}>
          <div className="row" style={{ "--gap": "8px" } as any}>
            <span className="tiny">Show amounts in</span>
            <div className="seg" role="group" aria-label="Display currency">{CUR.map((c) => <button key={c} aria-pressed={a.display === c} onClick={() => set((x) => ({ ...x, display: c }))}>{c}</button>)}</div>
          </div>
          <span className="tiny">
            {liveRates.source ? <>Rates: {liveRates.source}{liveRates.date ? `, dated ${fmtDate(liveRates.date)}` : ""}{liveRates.stale ? " (cached)" : ""}. <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer">Rates by Exchange Rate API</a>. Your bank's rate will differ.</> : "No live exchange rates available. Enter your bank's rate below."}
          </span>
        </div>
        <div className="row" style={{ "--gap": "8px" } as any}>
          {usedCurrencies.map((c) => (
            <label key={c} className="field" style={{ width: 120 }}>
              <span className="tiny">PKR per {c}</span>
              <input className="input num" type="number" min={0} step="0.01" value={a.rateOverrides[c] ?? liveRates.rates[c] ?? ""} placeholder="enter rate" onChange={(e) => set((x) => ({ ...x, rateOverrides: e.target.value ? { ...x.rateOverrides, [c]: Number(e.target.value) } : Object.fromEntries(Object.entries(x.rateOverrides).filter(([k]) => k !== c)) }))} />
            </label>
          ))}
        </div>
      </div>
      {result.unconverted.length > 0 && <Notice kind="warn">No exchange rate for: {result.unconverted.join(", ")}. These are left out until you enter a rate. We never guess one.</Notice>}

      {/* Scenario comparison */}
      <motion.div className="grid" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`, gap: 16 }} variants={stagger.container} initial="hidden" animate="show">
        {result.scenarios.map((sc, i) => (
          <motion.button key={i} variants={stagger.item} type="button" className={`scenario ${i === sel ? "on" : ""}`} onClick={() => setSel(i)} aria-pressed={i === sel}>
            <div className="row between" style={{ width: "100%" }}>
              <span className={`badge ${sc.key === "baseline" ? "b-neutral" : sc.key === "potential" ? "b-warn" : "b-ok"}`}>{sc.key === "baseline" ? "Baseline" : sc.key === "potential" ? "Potential — not awarded" : "Confirmed award"}</span>
            </div>
            <div style={{ fontWeight: 600, fontSize: 15.5, marginTop: 10, textAlign: "left" }}>{sc.title}</div>
            <div className="tiny" style={{ marginTop: 14 }}>You would still pay (whole programme)</div>
            <div className="stat" style={{ fontSize: 30 }}>{m(sc.remaining)}</div>
            <dl className="sc-kv">
              <dt>Programme cost</dt><dd className="num">{m(sc.programmeCost)}</dd>
              <dt>Scholarship covers</dt><dd className="num">{sc.covered ? m(sc.covered) : "—"}</dd>
              <dt>First year, you pay</dt><dd className="num">{m(sc.remainingFirstYear)}</dd>
              <dt>Cash before & on arrival</dt><dd className="num">{m(sc.upfrontCash)}</dd>
              <dt>Your available funds</dt><dd className="num">{m(sc.available)}</dd>
              <dt>Funding gap</dt><dd className="num" style={{ color: sc.gap ? "var(--bad)" : "var(--ok)", fontWeight: 600 }}>{sc.gap ? m(sc.gap) : "None"}</dd>
            </dl>
            {sc.overContribution ? <div className="tiny" style={{ color: "var(--bad)", marginTop: 8, textAlign: "left" }}>Needs {m(sc.overContribution)} more than your maximum contribution.</div> : null}
          </motion.button>
        ))}
      </motion.div>
      {result.scenarios.length === 1 && a.schol && a.schol !== "none" && <Notice kind="info">No award terms added yet, so only the baseline is shown. <button className="btn-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }} onClick={() => document.getElementById("assumptions")?.scrollIntoView({ behavior: "smooth" })}>Add award terms below</button>.</Notice>}

      {/* Detail for selected scenario */}
      <div className="grid grid-2" style={{ alignItems: "start", gap: 20 }}>
        <section className="panel panel-flush">
          <div className="panel-head"><h3>Where the money goes</h3><span className="tiny">{s.title}</span></div>
          <div style={{ padding: "8px 20px 16px" }}>
            {s.rows.length === 0 && <p className="muted" style={{ padding: "12px 0" }}>No costs entered yet.</p>}
            {s.rows.map((r) => (
              <div key={r.category} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div className="row between"><span style={{ fontSize: 14.5, fontWeight: 500 }}>{CATEGORY_LABEL[r.category]}</span><span className="num" style={{ fontSize: 14 }}>{m(r.remaining)}{r.covered ? <span className="tiny"> of {m(r.cost)}</span> : null}</span></div>
                <div className="bar" aria-hidden>
                  <motion.div className="bar-cost" animate={{ width: `${(r.cost / maxCat) * 100}%` }} transition={{ duration: 0.5 }} />
                  <motion.div className="bar-cov" animate={{ width: `${(r.covered / maxCat) * 100}%` }} transition={{ duration: 0.5 }} />
                </div>
              </div>
            ))}
            {s.rows.some((r) => r.covered) && <div className="row tiny" style={{ marginTop: 10, "--gap": "14px" } as any}><span><span className="legend-sw" style={{ background: "var(--brand-2)" }} />covered by award</span><span><span className="legend-sw" style={{ background: "#d9d4c7" }} />you pay</span></div>}
          </div>
        </section>
        <section className="panel panel-flush">
          <div className="panel-head"><h3>When you need the money</h3><span className="tiny">First year</span></div>
          <ol className="timeline">
            {s.stages.map((st) => (
              <li key={st.stage}><span className="tl-dot" /><div className="row between grow"><span>{STAGE_LABEL[st.stage]}</span><strong className="num">{m(st.amount)}</strong></div></li>
            ))}
          </ol>
          <div style={{ padding: "0 20px 16px" }} className="stack">
            {s.refundableDeposits > 0 && <p className="tiny">Includes {m(s.refundableDeposits)} in refundable deposits (cash you get back; not a cost).</p>}
            {s.notes.map((n) => <p key={n} className="tiny">• {n}</p>)}
          </div>
        </section>
      </div>

      {/* Proof of funds: never added to costs */}
      <section className="panel panel-flush">
        <div className="panel-head"><div><h3>Proof of funds for the visa</h3><div className="tiny" style={{ marginTop: 2 }}>A requirement to show money, not an extra cost. It is not added to your totals.</div></div></div>
        {proof.length === 0 ? (
          <div style={{ padding: 20 }}><Notice kind="warn">We have no verified proof-of-funds rule for {a.country ? { CN: "China", DE: "Germany", IT: "Italy" }[a.country] : "this country"} on file. Check the embassy or visa centre for your route before applying.</Notice></div>
        ) : proof.map((r) => {
          const req = r.amount;
          return (
            <div key={r.id} className="stack" style={{ "--gap": "6px", padding: "14px 20px", borderTop: "1px solid var(--line)" } as any}>
              <div className="row between"><strong style={{ fontSize: 15 }}>{r.label}</strong><EvidenceBadge status={r.status} /></div>
              <div className="num">{req !== null ? `${req.toLocaleString()} ${r.currency} ${({ once: "", month: "per month", semester: "per semester", year: "per year" })[r.unit]}` : "Amount not confirmed"}</div>
              {r.applies_to && <div className="tiny">Route / period: {r.applies_to}</div>}
              {r.evidence_types?.length ? <div className="tiny">Accepted evidence (as documented): {r.evidence_types.join("; ")}</div> : <div className="tiny">Accepted evidence: not documented in our source. Confirm with the embassy.</div>}
              <div className="tiny">{r.authority}{r.checked_at ? ` · checked ${r.checked_at.slice(0, 10)}` : ""} {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer">source <ExternalLink size={10} style={{ display: "inline" }} /></a>}</div>
              {r.status !== "VERIFIED" && <div className="tiny" style={{ color: "var(--warn)" }}><AlertTriangle size={12} style={{ display: "inline", verticalAlign: -2 }} /> Not verified for the current period. Confirm before relying on it.</div>}
            </div>
          );
        })}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)" }} className="tiny">A scholarship doesn't automatically remove proof-of-funds rules, and not every route needs a blocked account. Never use borrowed, fabricated or hidden money as evidence.</div>
      </section>

      {/* Assumptions editor */}
      <section className="panel panel-flush" id="assumptions">
        <div className="panel-head"><div><h3>Your assumptions</h3><div className="tiny" style={{ marginTop: 2 }}>Change anything; results update instantly.</div></div>
          <label className="row tiny" style={{ "--gap": "8px" } as any}>Programme length
            <input className="input num" style={{ width: 90, height: 34 }} type="number" min={1} max={120} value={a.months ?? 12} aria-label="Programme length in months" onChange={(e) => set((x) => ({ ...x, months: Math.min(120, Math.max(1, Number(e.target.value) || 1)) }))} /> months
          </label>
        </div>
        {a.costs.map((c) => <CostRow key={c.id} c={c} onChange={(l) => set((x) => ({ ...x, costs: upsertLine(x.costs, l) }))} onRemove={() => set((x) => ({ ...x, costs: removeLine(x.costs, c.id) }))} />)}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
          <button className="btn btn-soft btn-sm" onClick={() => set((x) => ({ ...x, costs: [...x.costs, { id: `custom-${Date.now()}`, category: "other", label: "Other cost", amount: null, currency: "PKR", freq: "once", stage: "before_departure", source: userSource }] }))}><Plus size={14} />Add a cost</button>
        </div>
        {a.awards.map((w) => (
          <div key={w.id} className="stack" style={{ "--gap": "10px", padding: "16px 20px", borderTop: "1px solid var(--line)" } as any}>
            <div className="row between"><strong>{w.name || "Unnamed award"}</strong><span className={`badge ${w.status === "potential" ? "b-warn" : "b-ok"}`}>{w.status === "potential" ? "Potential" : "Confirmed"}</span></div>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 10 }}>
              <label className="field"><span>Tuition</span><select className="input" value={w.tuition.type} onChange={(e) => set((x) => ({ ...x, awards: x.awards.map((y) => (y.id === w.id ? { ...y, tuition: e.target.value === "percent" ? { type: "percent", percent: 50 } : ({ type: e.target.value } as any) } : y)) }))}><option value="full">Fully waived</option><option value="percent">Partly waived</option><option value="none">Not covered</option><option value="unknown">Not documented</option>{w.tuition.type === "amount" && <option value="amount">Fixed amount</option>}</select></label>
              {w.tuition.type === "percent" && <label className="field"><span>Waiver %</span><input className="input num" type="number" min={0} max={100} value={w.tuition.percent} onChange={(e) => set((x) => ({ ...x, awards: x.awards.map((y) => (y.id === w.id ? { ...y, tuition: { type: "percent", percent: Math.min(100, Math.max(0, Number(e.target.value))) } } : y)) }))} /></label>}
              <label className="field"><span>Stipend / month</span><input className="input num" type="number" min={0} value={w.stipend?.amount ?? ""} placeholder="none" onChange={(e) => set((x) => ({ ...x, awards: x.awards.map((y) => (y.id === w.id ? { ...y, stipend: e.target.value === "" ? null : { amount: Number(e.target.value), currency: y.stipend?.currency ?? (a.country === "CN" ? "CNY" : "EUR"), per: "month", startsAfterArrival: true } } : y)) }))} /></label>
              <label className="field"><span>Stipend currency</span><select className="input" value={w.stipend?.currency ?? (a.country === "CN" ? "CNY" : "EUR")} disabled={!w.stipend} onChange={(e) => set((x) => ({ ...x, awards: x.awards.map((y) => (y.id === w.id && y.stipend ? { ...y, stipend: { ...y.stipend, currency: e.target.value } } : y)) }))}>{CUR.map((c) => <option key={c}>{c}</option>)}</select></label>
              {(["accommodation", "insurance"] as const).map((k) => (
                <label key={k} className="field"><span>{k === "accommodation" ? "Housing" : "Insurance"}</span><select className="input" value={typeof w[k] === "string" ? (w[k] as string) : "full"} onChange={(e) => set((x) => ({ ...x, awards: x.awards.map((y) => (y.id === w.id ? { ...y, [k]: e.target.value } : y)) }))}><option value="full">Covered</option><option value="none">Not covered</option><option value="unknown">Not documented</option></select></label>
              ))}
            </div>
            <span className="tiny">{w.status === "potential" ? "Terms start from what the scholarship record documents; anything not documented counts as zero until you confirm it on the official page." : "Terms as you entered them from your award letter."}</span>
          </div>
        ))}
      </section>

      {/* Evidence summary */}
      <section className="panel">
        <h3 style={{ marginBottom: 10 }}>How solid are these numbers?</h3>
        <div className="row" style={{ "--gap": "10px" } as any}>
          {(Object.entries(result.evidence) as [any, number][]).filter(([, n]) => n).map(([k, n]) => <span key={k} className="row" style={{ "--gap": "6px" } as any}><EvidenceBadge status={k} /><span className="num tiny">× {n}</span></span>)}
        </div>
        {result.missing.length > 0 && <div style={{ marginTop: 12 }}><Notice kind="warn">Not included yet: {result.missing.join("; ")}.</Notice></div>}
        <div className="stack" style={{ "--gap": "6px", marginTop: 14 } as any}>
          {result.conclusion.map((c) => <p key={c} style={{ fontSize: 15 }}>• {c}</p>)}
        </div>
        <details className="faq" style={{ marginTop: 10 }}>
          <summary style={{ fontSize: 14.5 }}>How we calculate<Plus size={16} /></summary>
          <p style={{ fontSize: 14 }}>Monthly costs × months; per-semester fees × started semesters; yearly fees × started years; one-time costs once. Scholarship tuition waivers apply to tuition only; stipends pay monthly costs (living, then rent, then insurance) and never one-time costs. Refundable deposits count as cash up front but not as cost; prepaid deposits are already inside tuition or rent. Potential awards are never added to your available money. All arithmetic is done in PKR and converted for display with the rate shown.</p>
        </details>
      </section>

      <section className="panel dark">
        <h3 style={{ color: "#fff", marginBottom: 8 }}>What to do next</h3>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.9 }} className="muted">
          {result.missing.length > 0 && <li>Find the {result.missing.length} unknown cost{result.missing.length > 1 ? "s" : ""} on the official university and embassy pages.</li>}
          {result.evidence.USER + result.evidence.ESTIMATE > 0 && <li>Confirm your own and estimated figures against official sources before relying on them.</li>}
          {s.gap > 0 && <li>Close the {m(s.gap)} gap: compare more scholarships, or plan a cheaper housing option.</li>}
          {a.awards.some((w) => w.status === "potential") && <li>Track your scholarship applications so deadlines and documents are on your dashboard.</li>}
          <li><Link to="/scholarships" style={{ color: "#fff" }}>Browse scholarships</Link> · <Link to="/app/applications" style={{ color: "#fff" }}>Your applications</Link></li>
        </ul>
      </section>
    </div>
  );
}

function CostRow({ c, onChange, onRemove }: { c: CostLine; onChange: (l: CostLine) => void; onRemove: () => void }) {
  return (
    <div className="cost-row">
      <div className="stack" style={{ "--gap": "6px", minWidth: 0 } as any}>
        <input className="input" style={{ height: 36, fontWeight: 500 }} aria-label="Cost name" value={c.label} onChange={(e) => onChange({ ...c, label: e.target.value })} />
        <div className="row" style={{ "--gap": "6px" } as any}>
          <EvidenceBadge status={c.amount === null ? "UNKNOWN" : c.source.status} />
          {c.source.url && <a className="tiny" href={c.source.url} target="_blank" rel="noopener noreferrer">{c.source.authority ?? "source"} <ExternalLink size={10} style={{ display: "inline" }} /></a>}
          {c.source.checked && <span className="tiny">checked {c.source.checked.slice(0, 10)}</span>}
        </div>
      </div>
      <MoneyField label={`${c.label} amount`} line={c} onChange={(p) => onChange({ ...c, ...p, source: p.amount !== undefined ? { status: "USER" } : c.source })} />
      <div className="row" style={{ "--gap": "6px", flexWrap: "nowrap" } as any}>
        <select className="input" aria-label={`${c.label} category`} value={c.category} onChange={(e) => onChange({ ...c, category: e.target.value as CostLine["category"] })}>{PLAN_CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABEL[k]}</option>)}</select>
        <select className="input" aria-label={`${c.label} timing`} value={c.stage} onChange={(e) => onChange({ ...c, stage: e.target.value as CostLine["stage"] })}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        {c.category === "deposit" && <select className="input" aria-label={`${c.label} deposit type`} value={c.depositType ?? "additional"} onChange={(e) => onChange({ ...c, depositType: e.target.value as CostLine["depositType"] })}><option value="refundable">Refundable</option><option value="prepayment">Part of tuition/rent</option><option value="additional">Extra cost</option></select>}
        <button className="btn btn-soft btn-sm icon-btn" aria-label={`Remove ${c.label}`} onClick={onRemove}><Trash2 size={14} /></button>
      </div>
    </div>
  );
}
