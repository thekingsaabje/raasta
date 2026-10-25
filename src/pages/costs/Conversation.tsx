import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, Info } from "lucide-react";
import type { AwardTerms, CostLine } from "../../../shared/planner";
import { termsFromCoverage } from "../../../shared/planner";
import { FUNDING_LABEL } from "../../../shared/funding";
import { Notice, StatusBadge } from "../../components/ui";
import {
  EXTRA_SUGGESTIONS, HOME_CURRENCY, bestRef, lineFromRef, removeLine, unknownSource, upsertLine, userSource,
  type Answers, type Country, type Reference,
} from "./model";
import { EvidenceBadge } from "./bits";

type StepId = "destination" | "place" | "programme" | "duration" | "situation" | "scholarship" | "potential" | "offer" | "tuition" | "accommodation" | "living" | "extras" | "funds";

const CURRENCIES = ["PKR", "EUR", "CNY", "USD"];

export function stepsFor(a: Answers): StepId[] {
  const s: StepId[] = ["destination", "place", "programme", "duration", "situation", "scholarship"];
  if (a.schol === "exploring" || a.schol === "applied") s.push("potential");
  if (a.schol === "partial_offer" || a.schol === "full_offer" || a.schol === "confirmed") s.push("offer");
  s.push("tuition", "accommodation", "living", "extras", "funds");
  return s;
}

export function Conversation({ answers, set, refs, scholarships, onDone, startAt }: {
  answers: Answers;
  set: (fn: (a: Answers) => Answers) => void;
  refs: Reference[];
  scholarships: any[];
  onDone: () => void;
  startAt?: number;
}) {
  const steps = stepsFor(answers);
  const [i, setI] = useState(Math.min(startAt ?? 0, steps.length - 1));
  const [dir, setDir] = useState(1);
  const step = steps[Math.min(i, steps.length - 1)];
  const go = (n: number) => {
    setDir(n > i ? 1 : -1);
    if (n >= steps.length) return onDone();
    setI(Math.max(0, n));
  };
  const canContinue = useMemo(() => {
    if (step === "destination") return !!answers.country;
    if (step === "programme") return !!answers.level;
    if (step === "duration") return !!answers.months && answers.months > 0;
    if (step === "situation") return !!answers.situation;
    if (step === "scholarship") return !!answers.schol;
    return true;
  }, [step, answers]);
  const optional = ["place", "potential", "accommodation", "living", "extras"].includes(step);

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div className="row between">
        <span className="tiny num">Question {i + 1} of {steps.length}</span>
        <button className="btn btn-link btn-sm" onClick={onDone}>Skip to results</button>
      </div>
      <div className="progress" aria-hidden><motion.div animate={{ width: `${((i + 1) / steps.length) * 100}%` }} transition={{ duration: 0.4 }} /></div>
      <Trail answers={answers} steps={steps} current={i} onJump={(n) => go(n)} />
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -28 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{ padding: "28px 24px" }}
          >
            <StepBody step={step} answers={answers} set={set} refs={refs} scholarships={scholarships} />
          </motion.div>
        </AnimatePresence>
        <div className="row between" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", background: "var(--sunk)" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => go(i - 1)} disabled={i === 0}><ArrowLeft size={14} />Back</button>
          <span className="row" style={{ "--gap": "8px" } as any}>
            {optional && <button className="btn btn-link btn-sm" onClick={() => go(i + 1)}>Skip</button>}
            <button className="btn btn-primary btn-sm" disabled={!canContinue} onClick={() => go(i + 1)}>
              {i === steps.length - 1 ? <>See my results <Check size={14} /></> : <>Continue <ArrowRight size={14} /></>}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

const STEP_LABEL: Record<StepId, string> = {
  destination: "Destination", place: "City & university", programme: "Programme", duration: "Duration", situation: "Your situation",
  scholarship: "Scholarship", potential: "Awards to compare", offer: "Your award", tuition: "Tuition", accommodation: "Housing",
  living: "Living costs", extras: "Other costs", funds: "Your funds",
};

function Trail({ answers, steps, current, onJump }: { answers: Answers; steps: StepId[]; current: number; onJump: (n: number) => void }) {
  const value = (s: StepId): string | null => {
    const a = answers;
    switch (s) {
      case "destination": return a.country ? ({ CN: "China", DE: "Germany", IT: "Italy" } as const)[a.country] : null;
      case "place": return [a.city, a.university].filter(Boolean).join(", ") || null;
      case "programme": return a.level ? `${a.level === "phd" ? "PhD" : a.level[0].toUpperCase() + a.level.slice(1)}${a.programme ? ` · ${a.programme}` : ""}` : null;
      case "duration": return a.months ? `${a.months} months` : null;
      case "situation": return a.situation ? SITUATIONS.find((x) => x[0] === a.situation)?.[1] ?? null : null;
      case "scholarship": return a.schol ? SCHOL.find((x) => x[0] === a.schol)?.[1] ?? null : null;
      case "potential": return a.awards.filter((x) => x.status === "potential").length ? `${a.awards.filter((x) => x.status === "potential").length} selected` : null;
      case "offer": return a.awards.find((x) => x.status === "confirmed")?.name ?? null;
      default: return null;
    }
  };
  const items = steps.map((s, n) => [s, n, value(s)] as const).filter(([, n, v]) => v && n < current);
  if (!items.length) return null;
  return (
    <div className="chips" aria-label="Your answers so far">
      {items.map(([s, n, v]) => (
        <button key={s} className="chip" onClick={() => onJump(n)} title={`Edit ${STEP_LABEL[s]}`}>
          <span className="tiny">{STEP_LABEL[s]}:</span> {v}
        </button>
      ))}
    </div>
  );
}

const SITUATIONS = [
  ["applying", "Applying from Pakistan"],
  ["admitted", "Already admitted"],
  ["studying", "Already studying abroad"],
  ["continuing_award", "Continuing student with a scholarship"],
] as const;
const SCHOL = [
  ["none", "No scholarship"],
  ["exploring", "Exploring scholarships"],
  ["applied", "Applied, waiting for results"],
  ["partial_offer", "I have a partial scholarship offer"],
  ["full_offer", "I have a full scholarship offer"],
  ["confirmed", "I already hold a confirmed award"],
] as const;

function Q({ title, help, children }: { title: string; help?: ReactNode; children: ReactNode }) {
  return (
    <div className="stack" style={{ "--gap": "16px" } as any}>
      <div>
        <h2 style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.8rem)" }}>{title}</h2>
        {help && <p className="muted" style={{ marginTop: 6, fontSize: 15 }}>{help}</p>}
      </div>
      {children}
    </div>
  );
}

function Choices<T extends string>({ value, options, onPick, label }: { value?: T; options: readonly (readonly [T, string])[]; onPick: (v: T) => void; label: string }) {
  return (
    <div className="choice-grid" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className="choice" onClick={() => onPick(v)}>
          <span className="choice-dot" aria-hidden>{value === v && <Check size={12} strokeWidth={3} />}</span>{l}
        </button>
      ))}
    </div>
  );
}

export function MoneyField({ label, line, onChange, freqs = ["once", "month", "semester", "year"], help }: {
  label: string;
  line: Pick<CostLine, "amount" | "currency" | "freq">;
  onChange: (p: Partial<CostLine>) => void;
  freqs?: CostLine["freq"][];
  help?: string;
}) {
  const id = label.replace(/\W+/g, "-").toLowerCase();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money">
        <input id={id} className="input num" type="number" inputMode="decimal" min={0} placeholder="Unknown" value={line.amount ?? ""} onChange={(e) => onChange({ amount: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })} />
        <select className="input" aria-label={`${label} currency`} value={line.currency} onChange={(e) => onChange({ currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        {freqs.length > 1 && (
          <select className="input" aria-label={`${label} frequency`} value={line.freq} onChange={(e) => onChange({ freq: e.target.value as CostLine["freq"] })}>
            {freqs.map((f) => <option key={f} value={f}>{{ once: "one-time", month: "per month", semester: "per semester", year: "per year" }[f]}</option>)}
          </select>
        )}
      </div>
      {help && <span className="help">{help}</span>}
    </div>
  );
}

function RefHint({ r, onUse }: { r?: Reference; onUse?: () => void }) {
  if (!r) return <p className="tiny"><Info size={12} style={{ display: "inline", verticalAlign: -2 }} /> No official figure on file yet. Enter what the official page says, or leave it blank (it will be listed as unknown).</p>;
  return (
    <div className="sunk row between" style={{ alignItems: "flex-start" }}>
      <div className="grow">
        <div className="row" style={{ "--gap": "8px" } as any}><EvidenceBadge status={r.status} /><strong style={{ fontSize: 14 }}>{r.label}</strong></div>
        <div className="tiny num" style={{ marginTop: 4 }}>
          {r.amount?.toLocaleString()}{r.amount_max ? `–${r.amount_max.toLocaleString()}` : ""} {r.currency} {({ once: "", month: "/ month", semester: "/ semester", year: "/ year" })[r.unit]} · {r.authority}{r.checked_at ? ` · checked ${r.checked_at.slice(0, 10)}` : ""}
          {r.source_url && <> · <a href={r.source_url} target="_blank" rel="noopener noreferrer">source <ExternalLink size={10} style={{ display: "inline" }} /></a></>}
        </div>
        {r.applies_to && <div className="tiny">Applies to: {r.applies_to}</div>}
      </div>
      {onUse && <button className="btn btn-soft btn-sm" onClick={onUse}>Use this</button>}
    </div>
  );
}

function StepBody({ step, answers: a, set, refs, scholarships }: { step: StepId; answers: Answers; set: (fn: (a: Answers) => Answers) => void; refs: Reference[]; scholarships: any[] }) {
  const home = a.country ? HOME_CURRENCY[a.country] : "EUR";
  const line = (id: string) => a.costs.find((c) => c.id === id);
  const put = (l: CostLine) => set((x) => ({ ...x, costs: upsertLine(x.costs, l) }));

  switch (step) {
    case "destination":
      return (
        <Q title="Where do you want to study?" help="We'll use official figures for that country where we have them.">
          <Choices label="Destination" value={a.country} options={[["CN", "China"], ["DE", "Germany"], ["IT", "Italy"]] as const} onPick={(v: Country) => set((x) => ({ ...x, country: v, display: x.display === "PKR" ? "PKR" : HOME_CURRENCY[v] }))} />
        </Q>
      );
    case "place":
      return (
        <Q title="Do you know the city or university?" help="Optional. It helps you match the right official fee pages later.">
          <div className="grid grid-2">
            <label className="field"><span>City</span><input className="input" value={a.city ?? ""} onChange={(e) => set((x) => ({ ...x, city: e.target.value }))} placeholder="e.g. Munich" /></label>
            <label className="field"><span>University</span><input className="input" value={a.university ?? ""} onChange={(e) => set((x) => ({ ...x, university: e.target.value }))} placeholder="e.g. TU Munich" /></label>
          </div>
        </Q>
      );
    case "programme":
      return (
        <Q title="Which degree are you planning?">
          <Choices label="Degree level" value={a.level} options={[["bachelor", "Bachelor's"], ["master", "Master's"], ["phd", "PhD"]] as const} onPick={(v) => set((x) => ({ ...x, level: v, months: x.months ?? ({ bachelor: 48, master: 24, phd: 36 } as const)[v] }))} />
          <label className="field"><span>Programme (optional)</span><input className="input" value={a.programme ?? ""} onChange={(e) => set((x) => ({ ...x, programme: e.target.value }))} placeholder="e.g. MSc Data Science" /></label>
        </Q>
      );
    case "duration":
      return (
        <Q title="How long is the programme?" help="Use the official duration. Fees billed per semester or year are counted per started period.">
          <Choices label="Duration" value={String(a.months ?? "")} options={[["12", "1 year"], ["18", "1.5 years"], ["24", "2 years"], ["36", "3 years"], ["48", "4 years"], ["60", "5 years"]] as const} onPick={(v) => set((x) => ({ ...x, months: Number(v) }))} />
          <div className="grid grid-2">
            <label className="field"><span>Or exact months</span><input className="input num" type="number" min={1} max={120} value={a.months ?? ""} onChange={(e) => set((x) => ({ ...x, months: e.target.value ? Math.min(120, Math.max(1, Number(e.target.value))) : undefined }))} /></label>
            <label className="field"><span>Planned start (optional)</span><input className="input" type="month" value={a.start ?? ""} onChange={(e) => set((x) => ({ ...x, start: e.target.value }))} /></label>
          </div>
        </Q>
      );
    case "situation":
      return (
        <Q title="Which describes you best?">
          <Choices label="Situation" value={a.situation} options={SITUATIONS} onPick={(v) => set((x) => ({ ...x, situation: v }))} />
        </Q>
      );
    case "scholarship":
      return (
        <Q title="What's your scholarship situation?" help="Raasta keeps money you might get (potential) separate from money you have.">
          <Choices
            label="Scholarship situation"
            value={a.schol}
            options={SCHOL}
            onPick={(v) =>
              set((x) => ({
                ...x,
                schol: v,
                // Changing the situation removes awards that no longer fit, so nothing is counted by accident.
                awards: v === "none" ? [] : v === "exploring" || v === "applied" ? x.awards.filter((w) => w.status === "potential") : x.awards.filter((w) => w.status === "confirmed"),
                potentialIds: v === "exploring" || v === "applied" ? x.potentialIds : [],
              }))
            }
          />
        </Q>
      );
    case "potential": {
      const list = scholarships.filter((s) => s.country === a.country && !s.is_test_data && s.status !== "CANCELLED").slice(0, 40);
      const toggle = (s: any) =>
        set((x) => {
          const on = x.potentialIds.includes(s.id);
          if (!on && x.potentialIds.length >= 3) return x;
          const terms = termsFromCoverage(s.id, s.name, s.coverage, { status: s.status?.startsWith("VERIFIED_") ? "VERIFIED" : "ESTIMATE", url: s.official_url, authority: s.provider, checked: s.last_verified_at ?? s.retrieved_at ?? undefined });
          return { ...x, potentialIds: on ? x.potentialIds.filter((i) => i !== s.id) : [...x.potentialIds, s.id], awards: on ? x.awards.filter((w) => w.id !== s.id) : [...x.awards, terms] };
        });
      return (
        <Q title="Which scholarships do you want to compare?" help="Pick up to 3. They'll be shown as potential funding only, never as money you have. You can adjust their terms on the results page.">
          {list.length === 0 && <p className="muted">No catalogued awards for this country yet.</p>}
          <div className="stack" style={{ "--gap": "8px", maxHeight: 380, overflow: "auto" } as any}>
            {list.map((s) => {
              const on = a.potentialIds.includes(s.id);
              return (
                <button key={s.id} type="button" className="choice" role="checkbox" aria-checked={on} onClick={() => toggle(s)} style={{ justifyContent: "space-between", textAlign: "left" }}>
                  <span className="row" style={{ "--gap": "10px", flexWrap: "nowrap" } as any}><span className="choice-dot" aria-hidden>{on && <Check size={12} strokeWidth={3} />}</span><span><strong style={{ fontSize: 14.5 }}>{s.name}</strong><br /><span className="tiny">{FUNDING_LABEL[(s.funding_class ?? "unknown") as keyof typeof FUNDING_LABEL]}</span></span></span>
                  <StatusBadge status={s.status} method={s.verification_method} />
                </button>
              );
            })}
          </div>
        </Q>
      );
    }
    case "offer": {
      const cur = a.awards.find((w) => w.status === "confirmed");
      const base: AwardTerms = cur ?? { id: "offer", name: "", status: "confirmed", source: userSource, tuition: { type: a.schol === "full_offer" ? "full" : "unknown" }, stipend: null, accommodation: "unknown", insurance: "unknown", travel: "unknown" };
      const upd = (p: Partial<AwardTerms>) => set((x) => ({ ...x, awards: [...x.awards.filter((w) => w.status !== "confirmed"), { ...base, ...p }] }));
      return (
        <Q title="Tell us what your award letter says" help="Enter only what the letter states. A 'fully funded' label alone doesn't tell us what's paid. Unknown parts count as zero.">
          <label className="field"><span>Award name</span><input className="input" value={base.name} onChange={(e) => upd({ name: e.target.value })} placeholder="e.g. CSC Type B (Zhejiang University)" /></label>
          <div className="grid grid-2">
            <label className="field"><span>Tuition</span>
              <select className="input" value={base.tuition.type} onChange={(e) => upd({ tuition: e.target.value === "percent" ? { type: "percent", percent: 50 } : e.target.value === "amount" ? { type: "amount", amount: 0, currency: home, per: "year" } : ({ type: e.target.value } as any) })}>
                <option value="full">Fully waived</option><option value="percent">Partly waived (%)</option><option value="amount">Fixed amount</option><option value="none">Not covered</option><option value="unknown">Not stated</option>
              </select>
            </label>
            {base.tuition.type === "percent" && <label className="field"><span>Waiver %</span><input className="input num" type="number" min={0} max={100} value={base.tuition.percent} onChange={(e) => upd({ tuition: { type: "percent", percent: Math.min(100, Math.max(0, Number(e.target.value))) } })} /></label>}
            {base.tuition.type === "amount" && <MoneyField label="Tuition amount covered" line={{ amount: base.tuition.amount, currency: base.tuition.currency, freq: base.tuition.per }} onChange={(p) => upd({ tuition: { type: "amount", amount: p.amount ?? (base.tuition as any).amount, currency: p.currency ?? (base.tuition as any).currency, per: p.freq ?? (base.tuition as any).per } })} />}
          </div>
          <MoneyField label="Stipend (cash)" freqs={["month", "year"]} line={{ amount: base.stipend?.amount ?? null, currency: base.stipend?.currency ?? home, freq: base.stipend?.per ?? "month" }} onChange={(p) => {
            const amount = p.amount === undefined ? base.stipend?.amount ?? null : p.amount;
            upd({ stipend: amount === null ? null : { amount, currency: p.currency ?? base.stipend?.currency ?? home, per: (p.freq as "month" | "year") ?? base.stipend?.per ?? "month", startsAfterArrival: true } });
          }} help="Leave blank if there's no stipend. We assume it starts after arrival (the first month is on you)." />
          <div className="grid grid-2">
            <label className="field"><span>Accommodation</span><select className="input" value={typeof base.accommodation === "string" ? base.accommodation : "full"} onChange={(e) => upd({ accommodation: e.target.value as any })}><option value="full">Free / fully covered</option><option value="none">Not covered</option><option value="unknown">Not stated</option></select></label>
            <label className="field"><span>Insurance</span><select className="input" value={base.insurance} onChange={(e) => upd({ insurance: e.target.value as any })}><option value="full">Covered</option><option value="none">Not covered</option><option value="unknown">Not stated</option></select></label>
            <label className="field"><span>Travel</span><select className="input" value={typeof base.travel === "string" ? base.travel : "full"} onChange={(e) => upd({ travel: e.target.value as any })}><option value="full">Covered</option><option value="none">Not covered</option><option value="unknown">Not stated</option></select></label>
            <label className="field"><span>Award length (months, if shorter)</span><input className="input num" type="number" min={1} max={120} value={base.durationMonths ?? ""} placeholder={String(a.months ?? "")} onChange={(e) => upd({ durationMonths: e.target.value ? Number(e.target.value) : undefined })} /></label>
          </div>
          {!base.name && <Notice kind="info">Give the award a name so you can recognise it in your results.</Notice>}
        </Q>
      );
    }
    case "tuition": {
      const r = bestRef(refs, "tuition");
      const l = line("tuition") ?? { id: "tuition", category: "tuition", label: "Tuition", amount: null, currency: home, freq: "year", stage: "during_study", source: unknownSource } as CostLine;
      return (
        <Q title="What is the tuition fee?" help="Use the figure on your programme's official page. Many public German universities charge no tuition, only a semester fee.">
          <div className="chips">
            <button className="chip" onClick={() => put({ ...l, amount: 0, source: userSource, label: "Tuition (none charged)" })}>No tuition charged</button>
            <button className="chip" onClick={() => put({ ...l, amount: null, source: unknownSource, label: "Tuition" })}>I don't know yet</button>
          </div>
          <MoneyField label="Tuition" line={l} freqs={["semester", "year", "once"]} onChange={(p) => put({ ...l, ...p, source: p.amount !== undefined ? userSource : l.source, label: "Tuition" })} />
          <RefHint r={r} onUse={r ? () => put(lineFromRef(r, "tuition", "during_study")) : undefined} />
          {(a.country === "DE" || refs.some((x) => x.category === "semester_fee")) && <FeeLine refs={refs} a={a} put={put} />}
        </Q>
      );
    }
    case "accommodation": {
      const r = bestRef(refs, "accommodation");
      const l = line("rent") ?? { id: "rent", category: "accommodation", label: "Accommodation", amount: null, currency: home, freq: "month", stage: "during_study", source: unknownSource } as CostLine;
      return (
        <Q title="Where will you live?" help="Dormitories are usually cheapest but limited. Enter the rent you expect per month.">
          <Choices label="Housing type" value={l.label.replace("Accommodation · ", "") as any} options={[["University dormitory", "University dormitory"], ["Shared flat", "Shared flat"], ["Private flat", "Private flat"], ["Not sure", "Not sure"]] as const} onPick={(v) => put({ ...l, label: `Accommodation · ${v}` })} />
          <MoneyField label="Rent" line={l} freqs={["month", "year", "semester"]} onChange={(p) => put({ ...l, ...p, source: p.amount !== undefined ? userSource : l.source })} />
          <RefHint r={r} onUse={r ? () => put({ ...lineFromRef(r, "rent", "during_study"), label: l.label }) : undefined} />
        </Q>
      );
    }
    case "living": {
      const r = bestRef(refs, "living");
      const l = line("living") ?? { id: "living", category: "living", label: "Food & everyday living", amount: null, currency: home, freq: "month", stage: "during_study", source: unknownSource } as CostLine;
      return (
        <Q title="How much will you spend on food and everyday life?" help="Excluding rent. Official averages are a starting point; your own spending may differ.">
          <MoneyField label="Living costs" line={l} freqs={["month"]} onChange={(p) => put({ ...l, ...p, source: p.amount !== undefined ? userSource : l.source })} />
          <RefHint r={r} onUse={r ? () => put({ ...lineFromRef(r, "living", "during_study"), label: "Food & everyday living" }) : undefined} />
        </Q>
      );
    }
    case "extras":
      return (
        <Q title="Which other costs apply to you?" help="Tick what applies. Official figures are filled in where we have them; everything stays editable.">
          <div className="stack" style={{ "--gap": "10px" } as any}>
            {EXTRA_SUGGESTIONS.map((s) => {
              const cur = line(s.id);
              const r = bestRef(refs, s.category);
              const on = !!cur;
              return (
                <div key={s.id} className="sunk stack" style={{ "--gap": "10px", background: on ? "var(--panel)" : undefined } as any}>
                  <label className="row" style={{ "--gap": "10px", fontWeight: 600, fontSize: 14.5 } as any}>
                    <input type="checkbox" checked={on} onChange={(e) => set((x) => ({ ...x, costs: e.target.checked ? upsertLine(x.costs, r ? { ...lineFromRef(r, s.id, s.stage), label: s.label, depositType: s.depositType, freq: r.unit } : { id: s.id, category: ({ medical_exam: "documents", residence_permit: "visa" } as any)[s.category] ?? s.category, label: s.label, amount: null, currency: s.category === "travel" || s.category === "documents" || s.category === "application" ? "PKR" : home, freq: s.freq, stage: s.stage, source: unknownSource, depositType: s.depositType }) : removeLine(x.costs, s.id) }))} />
                    {s.label}
                    {cur && <EvidenceBadge status={cur.amount === null ? "UNKNOWN" : cur.source.status} />}
                  </label>
                  {cur && <MoneyField label={`${s.label} amount`} line={cur} onChange={(p) => put({ ...cur, ...p, source: p.amount !== undefined ? userSource : cur.source })} help={s.depositType === "refundable" ? "Needed in cash up front, returned later — not counted as a cost." : s.depositType === "prepayment" ? "Paid early but part of your tuition — moves cash earlier, not added again." : r ? `Official: ${r.authority}${r.checked_at ? `, checked ${r.checked_at.slice(0, 10)}` : ""}` : undefined} />}
                </div>
              );
            })}
          </div>
        </Q>
      );
    case "funds": {
      const f = a.funds;
      const fm = (k: keyof typeof f, label: string, help?: string) => (
        <MoneyField label={label} freqs={["once"]} line={{ amount: f[k]?.amount ?? null, currency: f[k]?.currency ?? "PKR", freq: "once" }} onChange={(p) => set((x) => ({ ...x, funds: { ...x.funds, [k]: p.amount === null ? null : { amount: p.amount ?? x.funds[k]?.amount ?? 0, currency: p.currency ?? x.funds[k]?.currency ?? "PKR" } } }))} help={help} />
      );
      return (
        <Q title="How much can you legitimately put towards your studies?" help="Rough figures are fine. Don't upload bank statements; we never need them.">
          <div className="grid grid-2">
            {fm("savings", "Your savings")}
            {fm("sponsor", "Family or sponsor support", "Only money a sponsor will genuinely and legally provide.")}
            {fm("other", "Other confirmed funding", "e.g. an education loan already approved.")}
            {fm("maxContribution", "Most you could contribute in total", "Optional. We'll warn you if the plan needs more.")}
          </div>
          <label className="field" style={{ maxWidth: 240 }}><span>Show results in</span><select className="input" value={a.display} onChange={(e) => set((x) => ({ ...x, display: e.target.value }))}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        </Q>
      );
    }
  }
}

function FeeLine({ refs, a, put }: { refs: Reference[]; a: Answers; put: (l: CostLine) => void }) {
  const r = bestRef(refs, "semester_fee");
  const l = a.costs.find((c) => c.id === "fees") ?? ({ id: "fees", category: "fees", label: "Semester / enrolment fee", amount: null, currency: HOME_CURRENCY[a.country ?? "DE"], freq: "semester", stage: "during_study", source: unknownSource } as CostLine);
  return (
    <div className="stack" style={{ "--gap": "10px", marginTop: 6 } as any}>
      <MoneyField label="Semester / enrolment fee" line={l} freqs={["semester", "year"]} onChange={(p) => put({ ...l, ...p, source: p.amount !== undefined ? userSource : l.source })} help="Separate from tuition; scholarships that waive tuition often don't cover it." />
      <RefHint r={r} onUse={r ? () => put({ ...lineFromRef(r, "fees", "during_study"), label: "Semester / enrolment fee" }) : undefined} />
    </div>
  );
}
