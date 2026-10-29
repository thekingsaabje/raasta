import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Notice, Skeleton, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/use";
import { useRouter } from "../../lib/router";

type P = Record<string, any>;

function clean(p: P): P {
  const out: P = {};
  for (const [k, v] of Object.entries(p)) {
    if (v === "" || v === undefined || v === null || (Array.isArray(v) && v.length === 0)) continue;
    out[k] = v;
  }
  if (out.grade && (out.grade.value === "" || out.grade.value === undefined || Number.isNaN(out.grade.value))) delete out.grade;
  if (out.languageTests) out.languageTests = out.languageTests.filter((t: any) => t.test && t.score !== "" && !Number.isNaN(t.score));
  if (out.languageTests?.length === 0) delete out.languageTests;
  return out;
}

export function ProfilePage() {
  const { data, loading } = useApi<{ profile: P }>("/me/profile");
  const [p, setP] = useState<P>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { go } = useRouter();
  useEffect(() => {
    // Merge so a late (or repeated) load never wipes answers the student has already started typing.
    if (data) setP((prev) => ({ nationality: "PK", ...data.profile, ...prev }));
  }, [data]);
  if (loading) return <Skeleton h={400} />;

  const set = (k: string, v: any) => setP({ ...p, [k]: v });
  const num = (v: string) => (v === "" ? undefined : Number(v));
  const abroad = p.journey && p.journey !== "applying_from_pakistan";

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.put("/me/profile", clean(p));
      toast("Profile saved. Your matches are updated.");
      go("/app/matches");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div>
        <h1>Your profile</h1>
        <p className="muted" style={{ marginTop: 8 }}>Every field is optional. Anything you skip shows as "unknown", never as a failure. We don't need documents or bank statements.</p>
      </div>

      <Section title="Where are you now?">
        <div className="chips" role="radiogroup" aria-label="Journey">
          {[
            ["applying_from_pakistan", "Applying from Pakistan"],
            ["studying_in_china", "Studying in China"],
            ["studying_in_germany_italy", "Studying in Germany, Italy or Korea"],
            ["holds_scholarship", "Have a scholarship, need renewal or more funding"],
          ].map(([v, l]) => <button key={v} type="button" className="chip" role="radio" aria-checked={p.journey === v} aria-pressed={p.journey === v} onClick={() => set("journey", v)}>{l}</button>)}
        </div>
        <div className="grid grid-2">
          <Field label="Nationality (2-letter code)" help="PK for Pakistan"><input className="input" maxLength={2} value={p.nationality ?? ""} onChange={(e) => set("nationality", e.target.value.toUpperCase())} /></Field>
          <Field label="Date of birth" help="Only used for published age limits"><input className="input" type="date" value={p.birthDate ?? ""} onChange={(e) => set("birthDate", e.target.value)} /></Field>
        </div>
      </Section>

      {abroad && (
        <Section title="Your current studies">
          <div className="grid grid-2">
            <Field label="Current university"><input className="input" value={p.currentUniversity ?? ""} onChange={(e) => set("currentUniversity", e.target.value)} /></Field>
            <Field label="Year of study"><input className="input" type="number" min={1} max={8} value={p.currentYear ?? ""} onChange={(e) => set("currentYear", num(e.target.value))} /></Field>
            <Field label="Do you hold a scholarship now?">
              <select className="input" value={p.hasExistingScholarship === undefined ? "" : String(p.hasExistingScholarship)} onChange={(e) => set("hasExistingScholarship", e.target.value === "" ? undefined : e.target.value === "true")}>
                <option value="">Prefer not to say</option><option value="true">Yes</option><option value="false">No</option>
              </select>
            </Field>
            {p.hasExistingScholarship && <Field label="Which scholarship?"><input className="input" value={p.existingScholarshipName ?? ""} onChange={(e) => set("existingScholarshipName", e.target.value)} /></Field>}
          </div>
        </Section>
      )}

      <Section title="Education so far">
        <div className="grid grid-2">
          <Field label="Highest completed qualification">
            <select className="input" value={p.highestCompleted ?? ""} onChange={(e) => set("highestCompleted", e.target.value || undefined)}>
              <option value="">—</option><option value="intermediate">Intermediate / A-levels</option><option value="bachelor">Bachelor's</option><option value="master">Master's / MPhil</option><option value="phd">PhD</option>
            </select>
          </Field>
          <Field label="Subject / field"><input className="input" value={p.field ?? ""} onChange={(e) => set("field", e.target.value)} /></Field>
          <Field label="Grading scale">
            <select className="input" value={p.grade?.scale ?? ""} onChange={(e) => set("grade", e.target.value ? { scale: e.target.value, value: p.grade?.value ?? "" } : undefined)}>
              <option value="">—</option><option value="4">CGPA out of 4</option><option value="5">CGPA out of 5</option><option value="100">Percentage</option><option value="german">German grade (1.0–4.0)</option>
            </select>
          </Field>
          <Field label="Your grade" help="Exactly as on your transcript. We never convert scales.">
            <input className="input" type="number" step="0.01" min={0} max={100} disabled={!p.grade} value={p.grade?.value ?? ""} onChange={(e) => set("grade", { ...p.grade, value: num(e.target.value) })} />
          </Field>
          <Field label="Graduation date"><input className="input" type="date" value={p.graduationDate ?? ""} onChange={(e) => set("graduationDate", e.target.value)} /></Field>
          <Field label="Study gap (years)" help="Time not in study since your last qualification"><input className="input" type="number" step="0.5" min={0} max={30} value={p.gapYears ?? ""} onChange={(e) => set("gapYears", num(e.target.value))} /></Field>
          <Field label="Failed or repeated courses"><input className="input" type="number" min={0} value={p.failedCourses ?? ""} onChange={(e) => set("failedCourses", num(e.target.value))} /></Field>
          <Field label="Work / research experience (years)"><input className="input" type="number" step="0.5" min={0} value={p.experienceYears ?? ""} onChange={(e) => set("experienceYears", num(e.target.value))} /></Field>
        </div>
      </Section>

      <Section title="Language tests">
        {(p.languageTests ?? []).map((t: any, i: number) => (
          <div key={i} className="row" style={{ flexWrap: "nowrap" } as any}>
            <select aria-label="Test" className="input" value={t.test} onChange={(e) => set("languageTests", p.languageTests.map((x: any, j: number) => (j === i ? { ...x, test: e.target.value } : x)))}>
              {["IELTS", "TOEFL", "PTE", "Duolingo", "HSK", "TestDaF", "Goethe", "CILS", "CELI"].map((x) => <option key={x}>{x}</option>)}
            </select>
            <input aria-label="Score or level" className="input" type="number" step="0.5" value={t.score ?? ""} placeholder="Score / level" onChange={(e) => set("languageTests", p.languageTests.map((x: any, j: number) => (j === i ? { ...x, score: num(e.target.value) } : x)))} />
            <button className="btn btn-soft icon-btn" aria-label="Remove test" onClick={() => set("languageTests", p.languageTests.filter((_: any, j: number) => j !== i))}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => set("languageTests", [...(p.languageTests ?? []), { test: "IELTS", score: "" }])}><Plus size={14} />Add test</button>
      </Section>

      <Section title="Your goal">
        <div className="grid grid-2">
          <Field label="Degree you want">
            <select className="input" value={p.targetLevel ?? ""} onChange={(e) => set("targetLevel", e.target.value || undefined)}>
              <option value="">—</option><option value="bachelor">Bachelor's</option><option value="master">Master's</option><option value="phd">PhD</option>
            </select>
          </Field>
          <Field label="Field you want to study"><input className="input" value={p.targetField ?? ""} onChange={(e) => set("targetField", e.target.value)} /></Field>
          <Field label="Intake" help="e.g. Sep 2027"><input className="input" value={p.intake ?? ""} onChange={(e) => set("intake", e.target.value)} /></Field>
          <Field label="Budget you can arrange (PKR)" help="A rough figure is fine"><input className="input" type="number" min={0} value={p.budgetPkr ?? ""} onChange={(e) => set("budgetPkr", num(e.target.value))} /></Field>
        </div>
        <div className="chips" role="group" aria-label="Countries">
          {[["CN", "China"], ["DE", "Germany"], ["IT", "Italy"], ["KR", "South Korea"]].map(([c, l]) => {
            const on = (p.targetCountries ?? []).includes(c);
            return <button key={c} type="button" className="chip" aria-pressed={on} onClick={() => set("targetCountries", on ? p.targetCountries.filter((x: string) => x !== c) : [...(p.targetCountries ?? []), c])}>{l}</button>;
          })}
        </div>
      </Section>

      {err && <Notice kind="bad">{err}</Notice>}
      <div className="row"><button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save and see matches"}</button></div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card stack" style={{ "--gap": "14px" } as any}><h3>{title}</h3>{children}</div>;
}
function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return <label className="field"><span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</span>{children}{help && <span className="help">{help}</span>}</label>;
}
