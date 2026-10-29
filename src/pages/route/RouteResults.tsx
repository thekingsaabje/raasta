import { motion } from "motion/react";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Check, ExternalLink, Info, Pencil, Wallet } from "lucide-react";
import { EligBadge, Notice, StatusBadge, stagger } from "../../components/ui";
import { Link } from "../../lib/router";
import { fmtDate } from "../../lib/use";

const COUNTRY = { CN: "China", DE: "Germany", IT: "Italy" } as Record<string, string>;
const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-PK")}`;

export const GROUPS: { fit: string; title: string; explain: string; tone: string }[] = [
  { fit: "VERIFIED_FIT", title: "Confirmed fits", explain: "A Raasta reviewer confirmed the current call, and you meet every confirmed rule.", tone: "b-ok" },
  { fit: "POTENTIAL_FIT", title: "Potential fits", explain: "Nothing in the official text rules you out. Open each official page and confirm the deadline before you apply.", tone: "b-ok" },
  { fit: "NEEDS_CONFIRMATION", title: "Needs confirmation", explain: "Some information is missing, or a rule needs a human decision (for example how your grades compare).", tone: "b-neutral" },
  { fit: "LIKELY_INELIGIBLE", title: "Likely not eligible — needs confirmation", explain: "The official text appears to rule you out (quoted below), but a reviewer hasn't confirmed the rule yet.", tone: "b-bad" },
  { fit: "NOT_ELIGIBLE", title: "Not eligible", explain: "A reviewer-confirmed rule rules you out.", tone: "b-bad" },
  { fit: "CLOSED", title: "Closed for now — watch for the next call", explain: "This round has closed. These are not recommendations; check back for the next call.", tone: "b-neutral" },
];

export function RouteResults({ data, selected, toggle, onEdit, onPlan, onSave, saving, signedIn }: {
  data: any;
  selected: string[];
  toggle: (id: string) => void;
  onEdit: () => void;
  onPlan: (country: string) => void;
  onSave: () => void;
  saving: boolean;
  signedIn: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const fin = Object.fromEntries((data.finance ?? []).map((f: any) => [f.country, f]));
  return (
    <div className="stack" style={{ "--gap": "26px" } as any}>
      <div className="row between">
        <p className="muted" style={{ maxWidth: 720 }}>{data.note} Every match links to the official page it was taken from.</p>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Pencil size={14} />Edit answers</button>
      </div>
      {data.missingProfile.length > 0 && <Notice kind="info"><span>To sharpen this, add {data.missingProfile.join(", ")}. <button className="btn-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline", font: "inherit" }} onClick={onEdit}>Edit answers</button></span></Notice>}

      {/* Routes side by side */}
      <section>
        <h2 style={{ fontSize: 24, marginBottom: 12 }}>Your possible routes</h2>
        <motion.div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }} variants={stagger.container} initial="hidden" animate="show">
          {data.routes.map((r: any) => {
            const f = fin[r.country];
            return (
              <motion.div key={r.country} variants={stagger.item} className="panel stack" style={{ "--gap": "12px" } as any} aria-label={`${COUNTRY[r.country]} route`}>
                <div className="row between"><h3 style={{ fontFamily: "var(--serif)", fontSize: 21 }}>{COUNTRY[r.country]}</h3><span className={`flag flag-${r.country}`}>{r.country}</span></div>
                <div className="row" style={{ "--gap": "6px" } as any}>
                  {r.counts.VERIFIED_FIT > 0 && <span className="badge b-ok">{r.counts.VERIFIED_FIT} verified fit</span>}
                  <span className="badge b-warn">{r.counts.POTENTIAL_FIT} potential</span>
                  <span className="badge b-neutral">{r.counts.NEEDS_CONFIRMATION} need confirmation</span>
                  {r.counts.LIKELY_INELIGIBLE > 0 && <span className="badge b-bad">{r.counts.LIKELY_INELIGIBLE} likely not eligible</span>}
                  <span className="badge b-neutral">{r.counts.CLOSED} closed</span>
                </div>
                {f && (
                  <div className="sunk stack" style={{ "--gap": "4px" } as any}>
                    <span className="row tiny" style={{ "--gap": "6px" } as any}><Wallet size={13} />Estimated cost without a scholarship</span>
                    <strong className="num" style={{ fontSize: 18 }}>{f.perYearPkr ? `${pkr(f.perYearPkr)} / year` : "Not enough official figures"}</strong>
                    {f.perYearPkr > 0 && <span className="tiny num">≈ {pkr(f.totalPkr)} over {f.years} years{f.gapPkr !== null ? ` · gap vs your budget ${f.gapPkr ? pkr(f.gapPkr) : "none"}` : ""}</span>}
                    <span className="tiny">Estimate: tuition, rent and living from official figures (upper ends), {f.complete ? "all three found" : "some parts missing"}. Not a quote.</span>
                  </div>
                )}
                {r.barriers.length > 0 && (
                  <div className="stack" style={{ "--gap": "4px" } as any}>
                    <span className="tiny" style={{ fontWeight: 600 }}>Possible barriers</span>
                    {r.barriers.slice(0, 3).map((b: string) => <span key={b} className="tiny">• {b}</span>)}
                  </div>
                )}
                <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start", marginTop: "auto" }} onClick={() => onPlan(r.country)}>Plan exact costs <ArrowRight size={14} /></button>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* Matches grouped by fit */}
      {GROUPS.map((g) => {
        const items = data.items.filter((i: any) => i.fit === g.fit);
        if (items.length === 0) return null;
        return (
          <section key={g.fit} className="panel panel-flush" aria-label={g.title}>
            <div className="panel-head"><div><h3>{g.title} <span className="num tiny">({items.length})</span></h3><div className="tiny" style={{ marginTop: 2 }}>{g.explain}</div></div></div>
            {items.map((i: any) => (
              <div key={i.id} style={{ borderTop: "1px solid var(--line)" }}>
                <div className="row between" style={{ padding: "14px 20px", alignItems: "flex-start" }}>
                  <div className="grow stack" style={{ "--gap": "6px" } as any}>
                    <div className="row" style={{ "--gap": "8px" } as any}>
                      <span className={`flag flag-${i.country}`}>{i.country}</span>
                      <Link to={`/scholarships/${i.id}`} style={{ fontWeight: 600, fontSize: 15 }}>{i.name}</Link>
                    </div>
                    <div className="row" style={{ "--gap": "6px" } as any}>
                      <StatusBadge status={i.status} cycle={i.cycleState} reason={i.statusReason} checkedAt={i.sourceCheckedAt} check={i.sourceCheck} />
                      {i.deadline.date && <span className="tiny num">Deadline {fmtDate(i.deadline.date)} · {i.deadline.confirmed ? "confirmed" : "not confirmed"}</span>}
                      <span className="tiny">{i.met.length} met · {i.notMet.length} not met · {i.missing.length} missing · {i.review.length} to check</span>
                    </div>
                    {i.timing && <span className="tiny row" style={{ "--gap": "5px", color: "var(--warn-ink, var(--ink-2))" } as any}><Info size={12} />{i.timing}</span>}
                  </div>
                  <div className="row" style={{ "--gap": "6px", flexShrink: 0 } as any}>
                    {g.fit !== "CLOSED" && g.fit !== "NOT_ELIGIBLE" && (
                      <button className={`btn btn-sm ${selected.includes(i.id) ? "btn-primary" : "btn-soft"}`} aria-pressed={selected.includes(i.id)} onClick={() => toggle(i.id)}>
                        {selected.includes(i.id) ? <><Check size={14} />In roadmap</> : "Add to roadmap"}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-sm" aria-expanded={open === i.id} onClick={() => setOpen(open === i.id ? null : i.id)}>Evidence</button>
                  </div>
                </div>
                {open === i.id && <Evidence i={i} />}
              </div>
            ))}
          </section>
        );
      })}

      <section className="panel">
        <h3 style={{ marginBottom: 10 }}>What to do next</h3>
        <div className="stack" style={{ "--gap": "10px" } as any}>
          {data.nextActions.map((n: any) => (
            <div key={n.title} className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", "--gap": "10px" } as any}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 3, color: "var(--brand-2)" }} />
              <div><strong style={{ fontSize: 15 }}>{n.to ? <Link to={n.to}>{n.title}</Link> : n.title}</strong><div className="tiny">{n.why}</div>
                {n.href && <a className="tiny" href={n.href} target="_blank" rel="noopener noreferrer">Official site: {new URL(n.href).hostname.replace(/^www./, "")} <ExternalLink size={11} style={{ display: "inline" }} /></a>}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel dark row between" style={{ padding: "22px 24px" }}>
        <div>
          <h3 style={{ color: "#fff" }}>Save this and build your roadmap</h3>
          <p className="muted" style={{ marginTop: 4 }}>{selected.length} option{selected.length === 1 ? "" : "s"} selected. We'll save your answers, track the selected awards with checklists, and add your next steps to your dashboard.</p>
        </div>
        <button className="btn btn-lg" style={{ background: "var(--accent)", color: "var(--ink)" }} disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : signedIn ? "Save & create roadmap" : "Create free account to save"} <ArrowRight size={16} />
        </button>
      </section>
    </div>
  );
}

function Evidence({ i }: { i: any }) {
  const row = (r: any) => (
    <div key={r.requirementId} className="stack" style={{ "--gap": "4px", padding: "8px 0", borderTop: "1px dashed var(--line)" } as any}>
      <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" } as any}><span style={{ fontSize: 14, fontWeight: 500 }}>{r.text}</span><EligBadge status={r.status} /></div>
      <span className="tiny">{r.reason}{r.status !== "MET" ? ` Next: ${r.nextAction}` : ""}</span>
      {r.excerpt && <blockquote style={{ margin: 0, paddingLeft: 10, borderLeft: "2px solid var(--line-2)", fontSize: 13, color: "var(--ink-2)" }}>"{r.excerpt}"</blockquote>}
      <span className="tiny">{r.ruleVerified ? "Rule confirmed by a reviewer" : "Rule not yet confirmed by a reviewer"}{r.sourceUrl && <> · <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">official source <ExternalLink size={10} style={{ display: "inline" }} /></a></>}</span>
    </div>
  );
  const all = [...i.notMet, ...i.missing, ...i.review, ...i.met];
  return (
    <div style={{ padding: "0 20px 16px" }}>
      {i.statusReason && <p className="tiny" style={{ marginBottom: 6 }}><AlertTriangle size={12} style={{ display: "inline", verticalAlign: -2 }} /> {i.statusReason}</p>}
      {all.length === 0 ? <p className="tiny">No rules recorded yet; use the <a href={i.officialUrl} target="_blank" rel="noopener noreferrer">official page</a>.</p> : all.map(row)}
      <a className="tiny" href={i.officialUrl} target="_blank" rel="noopener noreferrer">Open the official page <ExternalLink size={10} style={{ display: "inline" }} /></a>
    </div>
  );
}
