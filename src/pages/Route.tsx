import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Page } from "../components/Layout";
import { Notice, Skeleton, useToast } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useRouter } from "../lib/router";
import type { Profile } from "../../shared/profile";
import { Assessment } from "./route/Assessment";
import { RouteResults } from "./route/RouteResults";

const DRAFT = "raasta.route.draft.v1";
const PENDING = "raasta.route.pendingSave";
const PLANNER_DRAFT = "raasta.costplan.draft.v1";
const YEARS: Record<string, number> = { bachelor: 4, master: 2, phd: 3 };

interface Draft { profile: Profile; phase: "questions" | "results"; selected: string[]; step?: number }
const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage unavailable: the assessment still works for this visit */
    }
  },
};

/** Drop half-filled answers so the server only sees valid values. */
export function cleanProfile(p: Profile): Profile {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) out[k] = v;
  if (out.grade && !Number.isFinite((out.grade as any).value)) delete out.grade;
  if (out.languageTests) {
    out.languageTests = (out.languageTests as any[]).filter((t) => t.test && Number.isFinite(t.score));
    if (!(out.languageTests as any[]).length) delete out.languageTests;
  }
  return out as Profile;
}

export function RoutePage() {
  const { user } = useAuth();
  const { go } = useRouter();
  const toast = useToast();
  const saved = store.get<Draft>(DRAFT);
  const [profile, setProfile] = useState<Profile>(saved?.profile ?? { nationality: "PK" });
  const [phase, setPhase] = useState<Draft["phase"]>(saved?.phase ?? "questions");
  const [selected, setSelected] = useState<string[]>(saved?.selected ?? []);
  // Resume on the question the student was on (refresh, or coming back later).
  const [startAt, setStartAt] = useState(saved?.step ?? 0);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Answers live in this browser until the student chooses to save them to an account.
  useEffect(() => store.set(DRAFT, { profile, phase, selected, step }), [profile, phase, selected, step]);

  const evaluate = useCallback(async (p: Profile) => {
    setLoading(true);
    setError(null);
    try {
      setResult(await api.post("/route/evaluate", { profile: cleanProfile(p) }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (phase === "results") evaluate(profile);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const inFlight = useRef(false);
  const save = useCallback(async () => {
    if (!user) {
      store.set(PENDING, 1);
      return go("/signup?next=/route");
    }
    // One save at a time: a double click or a re-run effect must not create the roadmap twice.
    if (inFlight.current) return;
    inFlight.current = true;
    store.set(PENDING, null);
    setSaving(true);
    try {
      const current = (await api.get<{ profile: Profile }>("/me/profile")).profile;
      await api.put("/me/profile", cleanProfile({ ...current, ...profile }));
      const actions = (result?.nextActions ?? []).filter((n: any) => !n.to).map((n: any) => ({ title: n.title, why: n.why }));
      const r = await api.post("/me/roadmap", { scholarshipIds: selected, actions });
      toast(`Saved. ${r.createdApplications} application${r.createdApplications === 1 ? "" : "s"} and ${r.createdTasks} task${r.createdTasks === 1 ? "" : "s"} added to your dashboard.`);
      go("/app");
    } catch (e: any) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [user, profile, selected, result, go, toast]);

  // Back from sign-up with a pending save: finish it once the results are loaded.
  useEffect(() => {
    if (user && result && store.get<number>(PENDING)) save();
  }, [user, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const planCosts = (country: string) => {
    const existing = store.get<any>(PLANNER_DRAFT);
    if (existing?.costs?.length && !confirm("Replace the cost plan you already started in this browser?")) return go("/costs");
    const years = YEARS[profile.targetLevel ?? "master"];
    store.set(PLANNER_DRAFT, {
      country, level: profile.targetLevel, months: years * 12, display: "PKR",
      situation: profile.journey === "applying_from_pakistan" ? "applying" : profile.hasExistingScholarship ? "continuing_award" : "studying",
      potentialIds: [], awards: [], costs: [], funds: profile.budgetPkr ? { savings: { amount: profile.budgetPkr, currency: "PKR" } } : {}, rateOverrides: {},
    });
    go("/costs");
  };

  return (
    <Page>
      <div className="page-head">
        <div>
          <h1>Find your study route</h1>
          <p className="lead">A few questions, one at a time. We then check your profile against each award's published rules and show where you stand, with the evidence.</p>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {phase === "questions" ? (
          <motion.div key="q" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ maxWidth: 820 }}>
            <Assessment p={profile} set={(fn) => setProfile((p) => fn(p))} onDone={() => setPhase("results")} startAt={startAt} onStep={setStep} />
            <p className="tiny" style={{ marginTop: 12 }}>Your answers are kept as a draft in this browser only, until you choose to save them. No documents or bank statements needed.</p>
          </motion.div>
        ) : (
          <motion.div key="r" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {error && <Notice kind="bad">{error}</Notice>}
            {loading || !result ? (
              <div className="stack" style={{ "--gap": "16px" } as any}><Skeleton h={160} /><Skeleton h={240} /></div>
            ) : (
              <RouteResults
                data={result}
                selected={selected}
                toggle={(id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]))}
                onEdit={() => { setStartAt(0); setStep(0); setPhase("questions"); }}
                onPlan={planCosts}
                onSave={save}
                saving={saving}
                signedIn={!!user}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Page>
  );
}
