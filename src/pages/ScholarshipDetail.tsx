import { useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Flag, Plus } from "lucide-react";
import { Page } from "../components/Layout";
import { EligBadge, freshCheck, Modal, Notice, Reveal, Skeleton, StatusBadge, TestBadge, useToast } from "../components/ui";
import { COUNTRY, fmtDate, useApi } from "../lib/use";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { FUNDING_LABEL } from "../../shared/funding";
import { ApplyGuide } from "../components/ApplyGuide";

const SCOPE: Record<string, [string, string]> = {
  scholarship_eligibility: ["Eligibility to apply", "Rules that decide whether you can apply for this award."],
  admission: ["University admission", "Set by the university; meeting them is separate from the award."],
  selection: ["Selection criteria", "How applicants are ranked. Meeting rules is not a guarantee of selection."],
  financial: ["Funding terms", "What is paid, when, and under what conditions."],
  visa: ["Visa and residence", "Check the embassy's current requirements; a scholarship doesn't remove them automatically."],
};

export function ScholarshipDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const { go } = useRouter();
  const toast = useToast();
  const { data, loading, error } = useApi<any>(`/scholarships/${id}`);
  const assess = useApi<any>(user ? `/me/assessments/${id}` : null);
  const saved = useApi<any>(user ? "/me/saved" : null);
  const [report, setReport] = useState<{ open: boolean; reqId?: string }>({ open: false });
  const [msg, setMsg] = useState("");
  const isSaved = (saved.data?.saved ?? []).some((s: any) => s.id === id);

  if (loading) return <Page><Skeleton h={36} w="55%" /><div style={{ height: 18 }} /><Skeleton h={320} /></Page>;
  if (error || !data) return <Page><Notice kind="bad">{error ?? "Not found"}</Notice></Page>;
  const s = data.scholarship;
  const results: Record<string, any> = Object.fromEntries((assess.data?.assessment.results ?? []).map((r: any) => [r.requirementId, r]));
  const verified = s.status?.startsWith("VERIFIED_");
  const groups = Object.keys(SCOPE).map((k) => [k, data.requirements.filter((r: any) => (r.scope ?? "scholarship_eligibility") === k)] as const).filter(([, rs]) => rs.length);

  const toggleSave = async () => {
    if (!user) return go("/signup");
    await (isSaved ? api.del(`/me/saved/${id}`) : api.post(`/me/saved/${id}`));
    saved.reload();
    toast(isSaved ? "Removed from saved" : "Saved to your dashboard");
  };
  const track = async () => {
    if (!user) return go("/signup");
    try {
      const r = await api.post("/me/applications", { scholarshipId: id });
      toast("Tracker created with a starting checklist");
      go(`/app/applications/${r.application.id}`);
    } catch (e: any) {
      toast(e.message);
    }
  };
  const sendReport = async () => {
    try {
      await api.post("/reports", { scholarshipId: id, requirementId: report.reqId, message: msg });
      setReport({ open: false });
      setMsg("");
      toast("Thanks, your report is in our review queue.");
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <Page>
      <Link to="/scholarships" className="btn btn-link btn-sm" style={{ textDecoration: "none" }}><ArrowLeft size={14} /> All scholarships</Link>
      <Reveal>
        <div className="stack" style={{ "--gap": "14px", margin: "18px 0 28px" } as any}>
          <div className="row" style={{ "--gap": "8px" } as any}>
            <span className={`flag flag-${s.country}`}>{s.country}</span><span className="subtle">{COUNTRY[s.country]?.name} · {s.provider}</span>
          </div>
          <h1 style={{ maxWidth: 860 }}>{s.name}</h1>
          <div className="row" style={{ "--gap": "8px" } as any}>
            <StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} checkedAt={s.source_checked_at} check={s.source_check} />
            {!!s.is_test_data && <TestBadge />}
            {assess.data && <EligBadge status={assess.data.assessment.overall} prefix="You" />}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <a className="btn btn-primary" href={s.official_url} target="_blank" rel="noopener noreferrer">Official page <ExternalLink size={14} /></a>
            <button className="btn btn-ghost" onClick={track}><Plus size={15} />Track application</button>
            <button className="btn btn-ghost" onClick={toggleSave} aria-pressed={isSaved}>{isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{isSaved ? "Saved" : "Save"}</button>
            <button className="btn btn-link" onClick={() => setReport({ open: true })}><Flag size={14} />Report an error</button>
          </div>
        </div>
      </Reveal>

      {!verified && (
        <div style={{ marginBottom: 20 }}>
          <Notice kind={s.is_test_data ? "warn" : "info"}>
            {s.is_test_data
              ? "This is a TEST record used to demonstrate the eligibility engine. It is not a real opportunity."
              : <><strong>Taken from the official page{freshCheck(s.source_checked_at, s.source_check) ? `, re-checked automatically on ${fmtDate(s.source_checked_at)}` : ""}.</strong> Every date and rule below is quoted word for word from the provider's own page. Rules can change between rounds, so open the official page and confirm before you apply.</>}
          </Notice>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 340px)", gap: 20, alignItems: "start" }} data-detail-grid>
        <div className="stack" style={{ "--gap": "20px" } as any}>
          {!user && <Notice kind="info"><span><Link to="/route">Answer a few questions</Link> to check each rule against your profile.</span></Notice>}
          {assess.data && (
            <div className="sunk"><strong style={{ fontSize: 14.5 }}>{assess.data.assessment.summary}</strong><div className="subtle" style={{ marginTop: 4 }}>{assess.data.assessment.note}</div></div>
          )}
          {!s.is_test_data && <ApplyGuide s={s} reqs={data.requirements} />}
          {data.requirements.length === 0 && <div className="panel"><p className="muted">No requirements recorded yet. Use the official page.</p></div>}
          {groups.map(([scope, reqs]) => (
            <section key={scope} className="panel panel-flush">
              <div className="panel-head"><div><h3>{SCOPE[scope][0]}</h3><div className="tiny" style={{ marginTop: 2 }}>{SCOPE[scope][1]}</div></div></div>
              {reqs.map((r: any) => {
                const res = results[r.id];
                return (
                  <div key={r.id} className="stack" style={{ "--gap": "8px", padding: "16px 20px", borderTop: "1px solid var(--line)" } as any}>
                    <div className="row between" style={{ alignItems: "flex-start", flexWrap: "nowrap" } as any}>
                      <strong style={{ fontSize: 15 }}>{r.text}</strong>
                      <span className="row" style={{ "--gap": "6px", flexShrink: 0 } as any}>
                        {res && <EligBadge status={res.status} />}
                        <span className={`badge ${r.review_status === "VERIFIED" ? "b-ok" : r.review_status === "CONFLICTING" ? "b-bad" : "b-neutral"}`}>{r.review_status === "VERIFIED" ? "Rule verified" : r.review_status === "CONFLICTING" ? "Sources conflict" : "Unverified"}</span>
                      </span>
                    </div>
                    {res && <div className="subtle">{res.reason} <span style={{ color: "var(--ink)" }}>Next: {res.nextAction}</span></div>}
                    {r.excerpt && <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--line-2)", fontSize: 13.5, color: "var(--ink-2)" }}>"{r.excerpt}"</blockquote>}
                    {r.original_excerpt && <blockquote lang="und" style={{ margin: 0, paddingLeft: 12, borderLeft: "2px solid var(--line-2)", fontSize: 13.5, color: "var(--ink-3)" }}>{r.original_excerpt}</blockquote>}
                    <div className="row tiny" style={{ "--gap": "14px" } as any}>
                      {r.source_url && <a href={r.source_url} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={11} style={{ display: "inline" }} /></a>}
                      {r.retrieved_at && <span>Retrieved {fmtDate(r.retrieved_at)}</span>}
                      <button className="btn-link" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", font: "inherit", color: "inherit", textDecoration: "underline" }} onClick={() => setReport({ open: true, reqId: r.id })}>Report</button>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>

        <aside className="panel" style={{ position: "sticky", top: 92 }}>
          <div className="label" style={{ marginBottom: 6 }}>Funding</div>
          <div className="fund" style={{ fontSize: 18, fontFamily: "var(--serif)" }}>{FUNDING_LABEL[(s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL]}</div>
          <p className="subtle" style={{ marginTop: 8 }}>{s.funding_summary ?? "Not recorded."}</p>
          <div className="divider" style={{ margin: "18px 0" }} />
          <dl className="kv">
            <dt>Levels</dt><dd>{(s.levels ?? []).map((l: string) => ({ bachelor: "Bachelor's", master: "Master's", phd: "PhD" } as Record<string, string>)[l] ?? l).join(", ") || "—"}</dd>
            <dt>Applicants</dt><dd>{s.applicant_type === "new" ? "New applicants" : s.applicant_type === "continuing" ? "Continuing students" : "New & continuing"}</dd>
            <dt>Route</dt><dd>{s.application_route ?? "—"}</dd>
            <dt>Deadline</dt><dd>{s.deadline_date && verified ? <><span className="num">{fmtDate(s.deadline_date)}</span><div className="tiny">confirmed by a reviewer</div></> : s.proposed_deadline ? <><span className="num">{fmtDate(s.proposed_deadline)}</span><div className="tiny">from the official page</div></> : s.deadline_text ?? "Not published"}</dd>
            <dt>Official page shows</dt><dd>{{ open: "Applications open", upcoming: "Opens later", closed: "Round closed", unknown: "No current call found" }[s.cycle_state as string] ?? "—"}{!verified && <div className="tiny">research evidence, not confirmation</div>}</dd>
            <dt>Academic year</dt><dd>{s.academic_year ?? "—"}</dd>
            <dt>Retrieved</dt><dd>{fmtDate(s.retrieved_at)}</dd>
            <dt>Verified</dt><dd>{verified && s.last_verified_at ? <>{fmtDate(s.last_verified_at)}<div className="tiny">by a Raasta reviewer</div></> : "Not yet"}</dd>
            <dt>Record</dt><dd>Version {s.version}</dd>
          </dl>
          {/* Internal research notes are for reviewers; students get the plain-English status reason above. */}
          {s.evidence_note && user?.role === "admin" && <><div className="divider" style={{ margin: "18px 0" }} /><p className="tiny"><strong>Research note (admins only).</strong> {s.evidence_note}</p></>}
        </aside>
      </div>

      <Modal open={report.open} onClose={() => setReport({ open: false })} title="Report an error">
        <div className="stack">
          <p className="muted">Tell us what's wrong and, if you can, link the official page with the correct information.</p>
          <textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. The official page says the deadline is 15 March, not 1 March. Link: …" maxLength={2000} aria-label="Describe the error" />
          <div className="row between"><span className="tiny">{msg.trim().length < 5 ? "At least 5 characters" : `${msg.length}/2000`}</span><button className="btn btn-primary" disabled={msg.trim().length < 5} onClick={sendReport}>Send report</button></div>
        </div>
      </Modal>
    </Page>
  );
}
