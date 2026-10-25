import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Page } from "../components/Layout";
import { Notice } from "../components/ui";
import { api } from "../lib/api";
import { fmtPkr, useApi } from "../lib/use";

const CATS = ["tuition", "living", "accommodation", "insurance", "travel", "application", "visa", "translation", "deposit"];
type Line = { category: string; amount: number; currency: string; period: "once" | "month" | "year"; beforeArrival?: boolean };

// Blank-ish starting lines: the student fills in figures from official pages.
const START: Line[] = [
  { category: "tuition", amount: 0, currency: "EUR", period: "year" },
  { category: "living", amount: 0, currency: "EUR", period: "month" },
  { category: "insurance", amount: 0, currency: "EUR", period: "month" },
  { category: "visa", amount: 0, currency: "EUR", period: "once", beforeArrival: true },
  { category: "travel", amount: 0, currency: "PKR", period: "once", beforeArrival: true },
  { category: "application", amount: 0, currency: "PKR", period: "once", beforeArrival: true },
];

export function Costs() {
  const [months, setMonths] = useState(24);
  const [lines, setLines] = useState<Line[]>(START);
  const [rates, setRates] = useState<Record<string, number>>({ EUR: 0, CNY: 0 });
  const [sponsor, setSponsor] = useState(0);
  const [savings, setSavings] = useState(0);
  const [sch, setSch] = useState("");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const list = useApi<any>("/scholarships");

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await api.post("/finance/calculate", { months, costs: lines, rates, sponsorPkr: sponsor, savingsPkr: savings, scholarshipId: sch || undefined });
        setResult(r);
        setErr(null);
      } catch (e: any) {
        setErr(e.message);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [months, lines, rates, sponsor, savings, sch]);

  const upd = (i: number, p: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const currencies = [...new Set(lines.map((l) => l.currency).filter((c) => c !== "PKR"))];
  const max = result ? Math.max(1, ...Object.values<any>(result.result.byCategory).map((v) => v.cost)) : 1;

  return (
    <Page>
      <h1>What will it actually cost?</h1>
      <p className="lead" style={{ maxWidth: 680, marginTop: 10 }}>Enter figures from the official university, embassy and scholarship pages. Raasta adds them up, subtracts only what a scholarship actually covers, and shows the gap and the cash you need before you leave.</p>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))", gap: 20, marginTop: 24, alignItems: "start" }}>
        <div className="card stack">
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label htmlFor="months">Duration (months)</label><input id="months" className="input" type="number" min={1} max={120} value={months} onChange={(e) => setMonths(Math.max(1, +e.target.value || 1))} /></div>
            <div className="field">
              <label htmlFor="sch">Scholarship (optional)</label>
              <select id="sch" className="input" value={sch} onChange={(e) => setSch(e.target.value)}>
                <option value="">None</option>
                {(list.data?.scholarships ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          {result?.scholarship && Object.keys(result.scholarship.coverage ?? {}).length === 0 && (
            <Notice kind="warn">We haven't recorded verified coverage amounts for this award yet, so it's counted as 0. Check the official page.</Notice>
          )}
          <h3 style={{ marginTop: 6 }}>Costs</h3>
          {lines.map((l, i) => (
            <div key={i} className="row" style={{ "--gap": "6px", flexWrap: "nowrap" } as any}>
              <select aria-label="Category" className="input" style={{ flex: 1.3 }} value={l.category} onChange={(e) => upd(i, { category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select>
              <input aria-label="Amount" className="input" type="number" min={0} style={{ flex: 1 }} value={l.amount || ""} placeholder="0" onChange={(e) => upd(i, { amount: Math.max(0, +e.target.value || 0) })} />
              <select aria-label="Currency" className="input" style={{ flex: 0.8 }} value={l.currency} onChange={(e) => upd(i, { currency: e.target.value })}>{["PKR", "EUR", "CNY", "USD"].map((c) => <option key={c}>{c}</option>)}</select>
              <select aria-label="Period" className="input" style={{ flex: 0.9 }} value={l.period} onChange={(e) => upd(i, { period: e.target.value as Line["period"] })}><option value="once">once</option><option value="month">/month</option><option value="year">/year</option></select>
              <button className="btn btn-soft icon-btn" aria-label="Remove line" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setLines([...lines, { category: "deposit", amount: 0, currency: "PKR", period: "once" }])}><Plus size={14} />Add cost</button>
          <h3 style={{ marginTop: 6 }}>Exchange rates (PKR per unit)</h3>
          <p className="help">Enter today's rate from your bank. We don't fetch live rates.</p>
          <div className="row">
            {currencies.map((c) => (
              <div key={c} className="field" style={{ width: 130 }}><label htmlFor={`r-${c}`}>{c}</label><input id={`r-${c}`} className="input" type="number" min={0} value={rates[c] || ""} placeholder="e.g. rate" onChange={(e) => setRates({ ...rates, [c]: +e.target.value || 0 })} /></div>
            ))}
          </div>
          <h3 style={{ marginTop: 6 }}>Your legitimate funds</h3>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div className="field"><label htmlFor="sp">Sponsor support (PKR)</label><input id="sp" className="input" type="number" min={0} value={sponsor || ""} onChange={(e) => setSponsor(+e.target.value || 0)} /></div>
            <div className="field"><label htmlFor="sv">Own savings (PKR)</label><input id="sv" className="input" type="number" min={0} value={savings || ""} onChange={(e) => setSavings(+e.target.value || 0)} /></div>
          </div>
        </div>

        <div className="card stack" style={{ position: "sticky", top: 96 }}>
          <h3>Result</h3>
          {err && <Notice kind="bad">{err}</Notice>}
          {result && (
            <>
              <div className="grid grid-2" style={{ gap: 12 }}>
                <Stat label="Total cost" v={result.result.totalCost} />
                <Stat label="Scholarship pays" v={result.result.scholarshipValue} />
                <Stat label="Your funds" v={result.result.ownFunds} />
                <Stat label="Funding gap" v={result.result.gap} strong />
              </div>
              <div className="subtle">Cash needed before arrival: <strong>{fmtPkr(result.result.upfrontCash)}</strong></div>
              <div className="stack" style={{ "--gap": "8px", marginTop: 6 } as any}>
                {Object.entries<any>(result.result.byCategory).filter(([, v]) => v.cost > 0).map(([k, v]) => (
                  <div key={k}>
                    <div className="row between subtle"><span style={{ textTransform: "capitalize" }}>{k}</span><span>{fmtPkr(v.cost)}{v.covered ? ` · covered ${fmtPkr(v.covered)}` : ""}</span></div>
                    <div className="progress" style={{ position: "relative" }}>
                      <motion.div style={{ background: "var(--line)" }} animate={{ width: `${(v.cost / max) * 100}%` }} />
                      <motion.div style={{ position: "absolute", top: 0, left: 0 }} animate={{ width: `${(v.covered / max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              {result.result.warnings.map((w: string) => <Notice key={w} kind="warn">{w}</Notice>)}
              <p className="subtle">Visa proof-of-funds rules (blocked account, bank statements, sponsor letters) differ by country and route. Check the current embassy page. Never fabricate statements or hide where money comes from.</p>
            </>
          )}
        </div>
      </div>
    </Page>
  );
}

function Stat({ label, v, strong }: { label: string; v: number; strong?: boolean }) {
  return (
    <div className="card" style={{ padding: 14, boxShadow: "none", background: strong ? "var(--accent-soft)" : "var(--paper)" }}>
      <div className="subtle">{label}</div>
      <div style={{ fontFamily: "var(--serif)", fontSize: 22, fontWeight: 600 }}>{fmtPkr(v)}</div>
    </div>
  );
}
