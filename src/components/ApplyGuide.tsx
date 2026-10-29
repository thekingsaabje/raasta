import { CalendarClock, ExternalLink, FileText } from "lucide-react";
import { generateChecklist } from "../../shared/checklist";
import type { Requirement, Scholarship } from "../../shared/types";
import { fmtDate } from "../lib/use";

/** Working back from the deadline: when to have each kind of step done. Suggestions, not provider dates. */
const LEAD_DAYS: Record<string, number> = { read_call: 70, passport: 63, transcripts: 56, statement: 35, references: 28, submit: 7 };

const minus = (iso: string, days: number) => new Date(Date.parse(iso) - days * 86_400_000).toISOString().slice(0, 10);

/** A student-facing "how to apply" plan for one scholarship, built from its stored rules and official deadline. */
export function ApplyGuide({ s, reqs, today = new Date().toISOString().slice(0, 10) }: { s: Scholarship; reqs: Requirement[]; today?: string }) {
  const steps = generateChecklist(s, reqs);
  const due = s.deadline_date ?? s.proposed_deadline ?? null;
  const confirmed = (s.status === "VERIFIED_OPEN" || s.status === "VERIFIED_UPCOMING") && !!s.deadline_date;
  const upcoming = due && due >= today && s.cycle_state !== "closed";
  const docs = [...new Set(steps.flatMap((t) => t.documents))];

  return (
    <section className="panel panel-flush" aria-labelledby="apply-guide">
      <div className="panel-head">
        <div>
          <h3 id="apply-guide">How to apply, step by step</h3>
          <div className="tiny" style={{ marginTop: 2 }}>Built from this award's rules. Always follow the official call if it says something different.</div>
        </div>
      </div>
      <div style={{ padding: "6px 20px 18px" }}>
        {upcoming ? (
          <p className="row tiny" style={{ "--gap": "6px", margin: "10px 0 6px" } as any}>
            <CalendarClock size={14} /> Deadline {fmtDate(due!)} ({confirmed ? "confirmed by a reviewer" : "from the official page"}). Suggested dates below leave a week's buffer.
          </p>
        ) : (
          <p className="tiny" style={{ margin: "10px 0 6px" }}>No upcoming deadline is known{s.cycle_state === "closed" ? ": this round has closed. Prepare now so you're ready when the next call opens." : ". Prepare the documents now and watch the official page."}</p>
        )}
        <ol className="guide-steps">
          {steps.map((t) => {
            const by = upcoming && LEAD_DAYS[t.key] !== undefined ? minus(due!, LEAD_DAYS[t.key]) : null;
            return (
              <li key={t.key}>
                <div className="row between" style={{ alignItems: "baseline" }}>
                  <strong>{t.title}</strong>
                  {by && <span className="tiny num">{by < today ? "Start now" : `by ${fmtDate(by)}`}</span>}
                </div>
                <p className="subtle" style={{ marginTop: 3 }}>{t.instructions}</p>
                {t.source_url && <a className="tiny" href={t.source_url} target="_blank" rel="noopener noreferrer">Source <ExternalLink size={11} style={{ display: "inline" }} /></a>}
              </li>
            );
          })}
        </ol>
        {docs.length > 0 && (
          <div className="sunk" style={{ marginTop: 14 }}>
            <div className="row tiny" style={{ "--gap": "6px", fontWeight: 600, marginBottom: 6 } as any}><FileText size={14} />Documents to gather</div>
            <div className="chips">{docs.map((d) => <span key={d} className="chip" style={{ cursor: "default" }}>{d}</span>)}</div>
          </div>
        )}
      </div>
    </section>
  );
}
