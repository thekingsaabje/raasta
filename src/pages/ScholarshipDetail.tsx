import { useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, ExternalLink, Flag, Plus } from "lucide-react";
import { Page } from "../components/Layout";
import { EligBadge, Modal, Notice, Reveal, Skeleton, StatusBadge, TestBadge, useToast } from "../components/ui";
import { COUNTRY, fmtDate, useApi } from "../lib/use";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";

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

  if (loading) return <Page><Skeleton h={40} w="60%" /><div style={{ height: 16 }} /><Skeleton h={240} /></Page>;
  if (error || !data) return <Page><Notice kind="bad">{error ?? "Not found"}</Notice></Page>;
  const s = data.scholarship;
  const results: Record<string, any> = Object.fromEntries((assess.data?.assessment.results ?? []).map((r: any) => [r.requirementId, r]));

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
      toast("Application tracker created with a starting checklist");
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
      toast("Thanks. Your report is in our review queue.");
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <Page>
      <Link to="/scholarships" className="btn btn-soft btn-sm"><ArrowLeft size={14} /> Catalogue</Link>
      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr)", gap: 22, marginTop: 18 }}>
        <Reveal>
          <div className="stack" style={{ "--gap": "14px" } as any}>
            <div className="row">
              <span className="flag">{s.country}</span><span className="subtle">{COUNTRY[s.country]?.name}</span>
              <StatusBadge status={s.status} />{!!s.is_test_data && <TestBadge />}
            </div>
            <h1 style={{ fontSize: "clamp(1.9rem,4vw,3rem)" }}>{s.name}</h1>
            <p className="muted">{s.provider}</p>
            <div className="row">
              <a className="btn btn-primary" href={s.official_url} target="_blank" rel="noopener noreferrer">Official page <ExternalLink size={14} /></a>
              <button className="btn btn-ghost" onClick={toggleSave}>{isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}{isSaved ? "Saved" : "Save"}</button>
              <button className="btn btn-ghost" onClick={track}><Plus size={15} />Track application</button>
              <button className="btn btn-soft" onClick={() => setReport({ open: true })}><Flag size={14} />Report an error</button>
            </div>
          </div>
        </Reveal>

        {s.status !== "VERIFIED_OPEN" && s.status !== "VERIFIED_UPCOMING" && (
          <Notice kind="warn">
            {s.is_test_data
              ? "This is a TEST record used to demonstrate the eligibility engine. It is not a real opportunity."
              : "A person has not yet confirmed the current call for this award. Treat the deadline and rules below as leads to check on the official page, not as confirmed facts."}
          </Notice>
        )}

        <div className="grid grid-2" style={{ alignItems: "start" }}>
          <div className="card stack">
            <h3>Funding</h3>
            <p className="muted">{s.funding_summary ?? "Not recorded."}</p>
            <div className="divider" />
            <dl className="kv">
              <dt>Levels</dt><dd>{(s.levels ?? []).join(", ") || "—"}</dd>
              <dt>Applicants</dt><dd>{s.applicant_type === "new" ? "New applicants" : s.applicant_type === "continuing" ? "Continuing students" : "New & continuing"}</dd>
              <dt>Route</dt><dd>{s.application_route ?? "—"}</dd>
              <dt>Deadline</dt><dd>{s.deadline_date ? fmtDate(s.deadline_date) : s.deadline_text ?? "Not confirmed"}</dd>
              <dt>Academic year</dt><dd>{s.academic_year ?? "—"}</dd>
              <dt>Retrieved</dt><dd>{fmtDate(s.retrieved_at)}</dd>
              <dt>Verified</dt><dd>{s.last_verified_at ? fmtDate(s.last_verified_at) : "Not yet"}</dd>
              <dt>Record version</dt><dd>v{s.version}</dd>
            </dl>
            {s.evidence_note && <p className="subtle"><strong>Research note:</strong> {s.evidence_note}</p>}
          </div>

          <div className="card stack">
            <div className="row between">
              <h3>Requirements</h3>
              {assess.data && <EligBadge status={assess.data.assessment.overall} prefix="You" />}
            </div>
            {!user && <p className="subtle"><Link to="/signup">Create a free account</Link> to check each rule against your profile.</p>}
            {assess.data && <p className="subtle">{assess.data.assessment.summary} {assess.data.assessment.note}</p>}
            <div className="list">
              {data.requirements.length === 0 && <p className="muted">No requirements recorded yet.</p>}
              {data.requirements.map((r: any) => (
                <div key={r.id} className="list-item stack" style={{ "--gap": "6px" } as any}>
                  <div className="row between" style={{ alignItems: "flex-start" }}>
                    <strong style={{ flex: 1, minWidth: 200 }}>{r.text}</strong>
                    <span className="row" style={{ "--gap": "6px" } as any}>
                      {results[r.id] && <EligBadge status={results[r.id].status} />}
                      <span className={`badge ${r.review_status === "VERIFIED" ? "b-ok" : r.review_status === "CONFLICTING" ? "b-bad" : "b-warn"}`}>{r.review_status === "VERIFIED" ? "Rule verified" : r.review_status === "CONFLICTING" ? "Sources conflict" : "Rule unverified"}</span>
                    </span>
                  </div>
                  {results[r.id] && <span className="subtle">{results[r.id].reason}</span>}
                  {r.excerpt && <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: "3px solid var(--line)", fontSize: 13 }} className="muted">"{r.excerpt}"</blockquote>}
                  <div className="row" style={{ "--gap": "10px" } as any}>
                    {r.source_url && <a className="subtle" href={r.source_url} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={11} style={{ display: "inline" }} /></a>}
                    <button className="subtle" style={{ background: "none", border: 0, cursor: "pointer", padding: 0, textDecoration: "underline" }} onClick={() => setReport({ open: true, reqId: r.id })}>Report</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Modal open={report.open} onClose={() => setReport({ open: false })} title="Report an error">
        <div className="stack">
          <p className="muted">Tell us what's wrong and, if you can, link the official page that shows the correct information.</p>
          <textarea className="input" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="e.g. The deadline on the official page is 15 March, not 1 March. Link: …" maxLength={2000} />
          <button className="btn btn-primary" disabled={msg.trim().length < 5} onClick={sendReport}>Send report</button>
        </div>
      </Modal>
    </Page>
  );
}
