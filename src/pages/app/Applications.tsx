import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { Check, ChevronDown, ExternalLink, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Empty, Modal, Notice, ProgressBar, Skeleton, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { fmtDate, useApi } from "../../lib/use";
import { Link, useRouter } from "../../lib/router";

const STAGES = ["planning", "prepared", "reviewed", "submitted", "received", "under_evaluation", "admitted", "rejected"];
const EVIDENCE = ["submitted", "received", "under_evaluation", "admitted", "rejected"];
const STUDENT = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED_BY_STUDENT: "Done (by me)", SUBMITTED: "Submitted", BLOCKED: "Blocked", NEEDS_REVIEW: "Needs review" } as Record<string, string>;

export function Applications() {
  const { data, loading, reload } = useApi<{ applications: any[] }>("/me/applications");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", institution: "" });
  const toast = useToast();
  const { go } = useRouter();
  if (loading) return <Skeleton h={300} />;
  const create = async () => {
    try {
      const r = await api.post("/me/applications", { title: f.title, institution: f.institution || undefined });
      setOpen(false);
      reload();
      go(`/app/applications/${r.application.id}`);
    } catch (e: any) {
      toast(e.message);
    }
  };
  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div className="row between">
        <div><p className="eyebrow">Applications</p><h2 style={{ marginTop: 4 }}>Each application, tracked separately.</h2></div>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={15} />Custom application</button>
      </div>
      <Notice kind="info">Mode: <strong>guided self-application</strong>. You submit through the official system yourself. Assisted and managed processing aren't offered yet.</Notice>
      {data?.applications.length === 0 ? (
        <Empty title="Nothing tracked yet"><p className="muted">Open any scholarship and click "Track application" to get a checklist built from that call.</p><Link to="/scholarships" className="btn btn-primary btn-sm">Browse scholarships</Link></Empty>
      ) : (
        <div className="grid grid-2">
          {data?.applications.map((a) => (
            <Link key={a.id} to={`/app/applications/${a.id}`} className="card card-hover card-link stack">
              <div className="row between"><h3>{a.title}</h3><span className="badge b-neutral">{a.stage.replace("_", " ")}</span></div>
              <span className="subtle">{a.institution ?? "—"} · deadline {a.deadline_date ? `${fmtDate(a.deadline_date)}${a.deadline_confirmed ? "" : " (unconfirmed)"}` : "not confirmed"}</span>
            </Link>
          ))}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="Custom application">
        <div className="stack">
          <label className="field"><span>Title</span><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. TU Munich MSc Informatics" /></label>
          <label className="field"><span>Institution</span><input className="input" value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} /></label>
          <button className="btn btn-primary" disabled={!f.title.trim()} onClick={create}>Create</button>
        </div>
      </Modal>
    </div>
  );
}

export function ApplicationDetail({ id }: { id: string }) {
  const apps = useApi<{ applications: any[] }>("/me/applications");
  const t = useApi<{ tasks: any[]; progress: any }>(`/me/tasks?application_id=${id}`);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [stageModal, setStageModal] = useState<string | null>(null);
  const [evidence, setEvidence] = useState("");
  const [newTask, setNewTask] = useState("");
  const toast = useToast();
  const { go } = useRouter();
  const app = apps.data?.applications.find((a) => a.id === id);
  if (apps.loading || t.loading) return <Skeleton h={400} />;
  if (!app) return <Notice kind="bad">Application not found.</Notice>;

  const setStatus = async (task: any, studentStatus: string) => {
    const prev = t.data!;
    t.setData({ ...prev, tasks: prev.tasks.map((x) => (x.id === task.id ? { ...x, student_status: studentStatus } : x)) });
    try {
      const r = await api.patch(`/me/tasks/${task.id}`, { studentStatus });
      t.setData({ tasks: prev.tasks.map((x) => (x.id === task.id ? { ...r.task, blocked_by: x.blocked_by } : x)), progress: r.progress });
      t.reload();
      if (studentStatus === "COMPLETED_BY_STUDENT") toast("Nice. Marked done by you.");
    } catch (e: any) {
      t.setData(prev);
      toast(e.message);
    }
  };
  const setApplicable = async (task: any, applicable: boolean) => {
    try {
      await api.patch(`/me/tasks/${task.id}`, { applicable });
      t.reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const changeStage = async (stage: string) => {
    try {
      await api.patch(`/me/applications/${id}`, { stage, stageEvidence: evidence || undefined });
      setStageModal(null);
      setEvidence("");
      apps.reload();
    } catch (e: any) {
      toast(e.message);
    }
  };
  const addTask = async () => {
    await api.post("/me/tasks", { applicationId: id, title: newTask, requirementType: "recommended" });
    setNewTask("");
    t.reload();
  };
  const remove = async () => {
    if (!confirm("Delete this application and its tasks?")) return;
    await api.del(`/me/applications/${id}`);
    go("/app/applications");
  };

  const p = t.data!.progress;
  const done = (x: any) => ["COMPLETED_BY_STUDENT", "SUBMITTED"].includes(x.student_status) || ["VERIFIED", "RECEIVED"].includes(x.verified_status);

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div className="row between">
        <div>
          <Link to="/app/applications" className="subtle">← Applications</Link>
          <h2 style={{ marginTop: 6 }}>{app.title}</h2>
          <p className="muted">{app.institution} · {app.deadline_date ? `Deadline ${fmtDate(app.deadline_date)}${app.deadline_confirmed ? " (confirmed)" : " (unconfirmed)"}` : "Deadline not confirmed"}</p>
        </div>
        <span className="row">
          {app.scholarship_id && <Link to={`/scholarships/${app.scholarship_id}`} className="btn btn-ghost btn-sm">Scholarship</Link>}
          <button className="btn btn-danger btn-sm" onClick={remove}><Trash2 size={14} />Delete</button>
        </span>
      </div>

      <div className="card stack">
        <div className="row between"><strong>Stage</strong><span className="subtle">{app.stage_evidence ? `Evidence: ${app.stage_evidence}` : "Stages from 'submitted' need evidence"}</span></div>
        <div className="chips">
          {STAGES.map((s) => (
            <button key={s} className="chip" aria-pressed={app.stage === s} onClick={() => (EVIDENCE.includes(s) ? setStageModal(s) : changeStage(s))}>{s.replace("_", " ")}</button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <div className="row between">
          <strong>{p.done} of {p.total} applicable tasks done · {p.mandatoryRemaining} mandatory left</strong>
          <span className="subtle">{p.verified} confirmed by institution{p.blocked ? ` · ${p.blocked} blocked` : ""}</span>
        </div>
        <ProgressBar value={p.percent} />
      </div>

      <div className="card">
        <div className="list">
          {t.data!.tasks.map((x) => {
            const isDone = done(x);
            const blocked = x.blocked_by.length > 0 && !isDone;
            return (
              <div key={x.id} className={`task ${isDone ? "task-done" : ""}`} style={{ opacity: x.applicable ? 1 : 0.5 }}>
                <motion.button
                  className="check"
                  role="checkbox"
                  aria-checked={isDone}
                  aria-label={`Mark ${x.title} ${isDone ? "not done" : "done"}`}
                  disabled={blocked || !x.applicable}
                  title={blocked ? "Finish the tasks this depends on first" : undefined}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => setStatus(x, isDone ? "IN_PROGRESS" : "COMPLETED_BY_STUDENT")}
                >
                  <AnimatePresence>{isDone && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={15} strokeWidth={3} /></motion.span>}</AnimatePresence>
                  {blocked && <Lock size={12} />}
                </motion.button>
                <div className="stack" style={{ "--gap": "4px" } as any}>
                  <button onClick={() => setExpanded(expanded === x.id ? null : x.id)} style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer" }} aria-expanded={expanded === x.id}>
                    <span className="task-title" style={{ fontWeight: 600 }}>{x.title}</span>
                  </button>
                  <span className="row" style={{ "--gap": "6px" } as any}>
                    <span className={`badge ${x.requirement_type === "mandatory" ? "b-info" : "b-neutral"}`}>{x.requirement_type}</span>
                    <span className="badge b-neutral">{STUDENT[x.student_status]}</span>
                    {x.verified_status !== "NONE" && <span className="badge b-ok"><ShieldCheck size={12} />{x.verified_status.toLowerCase()} by institution</span>}
                    {x.due_date && <span className={`badge ${x.due_confirmed ? "b-warn" : "b-neutral"}`}>{fmtDate(x.due_date)}{x.due_confirmed ? "" : " (unconfirmed)"}</span>}
                    {blocked && <span className="badge b-warn">Waiting on {x.blocked_by.length} task{x.blocked_by.length > 1 ? "s" : ""}</span>}
                    {x.change_note && <span className="badge b-bad">{x.change_note}</span>}
                  </span>
                  <AnimatePresence initial={false}>
                    {expanded === x.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                        <div className="stack" style={{ "--gap": "8px", paddingTop: 8 } as any}>
                          {x.instructions && <p className="muted">{x.instructions}</p>}
                          {x.reason && <p className="subtle"><strong>Why:</strong> {x.reason}</p>}
                          {x.documents.length > 0 && <p className="subtle"><strong>Documents:</strong> {x.documents.join(", ")}</p>}
                          {x.next_action && <p className="subtle"><strong>Next:</strong> {x.next_action}</p>}
                          {x.source_url ? <a className="subtle" href={x.source_url} target="_blank" rel="noopener noreferrer">Official source{x.source_verified_at ? ` · verified ${fmtDate(x.source_verified_at)}` : " · not yet verified"} <ExternalLink size={11} style={{ display: "inline" }} /></a> : <span className="subtle">General step. Confirm it on the official page.</span>}
                          <div className="row">
                            <select aria-label="Status" className="input" style={{ width: 200 }} value={x.student_status} onChange={(e) => setStatus(x, e.target.value)}>
                              {Object.entries(STUDENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            {x.requirement_type !== "mandatory" && (
                              <button className="btn btn-soft btn-sm" onClick={() => setApplicable(x, !x.applicable)}>{x.applicable ? "Doesn't apply to me" : "Applies to me"}</button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <ChevronDown size={16} style={{ transform: expanded === x.id ? "rotate(180deg)" : undefined, transition: "transform .2s", marginTop: 4 }} />
              </div>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 12, flexWrap: "nowrap" } as any}>
          <input className="input" placeholder="Add your own task…" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && newTask.trim() && addTask()} />
          <button className="btn btn-soft" disabled={!newTask.trim()} onClick={addTask}><Plus size={14} />Add</button>
        </div>
      </div>

      <Modal open={!!stageModal} onClose={() => setStageModal(null)} title={`Mark as ${stageModal?.replace("_", " ")}`}>
        <div className="stack">
          <p className="muted">Add proof, such as a confirmation number, portal reference or the date and sender of the official email. Raasta records what you tell us. Only the institution's own systems can confirm it.</p>
          <input className="input" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. CSC application no. 2027xxxx" />
          <button className="btn btn-primary" disabled={evidence.trim().length < 3} onClick={() => stageModal && changeStage(stageModal)}>Save stage</button>
        </div>
      </Modal>
    </div>
  );
}
