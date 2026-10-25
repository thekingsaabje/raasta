import { motion } from "motion/react";
import { ArrowUpRight, CalendarClock, GraduationCap, Landmark } from "lucide-react";
import { Link } from "../lib/router";
import { COUNTRY } from "../lib/use";
import { EligBadge, StatusBadge, TestBadge, stagger } from "./ui";

export function ScholarshipCard({ s, elig, onCompare, comparing }: { s: any; elig?: string; onCompare?: () => void; comparing?: boolean }) {
  return (
    <motion.article variants={stagger.item} layout className="card card-hover stack" style={{ "--gap": "12px" } as any}>
      <div className="row between">
        <span className="row" style={{ "--gap": "6px" } as any}>
          <span className="flag">{COUNTRY[s.country]?.code}</span>
          <span className="subtle">{COUNTRY[s.country]?.name}</span>
        </span>
        <StatusBadge status={s.status} />
      </div>
      <Link to={`/scholarships/${s.id}`} className="card-link">
        <h3>{s.name}</h3>
      </Link>
      <div className="stack subtle" style={{ "--gap": "4px" } as any}>
        <span className="row" style={{ "--gap": "6px" } as any}><Landmark size={14} />{s.provider}</span>
        <span className="row" style={{ "--gap": "6px" } as any}><GraduationCap size={14} />{(s.levels ?? []).join(" · ") || "Levels not stated"}{s.applicant_type !== "new" ? ` · ${s.applicant_type === "both" ? "new & continuing" : "continuing students"}` : ""}</span>
        <span className="row" style={{ "--gap": "6px" } as any}><CalendarClock size={14} />{s.deadline_text ? s.deadline_text.slice(0, 90) : "Deadline not confirmed"}</span>
      </div>
      {s.funding_summary && <p className="muted" style={{ fontSize: 14, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{s.funding_summary}</p>}
      <div className="row between" style={{ marginTop: "auto" }}>
        <span className="row" style={{ "--gap": "6px" } as any}>
          {!!s.is_test_data && <TestBadge />}
          {elig && <EligBadge status={elig} prefix="You" />}
          {s.rule_count !== undefined && <span className="subtle">{s.verified_rules}/{s.rule_count} rules verified</span>}
        </span>
        <span className="row" style={{ "--gap": "6px" } as any}>
          {onCompare && (
            <button className={`btn btn-sm ${comparing ? "btn-primary" : "btn-soft"}`} aria-pressed={comparing} onClick={onCompare}>
              {comparing ? "Comparing" : "Compare"}
            </button>
          )}
          <Link to={`/scholarships/${s.id}`} className="btn btn-ghost btn-sm" aria-label={`Open ${s.name}`}>Details <ArrowUpRight size={14} /></Link>
        </span>
      </div>
    </motion.article>
  );
}
