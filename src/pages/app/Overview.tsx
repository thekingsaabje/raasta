import { motion } from "motion/react";
import { AlertTriangle, ArrowRight, Bell, Bookmark, CalendarClock, FileCheck2, ListChecks, Target } from "lucide-react";
import { Empty, Notice, ProgressBar, Reveal, Ring, Skeleton, stagger } from "../../components/ui";
import { fmtDate, useApi } from "../../lib/use";
import { Link } from "../../lib/router";
import { useAuth } from "../../lib/auth";

export function Overview() {
  const { user } = useAuth();
  const { data, loading, error } = useApi<any>("/me/dashboard");
  if (loading) return <div className="stack"><Skeleton h={40} w="50%" /><Skeleton h={160} /><Skeleton h={220} /></div>;
  if (error || !data) return <Notice kind="bad">{error}</Notice>;
  const p = data.profile;
  const o = data.overall;
  const noProfile = Object.keys(p).length === 0;

  return (
    <div className="stack" style={{ "--gap": "20px" } as any}>
      <div className="row between">
        <div>
          <p className="eyebrow">Your dashboard</p>
          <h2 style={{ marginTop: 4 }}>Salaam, {user?.name.split(" ")[0]}.</h2>
          <p className="muted">
            {p.targetLevel ? `Goal: ${p.targetLevel}${p.targetField ? ` in ${p.targetField}` : ""}${p.targetCountries?.length ? ` · ${p.targetCountries.join(", ")}` : ""}${p.intake ? ` · intake ${p.intake}` : ""}` : "Set your study goal to personalise everything."}
          </p>
        </div>
        <Link to="/scholarships" className="btn btn-primary">Find scholarships <ArrowRight size={15} /></Link>
      </div>

      {noProfile && (
        <Notice kind="info">
          Start with your profile. It takes about 3 minutes, and every field is optional. <Link to="/app/profile"><strong>Complete profile →</strong></Link>
        </Notice>
      )}

      <motion.div className="grid grid-4" variants={stagger.container} initial="hidden" animate="show">
        <motion.div variants={stagger.item} className="card row" style={{ "--gap": "16px" } as any}>
          <Ring value={o.percent} size={92} />
          <div>
            <div className="subtle">Applicable tasks done</div>
            <div style={{ fontWeight: 600 }}>{o.done} of {o.total}</div>
            <div className="subtle">{o.verified} confirmed by institution</div>
          </div>
        </motion.div>
        <Tile icon={<ListChecks size={18} />} label="Mandatory remaining" value={o.mandatoryRemaining} sub={o.blocked ? `${o.blocked} waiting on other tasks` : "No blockers"} />
        <Tile icon={<FileCheck2 size={18} />} label="Documents ready" value={`${data.documents.ready}/${data.documents.total}`} sub="Marked ready by you" />
        <Tile icon={<Bookmark size={18} />} label="Saved · tracked" value={`${data.savedCount} · ${data.applications.length}`} sub="Scholarships · applications" />
      </motion.div>
      <p className="subtle" style={{ marginTop: -10 }}>Progress counts completed tasks only. It is not a chance of getting a scholarship or visa.</p>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <Reveal>
          <div className="card stack">
            <div className="row between"><h3><Target size={18} style={{ display: "inline", marginRight: 6 }} />Next three actions</h3></div>
            {data.nextActions.length === 0 ? (
              <p className="muted">Nothing pending. Track an application from any scholarship page to get a checklist.</p>
            ) : (
              <div className="list">
                {data.nextActions.map((t: any, i: number) => (
                  <Link key={t.id} to={t.application_id ? `/app/applications/${t.application_id}` : "/app/applications"} className="list-item row between card-link" style={{ flexWrap: "nowrap" } as any}>
                    <span className="row" style={{ flexWrap: "nowrap" } as any}>
                      <span className="badge b-neutral">{i + 1}</span>
                      <span><strong>{t.title}</strong><br /><span className="subtle">{t.next_action ?? t.requirement_type}</span></span>
                    </span>
                    <ArrowRight size={15} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="card stack">
            <h3><CalendarClock size={18} style={{ display: "inline", marginRight: 6 }} />Upcoming dates</h3>
            {data.deadlines.length === 0 ? (
              <p className="muted">No dates yet. Deadlines appear here once they're confirmed from an official call.</p>
            ) : (
              <div className="list">
                {data.deadlines.map((d: any) => (
                  <div key={d.id} className="list-item row between">
                    <span>{d.title}<br /><span className="subtle">{fmtDate(d.date)} · {d.confirmed ? "confirmed" : "not confirmed"}</span></span>
                    <span className={`badge ${d.days < 0 ? "b-bad" : d.days <= 14 ? "b-warn" : "b-neutral"}`}>{d.days < 0 ? `${-d.days}d ago` : `${d.days}d`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className="card stack">
          <div className="row between"><h3>Applications</h3><Link to="/app/applications" className="btn btn-soft btn-sm">Manage</Link></div>
          {data.applications.length === 0 ? (
            <Empty title="No applications yet"><p className="muted">Open a scholarship and click "Track application".</p><Link to="/scholarships" className="btn btn-primary btn-sm">Browse</Link></Empty>
          ) : (
            <div className="list">
              {data.applications.map((a: any) => (
                <Link key={a.id} to={`/app/applications/${a.id}`} className="list-item card-link stack" style={{ "--gap": "8px" } as any}>
                  <div className="row between"><strong>{a.title}</strong><span className="row" style={{ "--gap": "6px" } as any}><span className="badge b-neutral">{a.stage.replace("_", " ")}</span>{a.daysLeft !== null && <span className="badge b-info">{a.daysLeft}d left</span>}</span></div>
                  <ProgressBar value={a.progress.percent} label={`${a.title} progress`} />
                  <span className="subtle">{a.progress.done}/{a.progress.total} tasks · {a.progress.mandatoryRemaining} mandatory left</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Reveal>

      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card stack">
          <h3><AlertTriangle size={17} style={{ display: "inline", marginRight: 6 }} />Needs attention</h3>
          {data.attention.length === 0 ? <p className="muted">Nothing flagged.</p> : data.attention.map((a: any) => <div key={a.id}><strong>{a.title}</strong><div className="subtle">{a.why}</div></div>)}
        </div>
        <div className="card stack">
          <h3><Bell size={17} style={{ display: "inline", marginRight: 6 }} />Updates</h3>
          {data.notifications.length === 0 ? <p className="muted">No updates. You'll hear about changes to awards you save or track.</p> : data.notifications.map((n: any) => <div key={n.id}><strong>{n.title}</strong><div className="subtle">{n.body} · {fmtDate(n.created_at)}</div></div>)}
        </div>
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: React.ReactNode; sub: string }) {
  return (
    <motion.div variants={stagger.item} className="card stack" style={{ "--gap": "6px" } as any}>
      <span className="row subtle" style={{ "--gap": "6px" } as any}>{icon}{label}</span>
      <span className="stat">{value}</span>
      <span className="subtle">{sub}</span>
    </motion.div>
  );
}
