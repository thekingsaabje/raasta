import { useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Page } from "../components/Layout";
import { Modal, Notice, Skeleton, StatusBadge, TestBadge, useToast } from "../components/ui";
import { api } from "../lib/api";
import { fmtDate, useApi } from "../lib/use";

const TABS = ["Coverage", "Review tasks", "Sources", "Scholarships", "Reports", "Users", "Audit"] as const;
const OPP = ["VERIFIED_OPEN", "VERIFIED_UPCOMING", "VERIFIED_CLOSED", "CANCELLED", "NEEDS_REVIEW", "CONFLICTING_SOURCES", "UNKNOWN"];
const POLICY = ["DRAFTING_ALLOWED", "EDITING_ONLY", "COACHING_ONLY", "POLICY_UNCONFIRMED"];

export function Admin() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Coverage");
  return (
    <Page>
      <h1>Admin · source intelligence</h1>
      <p className="muted" style={{ marginTop: 8 }}>Coverage, review work, verification and corrections.</p>
      <div className="seg" role="tablist" style={{ margin: "20px 0", overflowX: "auto", maxWidth: "100%" }}>{TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === "Coverage" && <Coverage />}
      {tab === "Review tasks" && <ReviewTasks />}
      {tab === "Users" && <Users />}
      {tab === "Sources" && <Sources />}
      {tab === "Scholarships" && <Scholarships />}
      {tab === "Reports" && <Reports />}
      {tab === "Audit" && <Audit />}
    </Page>
  );
}

function Coverage() {
  const { data } = useApi<any>("/admin/coverage");
  if (!data) return <Skeleton h={200} />;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return (
    <div className="stack">
      <Notice kind="info">These numbers measure only what's in Raasta's own source inventory. They are not a measure of every scholarship that exists. Three things are measured separately: sources, records and evidence.</Notice>
      <div className="grid grid-4">
        {[
          ["Sources in inventory", data.sources.total, `${data.sources.checked_ok ?? 0} fetched OK at least once`],
          ["Sources reviewed/indexed", (data.sources.reviewed ?? 0) + (data.sources.indexed ?? 0), `${data.sources.discovered ?? 0} discovered · ${data.sources.outstanding ?? 0} outstanding · ${data.sources.inaccessible ?? 0} inaccessible`],
          ["Scholarship records", data.scholarships.total, `${data.scholarships.verified ?? 0} verified · ${data.scholarships.needs_review ?? 0} need review · ${data.scholarships.test_data ?? 0} test`],
          ["Rules with evidence", `${pct(data.requirements.with_evidence ?? 0, data.requirements.total)}%`, `${data.requirements.verified ?? 0}/${data.requirements.total} rules verified · ${data.requirements.conflicting ?? 0} conflicting`],
          ["Open error reports", data.reports.open ?? 0, "Student-submitted"],
        ].map(([l, v, s]) => (
          <div key={l as string} className="card stack" style={{ "--gap": "6px" } as any}><span className="subtle">{l}</span><span className="stat">{v}</span><span className="subtle">{s}</span></div>
        ))}
      </div>
      <div className="grid grid-2">
        <div className="panel"><h3>Sources by country</h3><div className="row" style={{ marginTop: 10 }}>{data.byCountry.map((c: any) => <span key={c.country} className="badge b-neutral">{c.country}: {c.sources}</span>)}</div></div>
        <div className="panel"><h3>Scheduled source checks (last 24h)</h3><p className="muted" style={{ marginTop: 8 }}>{data.job?.checks ? `${data.job.checks} checks, ${data.job.ok ?? 0} succeeded. Last run ${fmtDate(data.job.last)}.` : "No checks in the last 24 hours. Investigate the cron trigger."}</p></div>
        <div className="panel"><h3>Records by status (real data)</h3><div className="stack" style={{ "--gap": "6px", marginTop: 10 } as any}>{data.byStatus.map((r: any) => <div key={r.status + r.method} className="row between"><StatusBadge status={r.status} method={r.method} /><span className="num">{r.n}</span></div>)}</div></div>
        <div className="panel"><h3>Open review tasks</h3><div className="stack" style={{ "--gap": "6px", marginTop: 10 } as any}>{data.tasks.length === 0 ? <span className="muted">None</span> : data.tasks.map((t: any) => <div key={t.kind} className="row between"><span>{t.kind.replace("_", " ")}</span><span className="num">{t.n}</span></div>)}</div></div>
      </div>
    </div>
  );
}

function ReviewTasks() {
  const { data, reload } = useApi<any>("/admin/review-tasks");
  if (!data) return <Skeleton h={200} />;
  const close = async (id: number, status: string) => {
    const note = prompt("What did you check or change?");
    if (!note) return;
    await api.patch(`/admin/review-tasks/${id}`, { status, note });
    reload();
  };
  return (
    <div className="panel panel-flush">
      <div className="panel-head"><h3>Review queue</h3><span className="tiny">Opened by the source monitor, deadline checks and student reports</span></div>
      {data.tasks.length === 0 && <p className="muted" style={{ padding: 20 }}>No review tasks.</p>}
      {data.tasks.map((t: any) => (
        <div key={t.id} className="row between" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", alignItems: "flex-start" }}>
          <div className="grow">
            <div className="row" style={{ "--gap": "8px" } as any}><span className={`badge ${t.status === "open" ? "b-warn" : "b-neutral"}`}>{t.kind.replace("_", " ")}</span><strong style={{ fontSize: 14.5 }}>{t.scholarship_name ?? t.source_name ?? "—"}</strong></div>
            <div className="subtle" style={{ marginTop: 4 }}>{t.detail}</div>
            <div className="tiny">{fmtDate(t.created_at)}{t.source_url && <> · <a href={t.source_url} target="_blank" rel="noopener noreferrer">source</a></>}</div>
          </div>
          {t.status === "open" && <span className="row" style={{ "--gap": "6px" } as any}><button className="btn btn-soft btn-sm" onClick={() => close(t.id, "done")}>Done</button><button className="btn btn-soft btn-sm" onClick={() => close(t.id, "dismissed")}>Dismiss</button></span>}
        </div>
      ))}
    </div>
  );
}

function Users() {
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const issue = async () => {
    setErr(null);
    setLink(null);
    try {
      setLink((await api.post("/admin/users/reset-link", { email })).link);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <div className="panel stack" style={{ maxWidth: 640 }}>
      <h3>Password reset link</h3>
      <p className="muted">There's no email service yet. Issue a single-use link (valid 24 hours) and send it to the student yourself, e.g. by WhatsApp. Confirm their identity first.</p>
      <div className="row" style={{ flexWrap: "nowrap" } as any}><input className="input" type="email" placeholder="student@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Student email" /><button className="btn btn-primary" disabled={!email.includes("@")} onClick={issue}>Issue link</button></div>
      {err && <Notice kind="bad">{err}</Notice>}
      {link && <Notice kind="ok"><span style={{ wordBreak: "break-all" }}>Shown once. Copy it now: <strong>{link}</strong></span></Notice>}
    </div>
  );
}

function Sources() {
  const { data, reload } = useApi<any>("/admin/sources");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!data) return <Skeleton h={300} />;
  const run = async () => {
    setBusy(true);
    try {
      const r = await api.post("/admin/sources/check");
      toast(`Checked ${r.checked} sources`);
      reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card stack">
      <div className="row between"><h3>Source registry ({data.sources.length})</h3><button className="btn btn-soft btn-sm" disabled={busy} onClick={run}><RefreshCw size={14} />{busy ? "Checking…" : "Check 5 oldest now"}</button></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Source</th><th>Country</th><th>Category</th><th>Last OK</th><th>Fails</th><th>Status</th></tr></thead>
          <tbody>
            {data.sources.map((s: any) => (
              <tr key={s.id}>
                <td><a href={s.url} target="_blank" rel="noopener noreferrer">{s.name} <ExternalLink size={11} style={{ display: "inline" }} /></a><div className="subtle">{s.authority}</div></td>
                <td>{s.country}</td><td>{s.category}</td><td>{fmtDate(s.last_success_at)}</td><td>{s.fail_count}</td>
                <td>
                  <select className="input" value={s.review_status} onChange={async (e) => { await api.patch(`/admin/sources/${s.id}`, { review_status: e.target.value }); reload(); }}>
                    {["discovered", "reviewed", "indexed", "inaccessible", "outstanding"].map((x) => <option key={x}>{x}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Scholarships() {
  const { data, reload } = useApi<any>("/scholarships");
  const [edit, setEdit] = useState<any>(null);
  const [reqs, setReqs] = useState<any[]>([]);
  const [f, setF] = useState<any>({});
  const [err, setErr] = useState<string | null>(null);
  const toast = useToast();
  if (!data) return <Skeleton h={300} />;
  const open = async (s: any) => {
    setEdit(s);
    setErr(null);
    setF({ status: s.status, deadline_date: s.deadline_date ?? "", deadline_text: s.deadline_text ?? "", writing_policy: s.writing_policy, reason: "" });
    setReqs((await api.get(`/scholarships/${s.id}`)).requirements);
  };
  const save = async () => {
    try {
      const r = await api.patch(`/admin/scholarships/${edit.id}`, { ...f, deadline_date: f.deadline_date || null });
      toast(`Saved v${r.scholarship.version}. ${r.notified} student(s) notified.`);
      setEdit(null);
      reload();
    } catch (e: any) {
      setErr(e.message);
    }
  };
  const verifyReq = async (r: any, review_status: string) => {
    const reason = prompt("Reason / what you checked on the official page:");
    if (!reason) return;
    try {
      await api.patch(`/admin/requirements/${r.id}`, { review_status, reason });
      setReqs((await api.get(`/scholarships/${edit.id}`)).requirements);
    } catch (e: any) {
      toast(e.message);
    }
  };
  return (
    <div className="card">
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Scholarship</th><th>Status</th><th>Rules</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {data.scholarships.map((s: any) => (
              <tr key={s.id}>
                <td><strong>{s.name}</strong> {!!s.is_test_data && <TestBadge />}<div className="subtle">{s.country} · {s.provider}</div></td>
                <td><StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} /></td>
                <td>{s.verified_rules}/{s.rule_count}</td>
                <td>{fmtDate(s.updated_at)} · v{s.version}</td>
                <td><button className="btn btn-soft btn-sm" onClick={() => open(s)}>Review</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.name ?? ""}>
        {edit && (
          <div className="stack">
            <a href={edit.official_url} target="_blank" rel="noopener noreferrer" className="subtle">Open official source <ExternalLink size={11} style={{ display: "inline" }} /></a>
            <label className="field"><span>Status</span><select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{OPP.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="field"><span>Checked deadline date</span><input className="input" type="date" value={f.deadline_date} onChange={(e) => setF({ ...f, deadline_date: e.target.value })} /></label>
            <label className="field"><span>Deadline text (as published)</span><input className="input" value={f.deadline_text} onChange={(e) => setF({ ...f, deadline_text: e.target.value })} /></label>
            <label className="field"><span>Writing policy</span><select className="input" value={f.writing_policy} onChange={(e) => setF({ ...f, writing_policy: e.target.value })}>{POLICY.map((o) => <option key={o}>{o}</option>)}</select></label>
            <label className="field"><span>Reason for change (required, kept in history)</span><input className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></label>
            {err && <Notice kind="bad">{err}</Notice>}
            <button className="btn btn-primary" disabled={f.reason.trim().length < 3} onClick={save}>Save new version</button>
            <div className="divider" />
            <h3>Rules</h3>
            {reqs.map((r) => (
              <div key={r.id} className="stack" style={{ "--gap": "4px", borderTop: "1px solid var(--line)", paddingTop: 8 } as any}>
                <div className="row between"><strong style={{ fontSize: 14 }}>{r.text}</strong><span className={`badge ${r.review_status === "VERIFIED" ? "b-ok" : "b-warn"}`}>{r.review_status}</span></div>
                {r.excerpt && <span className="subtle">"{r.excerpt}"</span>}
                <span className="row" style={{ "--gap": "6px" } as any}>
                  <button className="btn btn-soft btn-sm" onClick={() => verifyReq(r, "VERIFIED")}>Verify</button>
                  <button className="btn btn-soft btn-sm" onClick={() => verifyReq(r, "CONFLICTING")}>Conflicting</button>
                  <button className="btn btn-soft btn-sm" onClick={() => verifyReq(r, "NEEDS_REVIEW")}>Back to review</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

function Reports() {
  const { data, reload } = useApi<any>("/admin/reports");
  if (!data) return <Skeleton h={200} />;
  const resolve = async (id: string, status: string) => {
    const resolution = prompt("Resolution note:");
    if (!resolution) return;
    await api.patch(`/admin/reports/${id}`, { status, resolution });
    reload();
  };
  return (
    <div className="card stack">
      <h3>Correction queue</h3>
      {data.reports.length === 0 && <p className="muted">No reports.</p>}
      {data.reports.map((r: any) => (
        <div key={r.id} className="stack" style={{ "--gap": "6px", borderTop: "1px solid var(--line)", paddingTop: 10 } as any}>
          <div className="row between"><strong>{r.scholarship_name}</strong><span className={`badge ${r.status === "open" ? "b-warn" : "b-neutral"}`}>{r.status}</span></div>
          <p>{r.message}</p>
          <span className="subtle">{fmtDate(r.created_at)}{r.requirement_id ? ` · rule ${r.requirement_id}` : ""}{r.resolution ? ` · ${r.resolution}` : ""}</span>
          {r.status === "open" && <span className="row"><button className="btn btn-soft btn-sm" onClick={() => resolve(r.id, "accepted")}>Accept</button><button className="btn btn-soft btn-sm" onClick={() => resolve(r.id, "fixed")}>Fixed</button><button className="btn btn-soft btn-sm" onClick={() => resolve(r.id, "rejected")}>Reject</button></span>}
        </div>
      ))}
    </div>
  );
}

function Audit() {
  const { data } = useApi<any>("/admin/audit");
  if (!data) return <Skeleton h={200} />;
  return (
    <div className="card table-wrap">
      <table className="table">
        <thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
        <tbody>{data.audit.map((a: any) => <tr key={a.id}><td>{fmtDate(a.created_at)}</td><td>{a.action}</td><td>{a.entity} {a.entity_id}</td><td className="subtle" style={{ maxWidth: 360, wordBreak: "break-word" }}>{a.detail}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
