import { motion } from "motion/react";
import { useState } from "react";
import { CardSkeletons, EligBadge, Notice, stagger } from "../../components/ui";
import { ScholarshipCard } from "../../components/ScholarshipCard";
import { useApi } from "../../lib/use";
import { Link } from "../../lib/router";

const ORDER = { MET: 0, NEEDS_REVIEW: 1, UNKNOWN: 2, NOT_MET: 3 } as Record<string, number>;

export function Matches() {
  const { data, loading, error } = useApi<{ assessments: any[] }>("/me/assessments");
  const [filter, setFilter] = useState("");
  if (loading) return <CardSkeletons />;
  if (error || !data) return <Notice kind="bad">{error}</Notice>;
  const list = data.assessments
    .filter((a) => !filter || a.assessment.overall === filter)
    .sort((a, b) => ORDER[a.assessment.overall] - ORDER[b.assessment.overall]);
  const count = (s: string) => data.assessments.filter((a) => a.assessment.overall === s).length;

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div>
        <p className="eyebrow">Matches</p>
        <h2 style={{ marginTop: 4 }}>How you compare with each award's rules.</h2>
        <p className="muted">This checks eligibility, not your chances. "Needs review" usually means the rule isn't verified yet, or it needs a human decision such as grade equivalence. <Link to="/app/profile">Update profile</Link></p>
      </div>
      <div className="chips">
        <button className="chip" aria-pressed={!filter} onClick={() => setFilter("")}>All ({data.assessments.length})</button>
        {["MET", "NEEDS_REVIEW", "UNKNOWN", "NOT_MET"].map((s) => (
          <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}><EligBadge status={s} /> {count(s)}</button>
        ))}
      </div>
      <motion.div className="grid grid-3" variants={stagger.container} initial="hidden" animate="show" key={filter}>
        {list.map((a) => (
          <div key={a.scholarship.id} className="stack" style={{ "--gap": "6px" } as any}>
            <ScholarshipCard s={a.scholarship} elig={a.assessment.overall} />
            <p className="subtle" style={{ padding: "0 6px" }}>{a.assessment.summary}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
