import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Columns3, Info, Search, SearchX, X } from "lucide-react";
import { Page } from "../components/Layout";
import { ScholarshipRow, TableHead, deadlineText } from "../components/ScholarshipCard";
import { Empty, EligBadge, Modal, Notice, Skeleton, StatusBadge, stagger } from "../components/ui";
import { useApi, COUNTRY } from "../lib/use";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";
import MiniSearch from "minisearch";
import { FUNDING_LABEL } from "../../shared/funding";

/** Typo-tolerant, prefix search over the loaded records ("daad scholarsip", "politecnico milan"). */
function searchRecords(records: any[], q: string): any[] {
  if (!q.trim()) return records;
  const ms = new MiniSearch({ fields: ["name", "provider", "country_name", "funding_summary", "application_route"], storeFields: [], searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "AND", boost: { name: 3, provider: 2 } } });
  ms.addAll(records.map((s) => ({ ...s, country_name: COUNTRY[s.country]?.name ?? s.country })));
  const rank = new Map(ms.search(q).map((r, i) => [r.id, i]));
  return records.filter((s) => rank.has(s.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
}

const COUNTRIES = [["", "All"], ["CN", "China"], ["DE", "Germany"], ["IT", "Italy"]];

/** Searchable, filterable scholarship table. `limit` turns it into a compact preview (home page). */
export function CatalogueTable({ limit, syncUrl }: { limit?: number; syncUrl?: boolean }) {
  const { search, go } = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState(syncUrl ? search.get("q") ?? "" : "");
  const [country, setCountry] = useState(syncUrl ? search.get("country") ?? "" : "");
  const [level, setLevel] = useState("");
  const [applicant, setApplicant] = useState("");
  const [funding, setFunding] = useState("");
  const [status, setStatus] = useState("");
  const [hideTest, setHideTest] = useState(true);
  // Keep the full records so comparisons survive filter changes (e.g. one German + one Italian award).
  const [picked, setPicked] = useState<any[]>([]);
  const compare = picked.map((s) => s.id);
  const [showCompare, setShowCompare] = useState(false);
  const [debounced, setDebounced] = useState(q);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 220);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => {
    if (!syncUrl) return;
    const p = new URLSearchParams(Object.entries({ q: debounced, country }).filter(([, v]) => v)).toString();
    go(`/scholarships${p ? "?" + p : ""}`, true);
  }, [country, debounced, go, syncUrl]);

  // The status filter maps to: reviewer-confirmed, a research cycle ("cycle:open"), or a stored status.
  const statusParams = status === "confirmed" ? { confirmed: "1" } : status.startsWith("cycle:") ? { cycle: status.slice(6), status: "NEEDS_REVIEW" } : { status };
  const qs = new URLSearchParams(Object.entries({ country, level, applicant, ...statusParams }).filter(([, v]) => v)).toString();
  const { data, loading, error } = useApi<{ scholarships: any[] }>(`/scholarships${qs ? "?" + qs : ""}`);
  const elig = useApi<{ assessments: any[] }>(user ? "/me/assessments" : null);
  const eligMap = useMemo(() => Object.fromEntries((elig.data?.assessments ?? []).map((a) => [a.scholarship.id, a.assessment.overall])), [elig.data]);
  const all = useMemo(() => searchRecords((data?.scholarships ?? []).filter((s) => !(hideTest && s.is_test_data) && (!funding || (s.funding_class ?? "unknown") === funding)), debounced), [data, hideTest, funding, debounced]);
  const list = limit ? all.slice(0, limit) : all;
  const compared = picked;
  const toggle = (s: any) => setPicked((c) => (c.some((x) => x.id === s.id) ? c.filter((x) => x.id !== s.id) : c.length >= 3 ? c : [...c, s]));
  const setCompare = (v: string[]) => setPicked((c) => c.filter((x) => v.includes(x.id)));
  const filtersOn = !!(level || applicant || funding || status);

  return (
    <div className="panel panel-flush">
      <div className="stack" style={{ "--gap": "12px", padding: 16 } as any}>
        <div className="search">
          <Search size={18} color="var(--ink-3)" />
          <input aria-label="Search scholarships" placeholder="Search CSC, DAAD, MAECI, a university or a city…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button className="btn btn-sm icon-btn btn-soft" aria-label="Clear search" onClick={() => setQ("")}><X size={14} /></button>}
        </div>
        <div className="toolbar">
          <div className="seg" role="group" aria-label="Country">
            {COUNTRIES.map(([v, l]) => <button key={v} aria-pressed={country === v} onClick={() => setCountry(v)}>{l}</button>)}
          </div>
          <select className="input" aria-label="Degree level" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Any level</option><option value="bachelor">Bachelor</option><option value="master">Master</option><option value="phd">PhD</option>
          </select>
          <select className="input" aria-label="Applicant type" value={applicant} onChange={(e) => setApplicant(e.target.value)}>
            <option value="">New & continuing</option><option value="new">New applicants</option><option value="continuing">Already studying</option>
          </select>
          <select className="input" aria-label="Funding" value={funding} onChange={(e) => setFunding(e.target.value)}>
            <option value="">Any funding</option>
            {Object.entries(FUNDING_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option><option value="confirmed">Confirmed by reviewer</option>
            <option value="cycle:open">Open (per official page)</option><option value="cycle:upcoming">Opens soon (per official page)</option>
            <option value="cycle:closed">Closed (per official page)</option><option value="cycle:unknown">Status to be confirmed</option><option value="CONFLICTING_SOURCES">Conflicting information</option>
          </select>
          {filtersOn && <button className="btn btn-link btn-sm" onClick={() => { setLevel(""); setApplicant(""); setFunding(""); setStatus(""); }}>Reset</button>}
          <label className="row subtle" style={{ "--gap": "7px", marginLeft: "auto" } as any}>
            <input type="checkbox" checked={!hideTest} onChange={(e) => setHideTest(!e.target.checked)} /> Show test data
          </label>
        </div>
      </div>
      {error && <div style={{ padding: "0 16px 16px" }}><Notice kind="bad">{error}</Notice></div>}
      <div role="table" aria-label="Scholarships" aria-busy={loading}>
        <TableHead withElig={!!user} />
        {loading && !data ? (
          <div className="stack" style={{ padding: 20, "--gap": "18px" } as any}>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} h={44} />)}</div>
        ) : list.length === 0 ? (
          <Empty icon={<SearchX size={28} style={{ margin: "0 auto" }} />} title="Nothing matches yet">
            <p className="muted">Try fewer filters. A missing award doesn't mean it doesn't exist. Our catalogue is still growing.</p>
          </Empty>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show" key={qs + hideTest + funding + debounced}>
            {list.map((s) => <ScholarshipRow key={s.id} s={s} elig={eligMap[s.id]} onCompare={() => toggle(s)} comparing={compare.includes(s.id)} />)}
          </motion.div>
        )}
      </div>
      <div className="row between" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--sunk)" }}>
        <span className="subtle" aria-live="polite">{loading ? "Loading…" : `Showing ${list.length} of ${all.length} catalogued awards`}</span>
        {limit ? <Link to="/scholarships" className="btn btn-primary btn-sm">Open full catalogue <ArrowRight size={14} /></Link> : <span className="tiny row" style={{ "--gap": "6px" } as any}><Info size={13} />Coverage is still growing. Not every award is listed yet.</span>}
      </div>

      <AnimatePresence>
        {compare.length > 0 && (
          <motion.div className="compare-bar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}>
            <div className="panel row" style={{ padding: "8px 8px 8px 16px", boxShadow: "var(--shadow-pop)", flexWrap: "nowrap" } as any}>
              <Columns3 size={17} />
              <span className="num" style={{ fontSize: 14, whiteSpace: "nowrap" }}>{compare.length}/3 selected</span>
              <button className="btn btn-primary btn-sm" disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare</button>
              <button className="btn btn-soft btn-sm" onClick={() => setCompare([])}>Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal open={showCompare} onClose={() => setShowCompare(false)} title="Side-by-side comparison" wide>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th style={{ width: 130 }} />{compared.map((s) => <th key={s.id} style={{ color: "var(--ink)", fontSize: 14, fontWeight: 600 }}>{s.name}</th>)}</tr></thead>
            <tbody>
              {[
                ["Country", (s: any) => COUNTRY[s.country]?.name],
                ["Verification", (s: any) => <StatusBadge status={s.status} cycle={s.cycle_state} reason={s.status_reason} checkedAt={s.source_checked_at} check={s.source_check} />],
                ["Your eligibility", (s: any) => (eligMap[s.id] ? <EligBadge status={eligMap[s.id]} /> : user ? "—" : <Link to="/route">Check my fit</Link>)],
                ["Levels", (s: any) => (s.levels ?? []).join(", ") || "—"],
                ["Funding type", (s: any) => FUNDING_LABEL[(s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL]],
                ["What it covers", (s: any) => <span className="subtle">{s.funding_summary ?? "—"}</span>],
                ["Route", (s: any) => <span className="subtle">{s.application_route ?? "—"}</span>],
                ["Deadline", (s: any) => { const d = deadlineText(s); return <>{d.main}<div className="tiny">{d.sub}</div></>; }],
              ].map(([label, f]: any) => (
                <tr key={label}><th>{label}</th>{compared.map((s) => <td key={s.id} style={{ fontSize: 14 }}>{f(s)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </div>
  );
}

export function Catalogue() {
  return (
    <Page>
      <div className="page-head">
        <div>
          <h1>Scholarship catalogue</h1>
          <p className="lead">Every award links to its official source. Records stay marked "Not yet verified" until the current call has been checked.</p>
        </div>
      </div>
      <CatalogueTable syncUrl />
    </Page>
  );
}
