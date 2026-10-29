import { motion } from "motion/react";
import { ArrowRight, Check, Plus } from "lucide-react";
import { Link } from "../lib/router";
import { COUNTRY, fmtDate } from "../lib/use";
import { EligBadge, StatusBadge, TestBadge, stagger } from "./ui";
import { FUNDING_LABEL } from "../../shared/funding";

const TILE: Record<string, string> = { CN: "#b3261e", DE: "#1f2421", IT: "#146b3a", KR: "#1d4f91" };

export function initials(provider: string) {
  const words = provider.replace(/\(.*?\)/g, "").split(/[\s/,-]+/).filter((w) => w.length > 2 && /^[A-Z]/.test(w));
  return (words.slice(0, 2).map((w) => w[0]).join("") || provider.slice(0, 2)).toUpperCase();
}

export function deadlineText(s: any) {
  if (s.deadline_date && s.status?.startsWith("VERIFIED_")) return { main: fmtDate(s.deadline_date), sub: "Confirmed by reviewer" };
  if (s.proposed_deadline) return { main: fmtDate(s.proposed_deadline), sub: "From the official page" };
  if (s.deadline_text) return { main: "Not confirmed", sub: s.deadline_text };
  return { main: "Not published", sub: "" };
}

export function TableHead({ withElig }: { withElig?: boolean }) {
  return (
    <div className="thead" role="row">
      <span role="columnheader">Scholarship</span>
      <span role="columnheader">Funding</span>
      <span role="columnheader">Deadline</span>
      <span role="columnheader">{withElig ? "Your eligibility" : "Verification"}</span>
      <span role="columnheader" style={{ textAlign: "right" }}>Actions</span>
    </div>
  );
}

/** One catalogue row. Status and funding only show what the record documents. */
export function ScholarshipRow({ s, elig, onCompare, comparing }: { s: any; elig?: string; onCompare?: () => void; comparing?: boolean }) {
  const fc = (s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL;
  const d = deadlineText(s);
  return (
    <motion.div variants={stagger.item} className="trow" role="row">
      <div role="cell" className="c-main row" style={{ "--gap": "14px", flexWrap: "nowrap" } as any}>
        <span className="logo-tile" style={{ background: TILE[s.country] ?? "#333" }} aria-hidden>{initials(s.provider)}</span>
        <div style={{ minWidth: 0 }}>
          <Link to={`/scholarships/${s.id}`} className="name">{s.name}</Link>
          <div className="tiny" style={{ marginTop: 3 }}>
            {COUNTRY[s.country]?.name} · {(s.levels ?? []).map((l: string) => (l === "phd" ? "PhD" : l[0].toUpperCase() + l.slice(1))).join(", ") || "Levels n/a"}
            {s.applicant_type !== "new" && ` · ${s.applicant_type === "both" ? "new & continuing" : "continuing students"}`}
          </div>
          {!!s.is_test_data && <div style={{ marginTop: 6 }}><TestBadge /></div>}
        </div>
      </div>
      <div role="cell" className="c-fund"><span className={`fund ${fc === "unknown" ? "unknown" : ""}`}>{FUNDING_LABEL[fc]}</span></div>
      <div role="cell" className="c-dead"><div className="num" style={{ fontSize: 14, fontWeight: 500 }}>{d.main}</div>{d.sub && <div className="tiny clamp1" title={d.sub}>{d.sub}</div>}</div>
      <div role="cell" className="c-status">{elig ? <EligBadge status={elig} /> : <StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} checkedAt={s.source_checked_at} check={s.source_check} deadline={s.proposed_deadline} />}</div>
      <div role="cell" className="c-meta">
        {elig ? <EligBadge status={elig} /> : <StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} checkedAt={s.source_checked_at} check={s.source_check} deadline={s.proposed_deadline} />}
        <span className={`fund ${fc === "unknown" ? "unknown" : ""}`} style={{ fontSize: 13 }}>{FUNDING_LABEL[fc]}</span>
        <span className="tiny">Deadline: {d.main}</span>
      </div>
      <div role="cell" className="c-act row" style={{ "--gap": "6px", justifyContent: "flex-end", flexWrap: "nowrap" } as any}>
        {onCompare && (
          <button className={`btn btn-sm icon-btn ${comparing ? "btn-primary" : "btn-soft"}`} aria-pressed={comparing} aria-label={`${comparing ? "Remove" : "Add"} ${s.name} ${comparing ? "from" : "to"} comparison`} title="Compare" onClick={onCompare}>
            {comparing ? <Check size={15} /> : <Plus size={15} />}
          </button>
        )}
        <Link to={`/scholarships/${s.id}`} className="btn btn-primary btn-sm" aria-label={`View ${s.name}`}>View <ArrowRight size={14} /></Link>
      </div>
    </motion.div>
  );
}
