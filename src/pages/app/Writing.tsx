import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, History, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Empty, Modal, Notice, Skeleton, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, useApi } from "../../lib/use";
import { Link, useRouter } from "../../lib/router";

const KINDS: Record<string, string> = {
  sop: "Statement of purpose", motivation: "Motivation letter", study_plan: "Study plan", research_proposal: "Research proposal", cv: "Academic CV",
  essay: "Scholarship essay", recommendation_request: "Recommendation-letter request", enquiry: "University enquiry", interview: "Interview preparation",
};
const MODE: Record<string, [string, string]> = {
  DRAFTING_ALLOWED: ["b-ok", "Drafting help allowed"],
  EDITING_ONLY: ["b-info", "Editing help only"],
  COACHING_ONLY: ["b-warn", "Coaching only"],
  POLICY_UNCONFIRMED: ["b-warn", "Policy unconfirmed → coaching only"],
};
const FACT_CATS = ["academic", "project", "experience", "motivation", "goal", "award", "other"];

export function WritingList() {
  const docs = useApi<{ docs: any[] }>("/me/writing");
  const facts = useApi<{ facts: any[] }>("/me/facts");
  const apps = useApi<{ applications: any[] }>("/me/applications");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: "sop", title: "", applicationId: "", wordLimit: "", sections: "" });
  const [fact, setFact] = useState({ category: "academic", text: "", evidence: "" });
  const { go } = useRouter();
  const toast = useToast();

  const create = async () => {
    try {
      const r = await api.post("/me/writing", {
        kind: f.kind, title: f.title || KINDS[f.kind], applicationId: f.applicationId || undefined,
        wordLimit: f.wordLimit ? Number(f.wordLimit) : undefined, requiredSections: f.sections.split(",").map((s) => s.trim()).filter(Boolean),
      });
      go(`/app/writing/${r.id}`);
    } catch (e: any) {
      toast(e.message);
    }
  };
  const addFact = async () => {
    try {
      await api.post("/me/facts", { category: fact.category, text: fact.text, evidence: fact.evidence || undefined });
      setFact({ ...fact, text: "", evidence: "" });
      facts.reload();
    } catch (e: any) {
      toast(e.message);
    }
  };

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div className="row between">
        <div><p className="eyebrow">Writing Studio</p><h2 style={{ marginTop: 4 }}>Your story, in your words, within the rules.</h2></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />New document</button>
      </div>
      <Notice kind="info">Raasta never invents achievements, grades or experiences. Writing help follows each provider's policy. Documents linked to an application use that award's policy, and anything unconfirmed gets coaching only.</Notice>

      <div className="card stack">
        <h3>Documents</h3>
        {docs.loading ? <Skeleton h={80} /> : docs.data?.docs.length === 0 ? <p className="muted">No documents yet.</p> : (
          <div className="list">
            {docs.data?.docs.map((d) => (
              <Link key={d.id} to={`/app/writing/${d.id}`} className="list-item row between card-link">
                <span><strong>{d.title}</strong><br /><span className="subtle">{KINDS[d.kind]} · v{d.version} · {fmtDate(d.updated_at)}</span></span>
                <span className="row" style={{ "--gap": "6px" } as any}>
                  <span className={`badge ${MODE[d.policy_mode][0]}`}>{MODE[d.policy_mode][1]}</span>
                  {d.facts_confirmed ? <span className="badge b-ok"><CheckCircle2 size={12} />Facts confirmed</span> : null}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Fact bank</h3>
        <p className="muted">Write down real facts about you: courses, projects, jobs, awards, motivations. The checker and outlines only use what's here.</p>
        <div className="row" style={{ alignItems: "flex-end" }}>
          <label className="field" style={{ width: 150 }}><span className="subtle">Category</span><select className="input" value={fact.category} onChange={(e) => setFact({ ...fact, category: e.target.value })}>{FACT_CATS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label className="field" style={{ flex: 2, minWidth: 220 }}><span className="subtle">Fact</span><input className="input" value={fact.text} onChange={(e) => setFact({ ...fact, text: e.target.value })} placeholder="e.g. Final-year project: crop-disease detection app, 3 people, I built the model" /></label>
          <label className="field" style={{ flex: 1, minWidth: 160 }}><span className="subtle">Evidence (optional)</span><input className="input" value={fact.evidence} onChange={(e) => setFact({ ...fact, evidence: e.target.value })} placeholder="e.g. transcript, certificate" /></label>
          <button className="btn btn-soft" disabled={fact.text.trim().length < 3} onClick={addFact}><Plus size={14} />Add</button>
        </div>
        <div className="list">
          {facts.data?.facts.map((x) => (
            <div key={x.id} className="list-item row between" style={{ flexWrap: "nowrap" } as any}>
              <span><span className="badge b-neutral">{x.category}</span> {x.text}{x.evidence && <span className="subtle"> · {x.evidence}</span>}</span>
              <button className="btn btn-soft icon-btn" aria-label="Delete fact" onClick={async () => { await api.del(`/me/facts/${x.id}`); facts.reload(); }}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New document">
        <div className="stack">
          <label className="field"><span>Type</span><select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Title</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={KINDS[f.kind]} /></label>
          <label className="field"><span>For application</span>
            <select className="input" value={f.applicationId} onChange={(e) => setF({ ...f, applicationId: e.target.value })}>
              <option value="">Not linked (policy unconfirmed)</option>
              {apps.data?.applications.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </label>
          <label className="field"><span>Word limit (from the official instructions)</span><input className="input" type="number" value={f.wordLimit} onChange={(e) => setF({ ...f, wordLimit: e.target.value })} /></label>
          <label className="field"><span>Required sections (comma-separated)</span><input className="input" value={f.sections} onChange={(e) => setF({ ...f, sections: e.target.value })} placeholder="e.g. Research plan, Career goals" /></label>
          <button className="btn btn-primary" onClick={create}>Create</button>
        </div>
      </Modal>
    </div>
  );
}

export function WritingEditor({ id }: { id: string }) {
  const { data, loading, error, reload } = useApi<any>(`/me/writing/${id}`);
  const [content, setContent] = useState("");
  const [issues, setIssues] = useState<any[] | null>(null);
  const [outline, setOutline] = useState<string | null>(null);
  const [versions, setVersions] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (data) setContent(data.doc.content);
  }, [data]);
  if (loading) return <Skeleton h={400} />;
  if (error || !data) return <Notice kind="bad">{error}</Notice>;
  const d = data.doc;
  const cap = data.capabilities;
  const words = (content.trim().match(/\S+/g) ?? []).length;
  const dirty = content !== d.content;

  const save = async () => {
    setSaving(true);
    await api.patch(`/me/writing/${id}`, { content });
    await reload();
    setSaving(false);
    toast("Saved as a new version");
  };
  const check = async () => {
    if (dirty) await save();
    setIssues((await api.post(`/me/writing/${id}/check`)).issues);
  };
  const getOutline = async () => {
    try {
      setOutline((await api.post(`/me/writing/${id}/outline`)).outline);
    } catch (e: any) {
      toast(e.message);
    }
  };
  const confirmFacts = async (v: boolean) => {
    await api.patch(`/me/writing/${id}`, { factsConfirmed: v });
    reload();
  };

  return (
    <div className="stack" style={{ "--gap": "16px" } as any}>
      <div className="row between">
        <div><Link to="/app/writing" className="subtle">← Writing Studio</Link><h2 style={{ marginTop: 6 }}>{d.title}</h2><span className="subtle">{KINDS[d.kind]} · version {d.version}</span></div>
        <span className={`badge ${MODE[d.policy_mode][0]}`}>{MODE[d.policy_mode][1]}</span>
      </div>
      {cap.warning && <Notice kind="warn">{cap.warning}</Notice>}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", alignItems: "start" }}>
        <div className="card stack" style={{ gridColumn: "span 2" } as any}>
          <textarea aria-label="Document text" className="input" style={{ minHeight: 380 }} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write in your own words…" />
          <div className="row between">
            <span className={`subtle ${d.word_limit && words > d.word_limit ? "error-text" : ""}`}>{words}{d.word_limit ? ` / ${d.word_limit}` : ""} words</span>
            <span className="row">
              <button className="btn btn-ghost btn-sm" onClick={async () => setVersions((await api.get(`/me/writing/${id}/versions`)).versions)}><History size={14} />History</button>
              <button className="btn btn-ghost btn-sm" onClick={check}>Check</button>
              <button className="btn btn-primary btn-sm" disabled={!dirty || saving} onClick={save}><Save size={14} />{saving ? "Saving…" : "Save"}</button>
            </span>
          </div>
          {issues && (
            <motion.div className="stack" style={{ "--gap": "6px" } as any} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {issues.length === 0 ? <Notice kind="info">No problems found by the automatic checks. You still need to read it yourself.</Notice> : issues.map((i, k) => <Notice key={k} kind={i.severity === "error" ? "bad" : "warn"}>{i.message}</Notice>)}
            </motion.div>
          )}
          <label className="row" style={{ flexWrap: "nowrap", fontSize: 14 } as any}>
            <input type="checkbox" checked={!!d.facts_confirmed} disabled={dirty} onChange={(e) => confirmFacts(e.target.checked)} />
            I confirm every fact in this version is true and my own. (Editing the text clears this.)
          </label>
        </div>
        <div className="card stack">
          <h3>Coaching questions</h3>
          <ol className="muted" style={{ margin: 0, paddingLeft: 18 }}>{data.questions.map((q: string) => <li key={q} style={{ marginBottom: 6 }}>{q}</li>)}</ol>
          {d.required_sections.length > 0 && <><h3>Required sections</h3><ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>{d.required_sections.map((s: string) => <li key={s}>{s}</li>)}</ul></>}
          <div className="divider" />
          <button className="btn btn-soft" disabled={!cap.outline} onClick={getOutline} title={cap.outline ? "" : "Not allowed by this provider's policy"}><Wand2 size={14} />Outline from my facts</button>
          {!cap.outline && <span className="help">Outlines are only offered where drafting help is allowed.</span>}
          {outline && <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, background: "var(--paper)", padding: 12, borderRadius: 10 }}>{outline}</pre>}
        </div>
      </div>
      <Modal open={!!versions} onClose={() => setVersions(null)} title="Version history">
        {versions?.length === 0 ? <Empty title="No saved versions yet" /> : (
          <div className="list">
            {versions?.map((v) => (
              <div key={v.version} className="list-item stack" style={{ "--gap": "6px" } as any}>
                <div className="row between"><strong>v{v.version}</strong><span className="subtle">{fmtDate(v.created_at)}</span></div>
                <p className="muted" style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{v.content.slice(0, 400)}{v.content.length > 400 ? "…" : ""}</p>
                <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => { setContent(v.content); setVersions(null); }}>Restore into editor</button>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
