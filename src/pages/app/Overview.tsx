import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Bell, CalendarDays, Sparkles, Wallet } from "lucide-react";
import { Empty, EligBadge, Notice, ProgressBar, Reveal, Ring, Skeleton, StatusBadge, stagger } from "../../components/ui";
import { COUNTRY, fmtDate, useApi } from "../../lib/use";
import { Link } from "../../lib/router";
import { useAuth } from "../../lib/auth";
import { FUNDING_LABEL } from "../../../shared/funding";

const LEVEL: Record<string, string> = { bachelor: "Bachelor's", master: "Master's", phd: "PhD" };

export function Overview() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<any>("/me/dashboard");
  if (loading) return <div className="stack" style={{ "--gap": "16px" } as any}><Skeleton h={44} w="45%" /><Skeleton h={130} /><Skeleton h={260} /></div>;
  if (error || !data) return <Notice kind="bad">{error}</Notice>;
  const p = data.profile;
  const o = data.overall;
  const noProfile = Object.keys(p).length === 0;
  const goal = p.targetLevel
    ? `${LEVEL[p.targetLevel]}${p.targetField ? ` in ${p.targetField}` : ""}${p.targetCountries?.length ? ` · ${p.targetCountries.map((c: string) => COUNTRY[c]?.name).join(", ")}` : ""}${p.intake ? ` · ${p.intake}` : ""}`
    : null;

  // Group the agenda by month for a calendar-style view.
  const months: Record<string, any[]> = {};
  for (const a of data.agenda) (months[a.date.slice(0, 7)] ??= []).push(a);

  return (
    <div className="stack" style={{ "--gap": "24px" } as any}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Salaam, {user?.name.split(" ")[0]}</h1>
          <p className="muted">{goal ?? "Set your study goal to personalise your matches and tasks."}</p>
        </div>
        <Link to="/route" className="btn btn-primary">Find my study route <ArrowRight size={15} /></Link>
      </div>

      {noProfile && <Notice kind="info"><span>Start with your profile. It takes about three minutes and every field is optional. <Link to="/app/profile"><strong>Complete profile →</strong></Link></span></Notice>}

      <motion.div className="panel panel-flush" variants={stagger.container} initial="hidden" animate="show">
        <div className="grid stat-strip" style={{ gap: 0 }}>
          <motion.div variants={stagger.item} className="row" style={{ padding: 20, "--gap": "16px", flexWrap: "nowrap" } as any}>
            <Ring value={o.percent} size={84} />
            <div><div className="tiny">Applicable tasks</div><div style={{ fontWeight: 600 }} className="num">{o.done} of {o.total} done</div><div className="tiny">{o.verified} confirmed by institutions</div></div>
          </motion.div>
          {[
            ["Mandatory left", o.mandatoryRemaining, o.blocked ? `${o.blocked} waiting on other tasks` : "Nothing blocked"],
            ["Documents ready", `${data.documents.ready}/${data.documents.total}`, "Marked ready by you"],
            ["Applications", data.applications.length, `${data.savedCount} scholarships saved`],
          ].map(([l, v, s]) => (
            <motion.div key={l as string} variants={stagger.item} className="stack" style={{ padding: 20, "--gap": "6px", borderLeft: "1px solid var(--line)" } as any}>
              <span className="tiny">{l}</span><span className="stat">{v}</span><span className="tiny">{s}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
      <p className="tiny" style={{ marginTop: -14 }}>Progress counts completed tasks only. It is not a chance of admission, funding or a visa.</p>

      <div className="grid grid-2" style={{ alignItems: "start", gap: 20 }}>
        <Reveal>
          <section className="panel panel-flush">
            <div className="panel-head"><h3>Next actions</h3><span className="tiny">Mandatory first, then confirmed deadlines</span></div>
            {data.nextActions.length === 0 ? <p className="muted" style={{ padding: 20 }}>Nothing pending. Track an application from any scholarship to get a checklist.</p> : data.nextActions.map((t: any, i: number) => (
              <Link key={t.id} to={t.application_id ? `/app/applications/${t.application_id}` : "/app/applications"} className="card-link row between" style={{ padding: "14px 20px", borderTop: i ? "1px solid var(--line)" : undefined, flexWrap: "nowrap" } as any}>
                <span className="row" style={{ flexWrap: "nowrap", "--gap": "14px" } as any}>
                  <span className="num" style={{ fontFamily: "var(--serif)", color: "var(--accent)", fontSize: 20 }}>0{i + 1}</span>
                  <span><strong style={{ fontSize: 15 }}>{t.title}</strong><br /><span className="tiny">{t.application ?? "General"} · {t.next_action ?? t.requirement_type}</span></span>
                </span>
                <ArrowRight size={15} color="var(--ink-3)" />
              </Link>
            ))}
          </section>
        </Reveal>
        <Reveal delay={0.05}>
          <section className="panel panel-flush">
            <div className="panel-head"><h3><CalendarDays size={16} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Agenda</h3><span className="tiny">Open tasks with dates</span></div>
            {data.agenda.length === 0 ? <p className="muted" style={{ padding: 20 }}>No dates yet. Deadlines appear once confirmed from an official call, or when you add your own.</p> : (
              <div style={{ padding: "4px 20px 12px" }}>
                {Object.entries(months).map(([m, items]) => (
                  <div key={m} style={{ marginTop: 12 }}>
                    <div className="label">{new Date(m + "-01T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</div>
                    {items.map((d: any) => {
                      const days = Math.round((Date.parse(d.date) - Date.now()) / 86_400_000);
                      return (
                        <Link key={d.id} to={d.application_id ? `/app/applications/${d.application_id}` : "/app/applications"} className="card-link row between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" } as any}>
                          <span className="row" style={{ flexWrap: "nowrap", "--gap": "12px" } as any}>
                            <span className="num" style={{ width: 28, fontSize: 20, fontFamily: "var(--serif)" }}>{d.date.slice(8, 10)}</span>
                            <span><span style={{ fontWeight: 500, fontSize: 14.5 }}>{d.title}</span><br /><span className="tiny">{d.application ?? "Own task"} · {d.confirmed ? "confirmed deadline" : "not confirmed"}</span></span>
                          </span>
                          <span className={`badge ${days < 0 ? "b-bad" : days <= 14 ? "b-warn" : "b-neutral"}`}>{days < 0 ? `${-days}d overdue` : `${days}d`}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </section>
        </Reveal>
      </div>

      <FinanceCard finance={data.finance} />

      <Reveal>
        <section className="panel panel-flush">
          <div className="panel-head"><h3>Applications</h3><Link to="/app/applications" className="btn btn-soft btn-sm">Manage</Link></div>
          {data.applications.length === 0 ? (
            <Empty title="No applications yet"><p className="muted">Open a scholarship and choose "Track application".</p><Link to="/scholarships" className="btn btn-primary btn-sm">Browse scholarships</Link></Empty>
          ) : data.applications.map((a: any) => (
            <Link key={a.id} to={`/app/applications/${a.id}`} className="card-link stack" style={{ "--gap": "10px", padding: "16px 20px", borderTop: "1px solid var(--line)" } as any}>
              <div className="row between"><strong>{a.title}</strong><span className="row" style={{ "--gap": "6px" } as any}><span className="badge b-neutral">{a.stage.replace("_", " ")}</span>{a.daysLeft !== null && <span className="badge b-info">{a.daysLeft}d left</span>}</span></div>
              <ProgressBar value={a.progress.percent} label={`${a.title} progress`} />
              <span className="tiny num">{a.progress.done}/{a.progress.total} tasks · {a.progress.mandatoryRemaining} mandatory left{a.progress.blocked ? ` · ${a.progress.blocked} blocked` : ""}</span>
            </Link>
          ))}
        </section>
      </Reveal>

      <div className="grid grid-2" style={{ alignItems: "start", gap: 20 }}>
        <section className="panel panel-flush">
          <div className="panel-head"><h3><Sparkles size={16} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Relevant opportunities</h3><Link to="/app/matches" className="tiny">All matches</Link></div>
          {data.opportunities.length === 0 ? <p className="muted" style={{ padding: 20 }}>{noProfile ? "Complete your profile to see awards that fit." : "Nothing new that fits your profile right now."}</p> : data.opportunities.map((s: any) => (
            <Link key={s.id} to={`/scholarships/${s.id}`} className="card-link stack" style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", "--gap": "6px" } as any}>
              <span style={{ fontWeight: 500, fontSize: 14.5 }}>{s.name}</span>
              <span className="row" style={{ "--gap": "6px" } as any}><EligBadge status={s.overall} /><StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} /><span className="tiny">{COUNTRY[s.country]?.name} · {FUNDING_LABEL[(s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL]}</span></span>
            </Link>
          ))}
        </section>
        <section className="panel panel-flush">
          <div className="panel-head"><h3><Wallet size={16} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Funding actions</h3></div>
          {data.funding.length === 0 ? <p className="muted" style={{ padding: 20 }}>No funding actions right now.</p> : data.funding.map((f: any) => (
            <Link key={f.title} to={f.to} className="card-link" style={{ display: "block", padding: "12px 20px", borderTop: "1px solid var(--line)" }}>
              <strong style={{ fontSize: 14.5 }}>{f.title}</strong><div className="tiny">{f.why}</div>
            </Link>
          ))}
        </section>
      </div>

      <div className="grid grid-2" style={{ alignItems: "start", gap: 20 }}>
        <section className="panel">
          <h3 style={{ marginBottom: 10 }}><AlertTriangle size={16} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Needs attention</h3>
          {data.attention.length === 0 ? <p className="muted">Nothing flagged.</p> : data.attention.map((a: any) => <div key={a.id} style={{ padding: "8px 0" }}><strong style={{ fontSize: 14.5 }}>{a.title}</strong><div className="tiny">{a.why}</div></div>)}
        </section>
        <section className="panel">
          <h3 style={{ marginBottom: 10 }}><Bell size={16} style={{ display: "inline", verticalAlign: -2, marginRight: 6 }} />Updates</h3>
          {data.notifications.length === 0 ? <p className="muted">No updates. You'll hear about changes to awards you save or track.</p> : data.notifications.map((n: any) => <div key={n.id} style={{ padding: "8px 0" }}><strong style={{ fontSize: 14.5 }}>{n.title}</strong><div className="tiny">{n.body} · {fmtDate(n.created_at)}</div></div>)}
        </section>
      </div>
    </div>
  );
}

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString("en-PK")}`;

/** Latest saved financial plan. Kept separate from application progress on purpose. */
function FinanceCard({ finance }: { finance: any }) {
  if (!finance)
    return (
      <section className="panel row between" aria-label="Financial plan">
        <div><h3>Financial plan</h3><p className="muted" style={{ fontSize: 14.5, marginTop: 4 }}>See what your studies cost with and without a scholarship, and the cash you need at each stage.</p></div>
        <Link to="/costs" className="btn btn-primary btn-sm">Open Cost Planner <ArrowRight size={14} /></Link>
      </section>
    );
  const sc = finance.summary.scenarios as any[];
  const confirmed = sc.find((s) => s.key === "confirmed");
  const potential = sc.filter((s) => s.key === "potential");
  const current = confirmed ?? sc[0];
  const cell = (label: string, value: string, sub: string, color?: string, first?: boolean) => (
    <div className="stack" style={{ padding: 20, "--gap": "4px", borderLeft: first ? undefined : "1px solid var(--line)" } as any}>
      <span className="tiny">{label}</span><span className="stat" style={{ fontSize: 24, color }}>{value}</span><span className="tiny">{sub}</span>
    </div>
  );
  return (
    <section className="panel panel-flush" aria-label="Financial plan">
      <div className="panel-head">
        <div><h3>Financial plan · {finance.title}</h3><div className="tiny" style={{ marginTop: 2 }}>Version {finance.version} · saved {fmtDate(finance.created_at)} · tracked separately from application progress</div></div>
        <Link to={`/costs?plan=${finance.plan_id}`} className="btn btn-soft btn-sm">Open plan</Link>
      </div>
      <div className="grid stat-strip" style={{ gap: 0 }}>
        <div className="stack" style={{ padding: 20, "--gap": "4px" } as any}><span className="tiny">Scenario in use</span><strong style={{ fontSize: 15 }}>{current.title}</strong><span className="tiny">{confirmed ? "Based on your confirmed award" : "No confirmed award, so planning without one"}</span></div>
        {cell("You'd still pay", pkr(current.remaining), "whole programme")}
        {cell("Funding gap", current.gap ? pkr(current.gap) : "None", "vs funds you have", current.gap ? "var(--bad)" : "var(--ok)")}
        {cell("Cash before & on arrival", pkr(current.upfrontCash), "first stages")}
      </div>
      <div className="row" style={{ padding: "12px 20px", borderTop: "1px solid var(--line)", "--gap": "8px" } as any}>
        <span className="badge b-ok">Confirmed funding: {confirmed ? pkr(confirmed.covered) : "none"}</span>
        <span className="badge b-warn">Potential funding: {potential.length ? potential.map((p) => pkr(p.covered)).join(" / ") : "none"} (not counted)</span>
        {finance.summary.missing.length > 0 && <span className="badge b-bad">{finance.summary.missing.length} unknown cost(s)</span>}
        {finance.summary.evidence.VERIFIED === 0 && <span className="badge b-neutral">No verified official figures yet</span>}
      </div>
    </section>
  );
}
