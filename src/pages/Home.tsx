import { motion } from "motion/react";
import { useState } from "react";
import { ArrowRight, BadgeCheck, Calculator, ClipboardCheck, FileSearch, Map, PenLine, Plus, Search, ShieldCheck } from "lucide-react";
import { Link, useRouter } from "../lib/router";
import { useApi } from "../lib/use";
import { EligBadge, Reveal, StatusBadge } from "../components/ui";

const QUESTIONS = [
  { icon: FileSearch, t: "What actually fits me?", d: "Universities, programmes and scholarships matched against your real qualifications, not marketing pages." },
  { icon: BadgeCheck, t: "Where are my gaps?", d: "Every rule shown as met, not met, unknown or needs review, with the official source beside it." },
  { icon: Calculator, t: "What will it really cost?", d: "Tuition, living, visa, travel and deposits, minus what a scholarship actually pays." },
  { icon: ClipboardCheck, t: "What do I do, and by when?", d: "A checklist built from the call you're applying to, with dependencies and confirmed deadlines." },
  { icon: PenLine, t: "Can I do this myself?", d: "A Writing Studio that follows each provider's rules on outside help, and a tracker for every application." },
];

const FAQ = [
  ["Is Raasta a consultancy or agent?", "No. Raasta is a self-service tool. You apply through official systems yourself. We never ask for your university portal passwords."],
  ["How do you know a scholarship is real and current?", "Every record links to its official source, with retrieval and verification dates. Records stay marked 'Not yet verified' until a person has checked the current call, and deadlines only count as confirmed after that check."],
  ["Will Raasta tell me my chances?", "No. We show whether you meet the published rules. Selection is competitive and decided by the provider, so we never show a probability of winning."],
  ["Do you write my SOP for me?", "Only where the provider allows drafting help. If the rules allow editing or coaching only, or we haven't confirmed them, the Writing Studio limits itself to that. It never invents achievements."],
  ["What if I find a mistake?", "Every scholarship page has a 'Report an error' button. Reports go to a review queue. Corrections are versioned, and students who saved or applied to that award are notified."],
  ["Do you cover students already studying in China?", "Yes. You can tell us your current university, year and scholarship. Continuing-student awards are kept separate from new-applicant awards."],
];

export function Home() {
  const { go } = useRouter();
  const [q, setQ] = useState("");
  const cov = useApi<any>("/coverage");
  const total = (cov.data?.scholarships ?? []).reduce((a: number, r: any) => a + r.n, 0);
  const srcTotal = (cov.data?.sources ?? []).reduce((a: number, r: any) => a + r.n, 0);

  return (
    <>
      <section className="hero">
        <svg className="path-svg" viewBox="0 0 1200 600" preserveAspectRatio="none" aria-hidden>
          <motion.path d="M-20 520 C 220 500, 300 380, 520 360 S 860 260, 980 160 S 1160 60, 1240 40" stroke="#e8a33d" strokeWidth="2.5" fill="none" strokeDasharray="6 10" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
          {[[520, 360], [980, 160]].map(([x, y], i) => (
            <motion.circle key={i} cx={x} cy={y} r="6" fill="#12372a" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1 + i * 0.6 }} />
          ))}
        </svg>
        <div className="container" style={{ position: "relative" }}>
          <motion.div className="pill-note" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="flag">CN</span><span className="flag">DE</span><span className="flag">IT</span>
            For Pakistani students · built on official sources
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05, duration: 0.6 }}>
            Your raasta abroad,<br /><em>checked against the source.</em>
          </motion.h1>
          <motion.p className="hero-sub" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.6 }}>
            Find scholarships in China, Germany and Italy, see which rules you meet, plan the real cost, and run every application from one dashboard. You don't need a consultant for the routine work.
          </motion.p>
          <motion.form
            className="search"
            style={{ maxWidth: 620, margin: "0 auto" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.6 }}
            onSubmit={(e) => { e.preventDefault(); go(`/scholarships${q ? `?q=${encodeURIComponent(q)}` : ""}`); }}
          >
            <Search size={18} className="muted" />
            <input aria-label="Search scholarships" placeholder="Search CSC, DAAD, MAECI, a university…" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary">Search</button>
          </motion.form>
          <motion.div className="row" style={{ justifyContent: "center", marginTop: 18 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <Link to="/signup" className="btn btn-ghost">Check my eligibility <ArrowRight size={15} /></Link>
            {cov.data && <span className="subtle">{total} awards and {srcTotal} official sources catalogued so far. Coverage is still growing.</span>}
          </motion.div>
        </div>
      </section>

      <section className="section container">
        <Reveal><p className="eyebrow">Five questions</p><h2 style={{ maxWidth: 640, marginTop: 8 }}>The questions every student asks, answered with evidence.</h2></Reveal>
        <div className="grid grid-3" style={{ marginTop: 32 }}>
          {QUESTIONS.map((x, i) => (
            <Reveal key={x.t} delay={i * 0.06}>
              <div className="card card-hover stack" style={{ height: "100%" }}>
                <x.icon size={22} color="var(--brand-2)" />
                <h3>{x.t}</h3>
                <p className="muted">{x.d}</p>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.3}>
            <div className="card stack" style={{ height: "100%", background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }}>
              <Map size={22} color="var(--accent)" />
              <h3>After you arrive, too</h3>
              <p style={{ opacity: 0.85 }}>Already in China, Germany or Italy? Track renewals and annual reviews, and find continuing-student funding you're actually eligible for.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section container">
        <div className="grid grid-2" style={{ alignItems: "center", gap: 40 }}>
          <Reveal>
            <p className="eyebrow">How a rule looks in Raasta</p>
            <h2 style={{ marginTop: 8 }}>Not "fully funded!" Every condition, with its source.</h2>
            <p className="muted" style={{ marginTop: 14 }}>
              Raasta stores each requirement separately: the rule, a short quote from the official page, the link, and when it was checked. Missing information is shown as <strong>unknown</strong>, never quietly counted against you.
            </p>
            <div className="row" style={{ marginTop: 20 }}>
              <Link to="/how-it-works" className="btn btn-primary">How we verify</Link>
              <Link to="/scholarships" className="btn btn-ghost">Browse awards</Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="card stack" style={{ boxShadow: "var(--shadow-lg)" }}>
              <div className="row between"><strong>Example assessment</strong><span className="badge b-test">Illustration</span></div>
              {[
                ["Nationality: Pakistani", "MET", "Open to PK nationals."],
                ["Minimum CGPA 3.0 / 4", "MET", "You entered 3.2."],
                ["HSK 4 for Chinese-taught programmes", "UNKNOWN", "Add your HSK result to check."],
                ["Grade equivalence (percentage → 4.0)", "NEEDS_REVIEW", "Not converted by arithmetic. Institution must confirm."],
              ].map(([t, s, r]) => (
                <div key={t} className="row between" style={{ padding: "10px 0", borderTop: "1px solid var(--line)" }}>
                  <div><div style={{ fontWeight: 600 }}>{t}</div><div className="subtle">{r}</div></div>
                  <EligBadge status={s} />
                </div>
              ))}
              <div className="row" style={{ "--gap": "6px" } as any}><StatusBadge status="NEEDS_REVIEW" /><span className="subtle">Source retrieved · awaiting human verification</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section container">
        <Reveal><p className="eyebrow">Three journeys</p><h2 style={{ marginTop: 8 }}>Built for where you are now.</h2></Reveal>
        <div className="grid grid-3" style={{ marginTop: 28 }}>
          {[
            ["Applying from Pakistan", "Bachelor's, Master's or PhD. Equivalence, study gaps, language tests, costs and the right route: HEC nomination, direct, or university."],
            ["Studying in China", "Self-funded or on a partial award. University, municipal and provincial scholarships, annual reviews, renewals and transfers."],
            ["Studying in Germany or Italy", "Deutschlandstipendium, regional DSU support, university awards and doctoral funding for continuing students."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.08}>
              <div className="card stack" style={{ height: "100%" }}>
                <span className="badge b-neutral">Journey {"ABC"[i]}</span>
                <h3>{t}</h3>
                <p className="muted">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section container" style={{ maxWidth: 820 }}>
        <Reveal><h2 style={{ textAlign: "center", marginBottom: 24 }}>Questions</h2></Reveal>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}<Plus size={18} /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section container">
        <Reveal>
          <div className="card" style={{ background: "var(--ink)", color: "#fff", padding: "48px 32px", textAlign: "center", borderColor: "var(--ink)" }}>
            <ShieldCheck size={28} color="var(--accent)" style={{ margin: "0 auto 14px" }} />
            <h2>Start free. Pay only if it helps.</h2>
            <p style={{ opacity: 0.8, margin: "12px auto 22px", maxWidth: 520 }}>Search, official links and your eligibility preview are free. Basic scholarship facts and eligibility warnings stay free.</p>
            <Link to="/signup" className="btn" style={{ background: "var(--accent)", color: "var(--ink)" }}>Create free account <ArrowRight size={15} /></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
