import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Columns3, Search, SearchX } from "lucide-react";
import { Page } from "../components/Layout";
import { ScholarshipCard } from "../components/ScholarshipCard";
import { CardSkeletons, Empty, Modal, Notice, StatusBadge, stagger } from "../components/ui";
import { useApi, COUNTRY } from "../lib/use";
import { useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";

const COUNTRIES = [["", "All countries"], ["CN", "China"], ["DE", "Germany"], ["IT", "Italy"]];
const LEVELS = [["", "Any level"], ["bachelor", "Bachelor"], ["master", "Master"], ["phd", "PhD"]];
const APPLICANT = [["", "Everyone"], ["new", "New applicants"], ["continuing", "Already studying"]];

export function Catalogue() {
  const { search, go } = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState(search.get("q") ?? "");
  const [country, setCountry] = useState(search.get("country") ?? "");
  const [level, setLevel] = useState("");
  const [applicant, setApplicant] = useState("");
  const [hideTest, setHideTest] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const qs = new URLSearchParams(Object.entries({ q: debounced, country, level, applicant }).filter(([, v]) => v)).toString();
  useEffect(() => {
    go(`/scholarships${country || debounced ? "?" + new URLSearchParams(Object.entries({ q: debounced, country }).filter(([, v]) => v)).toString() : ""}`, true);
  }, [country, debounced, go]);

  const { data, loading, error } = useApi<{ scholarships: any[] }>(`/scholarships${qs ? "?" + qs : ""}`);
  const elig = useApi<{ assessments: any[] }>(user ? "/me/assessments" : null);
  const eligMap = useMemo(() => Object.fromEntries((elig.data?.assessments ?? []).map((a) => [a.scholarship.id, a.assessment.overall])), [elig.data]);
  const list = (data?.scholarships ?? []).filter((s) => !(hideTest && s.is_test_data));
  const compared = (data?.scholarships ?? []).filter((s) => compare.includes(s.id));

  const toggle = (id: string) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= 3 ? c : [...c, id]));

  return (
    <Page>
      <div className="stack" style={{ "--gap": "18px" } as any}>
        <div>
          <p className="eyebrow">Scholarship catalogue</p>
          <h1 style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)", marginTop: 6 }}>Find funding that fits.</h1>
        </div>
        <Notice kind="info">
          The catalogue is being built from official sources and is <strong>not complete</strong>. A missing award doesn't mean it doesn't exist. Records marked "Not yet verified" link to the official page, but a person hasn't confirmed the current call yet.
        </Notice>
        <div className="search">
          <Search size={18} className="muted" />
          <input aria-label="Search scholarships" placeholder="Search by name, provider or funding…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="row" style={{ "--gap": "18px", alignItems: "flex-start" } as any}>
          <ChipGroup label="Country" options={COUNTRIES} value={country} onChange={setCountry} />
          <ChipGroup label="Level" options={LEVELS} value={level} onChange={setLevel} />
          <ChipGroup label="Applicant" options={APPLICANT} value={applicant} onChange={setApplicant} />
          <label className="row subtle" style={{ "--gap": "6px", marginTop: 6 } as any}>
            <input type="checkbox" checked={hideTest} onChange={(e) => setHideTest(e.target.checked)} /> Hide test data
          </label>
        </div>
        {error && <Notice kind="bad">{error}</Notice>}
        <p className="subtle" aria-live="polite">{loading ? "Loading…" : `${list.length} result${list.length === 1 ? "" : "s"}`}</p>
        {loading && !data ? (
          <CardSkeletons />
        ) : list.length === 0 ? (
          <Empty icon={<SearchX size={30} />} title="Nothing matches yet">
            <p className="muted">Try fewer filters. If you know an award we're missing, tell us and we'll research it.</p>
          </Empty>
        ) : (
          <motion.div className="grid grid-3" variants={stagger.container} initial="hidden" animate="show" key={qs + hideTest}>
            {list.map((s) => (
              <ScholarshipCard key={s.id} s={s} elig={eligMap[s.id]} onCompare={() => toggle(s.id)} comparing={compare.includes(s.id)} />
            ))}
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {compare.length > 0 && (
          <motion.div className="compare-bar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}>
            <div className="card row" style={{ padding: "10px 12px", boxShadow: "var(--shadow-lg)" }}>
              <Columns3 size={18} />
              <span>{compare.length} selected (max 3)</span>
              <button className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare</button>
              <button className="btn btn-soft btn-sm" onClick={() => setCompare([])}>Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={showCompare} onClose={() => setShowCompare(false)} title="Compare scholarships">
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {[
                ["Country", (s: any) => COUNTRY[s.country]?.name],
                ["Status", (s: any) => <StatusBadge status={s.status} />],
                ["Levels", (s: any) => (s.levels ?? []).join(", ")],
                ["Funding", (s: any) => s.funding_summary ?? "—"],
                ["Route", (s: any) => s.application_route ?? "—"],
                ["Deadline", (s: any) => s.deadline_text ?? "Not confirmed"],
                ["Your eligibility", (s: any) => eligMap[s.id] ?? (user ? "—" : "Sign in to check")],
              ].map(([label, f]: any) => (
                <tr key={label}>
                  <th style={{ width: 110 }}>{label}</th>
                  {compared.map((s) => <td key={s.id} style={{ fontSize: 13 }}>{label === "Country" ? <strong>{s.name}<br /></strong> : null}{f(s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </Page>
  );
}

function ChipGroup({ label, options, value, onChange }: { label: string; options: string[][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} className="chip" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}
