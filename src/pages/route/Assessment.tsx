import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import type { Profile } from "../../../shared/profile";
import { Choices, Q } from "../costs/Conversation";

type Step = "journey" | "abroad" | "countries" | "goal" | "qualification" | "grades" | "gap" | "language" | "personal" | "budget";
const LABEL: Record<Step, string> = {
  journey: "Situation", abroad: "Current studies", countries: "Countries", goal: "Goal", qualification: "Qualification",
  grades: "Grades", gap: "Study gap", language: "Language", personal: "About you", budget: "Budget",
};
const JOURNEYS = [
  ["applying_from_pakistan", "I'm applying from Pakistan"],
  ["studying_in_china", "I'm already studying in China"],
  ["studying_in_germany_italy", "I'm already studying in Germany, Italy or Korea"],
  ["holds_scholarship", "I hold a scholarship and need a renewal or more funding"],
] as const;
const COUNTRY_NAME = { CN: "China", DE: "Germany", IT: "Italy", KR: "South Korea" } as const;

export function stepsFor(p: Profile): Step[] {
  const abroad = p.journey && p.journey !== "applying_from_pakistan";
  return ["journey", ...(abroad ? (["abroad"] as Step[]) : []), "countries", "goal", "qualification", "grades", "gap", "language", "personal", "budget"];
}

export function Assessment({ p, set, onDone, startAt = 0, onStep }: { p: Profile; set: (fn: (p: Profile) => Profile) => void; onDone: () => void; startAt?: number; onStep?: (i: number) => void }) {
  const steps = stepsFor(p);
  const [i, setI] = useState(Math.min(startAt, steps.length - 1));
  const [dir, setDir] = useState(1);
  const step = steps[Math.min(i, steps.length - 1)];
  const go = (n: number) => {
    setDir(n > i ? 1 : -1);
    if (n >= steps.length) return onDone();
    setI(Math.max(0, n));
    onStep?.(Math.max(0, n));
  };
  const required: Partial<Record<Step, boolean>> = { journey: !!p.journey, goal: !!p.targetLevel };
  const canContinue = required[step] ?? true;
  const optional = !(step in required);

  const trail = steps
    .map((s, n) => [s, n, summary(s, p)] as const)
    .filter(([, n, v]) => v && n < i);

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div className="row between">
        <span className="tiny num">Question {i + 1} of {steps.length}</span>
        <button className="btn btn-link btn-sm" onClick={onDone} disabled={!p.journey}>See my results</button>
      </div>
      <div className="progress" aria-hidden><motion.div animate={{ width: `${((i + 1) / steps.length) * 100}%` }} transition={{ duration: 0.4 }} /></div>
      {trail.length > 0 && (
        <div className="chips" aria-label="Your answers so far">
          {trail.map(([s, n, v]) => <button key={s} className="chip" onClick={() => go(n)} title={`Edit ${LABEL[s]}`}><span className="tiny">{LABEL[s]}:</span> {v}</button>)}
        </div>
      )}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: dir * 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -28 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} style={{ padding: "28px 24px" }}>
            <Body step={step} p={p} set={set} />
          </motion.div>
        </AnimatePresence>
        <div className="row between" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--sunk)" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => go(i - 1)} disabled={i === 0}><ArrowLeft size={14} />Back</button>
          <span className="row" style={{ "--gap": "8px" } as any}>
            {optional && <button className="btn btn-link btn-sm" onClick={() => go(i + 1)}>Skip</button>}
            <button className="btn btn-primary btn-sm" disabled={!canContinue} onClick={() => go(i + 1)}>
              {i === steps.length - 1 ? <>See my study routes <Check size={14} /></> : <>Continue <ArrowRight size={14} /></>}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function summary(s: Step, p: Profile): string | null {
  switch (s) {
    case "journey": return JOURNEYS.find((j) => j[0] === p.journey)?.[1] ?? null;
    case "abroad": return [p.currentUniversity, p.currentYear ? `year ${p.currentYear}` : null].filter(Boolean).join(", ") || null;
    case "countries": return p.targetCountries?.length ? p.targetCountries.map((c) => COUNTRY_NAME[c]).join(", ") : null;
    case "goal": return p.targetLevel ? `${{ bachelor: "Bachelor's", master: "Master's", phd: "PhD" }[p.targetLevel]}${p.targetField ? ` · ${p.targetField}` : ""}` : null;
    case "qualification": return p.highestCompleted ?? null;
    case "grades": return p.grade ? `${p.grade.value} (${p.grade.scale === "100" ? "%" : p.grade.scale === "german" ? "German scale" : `/${p.grade.scale}`})` : null;
    case "gap": return p.gapYears !== undefined ? `${p.gapYears} yr` : null;
    case "language": return p.languageTests?.length ? p.languageTests.map((t) => `${t.test} ${t.score}`).join(", ") : p.languageStatus === "planning" ? "Not yet" : p.languageStatus === "moi" ? "MOI letter" : null;
    case "personal": return p.nationality ?? null;
    case "budget": return p.budgetPkr !== undefined ? `PKR ${p.budgetPkr.toLocaleString("en-PK")}` : null;
  }
}

const num = (v: string) => (v === "" ? undefined : Number(v));

function Body({ step, p, set }: { step: Step; p: Profile; set: (fn: (p: Profile) => Profile) => void }) {
  const up = (patch: Partial<Profile>) => set((x) => ({ ...x, ...patch }));
  switch (step) {
    case "journey":
      return (
        <Q title="Where are you right now?" help="We'll ask different questions depending on your situation.">
          <Choices
            label="Your situation"
            value={p.journey}
            options={JOURNEYS}
            onPick={(v) =>
              set((x) => ({
                ...x,
                journey: v,
                // Students already abroad usually look in the country they're in; applicants choose next.
                currentCountry: v === "studying_in_china" ? "CN" : v === "applying_from_pakistan" ? undefined : x.currentCountry,
                hasExistingScholarship: v === "holds_scholarship" ? true : x.hasExistingScholarship,
              }))
            }
          />
        </Q>
      );
    case "abroad":
      return (
        <Q title="Tell us about your current studies" help="Continuing-student awards and renewals depend on your university and year.">
          {p.journey !== "studying_in_china" && (
            <Choices label="Country you study in" value={p.currentCountry} options={[["CN", "China"], ["DE", "Germany"], ["IT", "Italy"], ["KR", "South Korea"]] as const} onPick={(v) => up({ currentCountry: v })} />
          )}
          <div className="grid grid-2">
            <label className="field"><span>University</span><input className="input" value={p.currentUniversity ?? ""} onChange={(e) => up({ currentUniversity: e.target.value || undefined })} placeholder="e.g. Zhejiang University" /></label>
            <label className="field"><span>Year of study</span><input className="input num" type="number" min={1} max={8} value={p.currentYear ?? ""} onChange={(e) => up({ currentYear: num(e.target.value) })} /></label>
          </div>
          <Choices label="Do you hold a scholarship now?" value={p.hasExistingScholarship === undefined ? undefined : p.hasExistingScholarship ? "yes" : "no"} options={[["yes", "I hold a scholarship"], ["no", "I'm self-funded"]] as const} onPick={(v) => up({ hasExistingScholarship: v === "yes" })} />
          {p.hasExistingScholarship && (
            <>
              <label className="field"><span>Which scholarship?</span><input className="input" value={p.existingScholarshipName ?? ""} onChange={(e) => up({ existingScholarshipName: e.target.value || undefined })} placeholder="e.g. CSC Type B" /></label>
              <Choices label="What do you need?" value={p.needsRenewal === undefined ? undefined : p.needsRenewal ? "renew" : "more"} options={[["renew", "Help renewing it (annual review)"], ["more", "Additional or different funding"]] as const} onPick={(v) => up({ needsRenewal: v === "renew" })} />
            </>
          )}
        </Q>
      );
    case "countries": {
      const on = (c: "CN" | "DE" | "IT" | "KR") => (p.targetCountries ?? []).includes(c);
      return (
        <Q title="Which countries are you considering?" help="Pick one or more. Skip to see all three.">
          <div className="choice-grid">
            {(["CN", "DE", "IT", "KR"] as const).map((c) => (
              <button key={c} type="button" role="checkbox" aria-checked={on(c)} className="choice" onClick={() => up({ targetCountries: on(c) ? (p.targetCountries ?? []).filter((x) => x !== c) : [...(p.targetCountries ?? []), c] })}>
                <span className="choice-dot" aria-hidden>{on(c) && <Check size={12} strokeWidth={3} />}</span>{COUNTRY_NAME[c]}
              </button>
            ))}
          </div>
        </Q>
      );
    }
    case "goal":
      return (
        <Q title="Which degree do you want to study?">
          <Choices label="Degree you want" value={p.targetLevel} options={[["bachelor", "Bachelor's"], ["master", "Master's"], ["phd", "PhD"]] as const} onPick={(v) => up({ targetLevel: v })} />
          <div className="grid grid-2">
            <label className="field"><span>Subject (optional)</span><input className="input" value={p.targetField ?? ""} onChange={(e) => up({ targetField: e.target.value || undefined })} placeholder="e.g. Computer Science" /></label>
            <label className="field"><span>Intended intake (optional)</span><input className="input" value={p.intake ?? ""} onChange={(e) => up({ intake: e.target.value || undefined })} placeholder="e.g. September 2027" /></label>
          </div>
        </Q>
      );
    case "qualification":
      return (
        <Q title="What's your highest completed qualification?" help="Completed, not in progress.">
          <Choices label="Highest completed qualification" value={p.highestCompleted} options={[["intermediate", "Intermediate / A-levels"], ["bachelor", "Bachelor's (16 years)"], ["master", "Master's / MPhil"], ["phd", "PhD"]] as const} onPick={(v) => up({ highestCompleted: v })} />
          <label className="field"><span>Subject of that qualification (optional)</span><input className="input" value={p.field ?? ""} onChange={(e) => up({ field: e.target.value || undefined })} /></label>
        </Q>
      );
    case "grades":
      return (
        <Q title="What were your grades?" help="Exactly as on your transcript. We never convert between grading systems.">
          <Choices label="Grading scale" value={p.grade?.scale} options={[["4", "CGPA out of 4"], ["5", "CGPA out of 5"], ["100", "Percentage"], ["german", "German grade"]] as const} onPick={(v) => up({ grade: { scale: v, value: p.grade?.value ?? (undefined as any) } })} />
          {p.grade && <label className="field" style={{ maxWidth: 220 }}><span>Your grade</span><input className="input num" type="number" step="0.01" min={0} max={100} value={Number.isFinite(p.grade.value) ? p.grade.value : ""} onChange={(e) => up({ grade: e.target.value === "" ? undefined : { scale: p.grade!.scale, value: Number(e.target.value) } })} /></label>}
        </Q>
      );
    case "gap":
      return (
        <Q title="Have you had a study gap?" help="Time not in study since your last qualification. A gap doesn't automatically rule you out.">
          <Choices label="Study gap" value={p.gapYears === undefined ? undefined : String(Math.min(p.gapYears, 3))} options={[["0", "No gap"], ["1", "About 1 year"], ["2", "About 2 years"], ["3", "3 years or more"]] as const} onPick={(v) => up({ gapYears: Number(v) })} />
          <label className="field" style={{ maxWidth: 260 }}><span>Failed or repeated courses (optional)</span><input className="input num" type="number" min={0} value={p.failedCourses ?? ""} onChange={(e) => up({ failedCourses: num(e.target.value) })} /></label>
        </Q>
      );
    case "language": {
      const tests = p.languageTests ?? [];
      return (
        <Q title="Do you have a language test result?" help="Most scholarships ask for one. Tell us where you stand.">
          <Choices label="Language test" value={p.languageStatus ?? (tests.length ? "has_result" : undefined)} options={[["has_result", "I have a result"], ["planning", "Not yet, I plan to take one"], ["moi", "No test, but my degree was taught in English"]] as const}
            onPick={(v) => up({ languageStatus: v, languageTests: v === "has_result" ? (tests.length ? tests : [{ test: "IELTS", score: NaN }]) : [] })} />
          {(p.languageStatus === "has_result" || (!p.languageStatus && tests.length > 0)) && tests.map((t, k) => (
            <div key={k} className="row" style={{ flexWrap: "nowrap" } as any}>
              <select aria-label="Test" className="input" value={t.test} onChange={(e) => up({ languageTests: tests.map((x, j) => (j === k ? { ...x, test: e.target.value } : x)) })}>
                {["IELTS", "TOEFL", "PTE", "Duolingo", "HSK", "TOPIK", "TestDaF", "Goethe", "CILS", "CELI"].map((x) => <option key={x}>{x}</option>)}
              </select>
              <input aria-label="Score or level" className="input num" type="number" step="0.5" value={Number.isFinite(t.score) ? t.score : ""} placeholder="Score / level" onChange={(e) => up({ languageTests: tests.map((x, j) => (j === k ? { ...x, score: Number(e.target.value) } : x)) })} />
              <button className="btn btn-soft icon-btn" aria-label="Remove test" onClick={() => up({ languageTests: tests.filter((_, j) => j !== k) })}><Trash2 size={14} /></button>
            </div>
          ))}
          {(p.languageStatus === "has_result" || (!p.languageStatus && tests.length > 0)) && <button className="btn btn-soft btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => up({ languageTests: [...tests, { test: "IELTS", score: NaN }] })}><Plus size={14} />Add another test</button>}
        </Q>
      );
    }
    case "personal":
      return (
        <Q title="A couple of details for eligibility rules" help="Some awards limit nationality or age. Both are optional.">
          <div className="grid grid-2">
            <label className="field"><span>Nationality</span><select className="input" value={p.nationality ?? ""} onChange={(e) => up({ nationality: e.target.value || undefined })}><option value="">Prefer not to say</option><option value="PK">Pakistani</option></select></label>
            <label className="field"><span>Date of birth</span><input className="input" type="date" value={p.birthDate ?? ""} onChange={(e) => up({ birthDate: e.target.value || undefined })} /></label>
          </div>
        </Q>
      );
    case "budget":
      return (
        <Q title="Roughly how much can you put towards your studies?" help="Your own and legitimate family support, in total. A rough figure is fine; we never ask for bank statements.">
          <Choices label="Funding you need" value={p.fundingNeed} options={[["full_only", "I can only go with full funding"], ["partial_ok", "Partial funding could work"]] as const} onPick={(v) => up({ fundingNeed: v })} />
          <label className="field" style={{ maxWidth: 300 }}><span>Budget (PKR)</span><input className="input num" type="number" min={0} value={p.budgetPkr ?? ""} onChange={(e) => up({ budgetPkr: num(e.target.value) })} placeholder="e.g. 2,000,000" /></label>
        </Q>
      );
  }
}
