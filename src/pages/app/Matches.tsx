import { motion } from "motion/react";
import { useState } from "react";
import { Notice, Skeleton, stagger, EligBadge } from "../../components/ui";
import { ScholarshipRow, TableHead } from "../../components/ScholarshipCard";
import { useApi } from "../../lib/use";
import { Link } from "../../lib/router";

const ORDER = { MET: 0, NEEDS_REVIEW: 1, UNKNOWN: 2, NOT_MET: 3 } as Record<string, number>;

export function Matches() {
  const { data, loading, error } = useApi<{ assessments: any[] }>("/me/assessments");
  const [filter, setFilter] = useState("");
  const [showTest, setShowTest] = useState(false);
  if (loading) return <Skeleton h={420} />;
  if (error || !data) return <Notice kind="bad">{error}</Notice>;
  const base = data.assessments.filter((a) => showTest || !a.scholarship.is_test_data);
  const list = base.filter((a) => !filter || a.assessment.overall === filter).sort((a, b) => ORDER[a.assessment.overall] - ORDER[b.assessment.overall]);
  const count = (s: string) => base.filter((a) => a.assessment.overall === s).length;

  return (
    <div className="stack" style={{ "--gap": "20px" } as any}>
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <h1>Your matches</h1>
          <p className="muted">How your profile compares with each award's published rules. This is eligibility, not your chances. <Link to="/app/profile">Update profile</Link></p>
        </div>
      </div>
      <div className="row between">
        <div className="seg" role="group" aria-label="Filter by result">
          <button aria-pressed={!filter} onClick={() => setFilter("")}>All <span className="num">{base.length}</span></button>
          {["MET", "NEEDS_REVIEW", "UNKNOWN", "NOT_MET"].map((s) => (
            <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>{{ MET: "Met", NEEDS_REVIEW: "Needs review", UNKNOWN: "Unknown", NOT_MET: "Not met" }[s]} <span className="num">{count(s)}</span></button>
          ))}
        </div>
        <label className="row subtle" style={{ "--gap": "7px" } as any}><input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />Show test data</label>
      </div>
      <Notice kind="info"><span><EligBadge status="NEEDS_REVIEW" /> usually means a rule isn't verified yet or needs a human decision (such as grade equivalence). Open an award to see each rule, its source and your next step.</span></Notice>
      <div className="panel panel-flush" role="table" aria-label="Matches">
        <TableHead withElig />
        {list.length === 0 ? <p className="muted" style={{ padding: 20 }}>No awards in this group.</p> : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" key={filter + showTest}>
            {list.map((a) => <ScholarshipRow key={a.scholarship.id} s={a.scholarship} elig={a.assessment.overall} />)}
          </motion.div>
        )}
      </div>
    </div>
  );
}
