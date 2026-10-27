import { motion } from "motion/react";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";
import { Link } from "../lib/router";
import { useApi } from "../lib/use";
import { EligBadge, Reveal, StatusBadge } from "../components/ui";
import { CatalogueTable } from "./Catalogue";

const FAQ = [
  ["Is Raasta a consultancy or an agent?", "No. Raasta is a self-service tool. You apply through official systems yourself, and we never ask for university portal passwords."],
  ["How do you know a scholarship is real and current?", "Every record links to its official source and shows when it was retrieved and checked. Research tools collect quotes from official pages, but a record only shows as confirmed after a Raasta reviewer has checked the current call. Until then it is labelled “not yet verified” and treated as a preliminary lead."],
  ["Will Raasta tell me my chances?", "No. We show which published rules you meet. Selection is competitive and decided by the provider, so we never show a probability of success."],
  ["Will Raasta write my SOP?", "Only where the provider allows drafting help. Otherwise the Writing Studio limits itself to editing or coaching, and it never invents achievements."],
  ["What if something is wrong?", "Every scholarship page has a 'Report an error' button. Reports go to a review queue, corrections keep their history, and students tracking that award are notified."],
  ["I'm already studying in China. Is this for me?", "Yes. Tell us your university, year and current scholarship. Continuing-student awards and renewals are kept separate from awards for new applicants."],
];

const STEPS = [
  ["Build your profile", "Grades exactly as on your transcript, study gaps, tests, goals. Skip anything; missing data shows as unknown, never as a failure."],
  ["See rule-by-rule eligibility", "Each condition is met, not met, unknown or needs review, with the official quote and a next step."],
  ["Plan the real cost", "Tuition, living, visa, travel and deposits, minus only what an award documents it pays."],
  ["Run your applications", "Checklists per application, dependencies, confirmed deadlines and a Writing Studio that follows each provider's rules."],
];

export function Home() {
  const cov = useApi<any>("/coverage");
  const total = (cov.data?.scholarships ?? []).reduce((a: number, r: any) => a + r.n, 0);
  const srcTotal = (cov.data?.sources ?? []).reduce((a: number, r: any) => a + r.n, 0);
  const fade = (d: number) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: d, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <>
      <section className="hero container">
        <motion.div className="kicker" {...fade(0)}>
          <span className="flags"><span className="flag flag-CN">CN</span><span className="flag flag-DE">DE</span><span className="flag flag-IT">IT</span></span>
          For Pakistani students · built on official sources
        </motion.div>
        <motion.h1 className="display" {...fade(0.05)}>
          Scholarships abroad,<br />checked against the source.
        </motion.h1>
        <motion.p className="lead" {...fade(0.12)}>
          Find funding in China, Germany and Italy, see exactly which rules you meet, plan the real cost and manage every application. You don't need a consultant for the routine work.
        </motion.p>
        <motion.div className="hero-actions" {...fade(0.2)}>
          <Link to="/route" className="btn btn-primary btn-lg">Find my study route <ArrowRight size={16} /></Link>
          <Link to="/scholarships" className="btn btn-ghost btn-lg">Browse scholarships</Link>
        </motion.div>
        {cov.data && (
          <motion.p className="subtle" style={{ marginTop: 18 }} {...fade(0.28)}>
            <span className="num">{total}</span> awards from <span className="num">{srcTotal}</span> official sources catalogued so far. Coverage is still growing.
          </motion.p>
        )}
      </section>

      <section className="section container" style={{ paddingTop: 40 }}>
        <Reveal>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h2 style={{ maxWidth: 560 }}>From "which scholarship?" to a submitted application.</h2>
            <Link to="/route" className="btn btn-primary">Start with a few questions <ArrowRight size={15} /></Link>
          </div>
        </Reveal>
        <div className="steps">
          {STEPS.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.07}>
              <div style={{ paddingRight: 24 }}><h3 style={{ marginBottom: 8 }}>{t}</h3><p className="muted" style={{ fontSize: 15 }}>{d}</p></div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Manual browsing stays available, below the guided route. */}
      <section className="container">
        <Reveal><div className="page-head" style={{ marginBottom: 14 }}><h2 style={{ fontSize: 24 }}>Prefer to browse yourself?</h2></div></Reveal>
        <CatalogueTable limit={8} />
      </section>

      <section className="container">
        <div className="grid grid-2" style={{ alignItems: "center", gap: 48 }}>
          <Reveal>
            <h2>Not "fully funded!" Every condition, with its source.</h2>
            <p className="lead" style={{ marginTop: 14 }}>
              Raasta stores each requirement on its own: the rule, a verbatim quote from the official page, the link and the date it was checked. Missing information is shown as unknown, never counted against you.
            </p>
            <div className="row" style={{ marginTop: 24 }}>
              <Link to="/scholarships" className="btn btn-primary">Browse awards</Link>
              <Link to="/how-it-works" className="btn btn-ghost">Read our source policy</Link>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="panel panel-flush" style={{ boxShadow: "var(--shadow-float)" }}>
              <div className="panel-head"><strong>Example assessment</strong><span className="badge b-test">Illustration</span></div>
              {[
                ["Pakistani nationals eligible", "MET", "Open to PK nationals."],
                ["Minimum CGPA 3.0 / 4.0", "MET", "You entered 3.2."],
                ["HSK 4 for Chinese-taught programmes", "UNKNOWN", "Add your HSK result to check."],
                ["Percentage → 4.0 equivalence", "NEEDS_REVIEW", "Not converted by arithmetic. Ask the university."],
              ].map(([t, s, r]) => (
                <div key={t} className="row between" style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", flexWrap: "nowrap" } as any}>
                  <div><div style={{ fontWeight: 600, fontSize: 14.5 }}>{t}</div><div className="tiny">{r}</div></div>
                  <EligBadge status={s} />
                </div>
              ))}
              <div className="row" style={{ padding: "14px 20px", "--gap": "8px" } as any}><StatusBadge status="NEEDS_REVIEW" /><span className="tiny">Source retrieved · awaiting verification</span></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section container">
        <Reveal><h2 style={{ marginBottom: 24 }}>Built for where you are now.</h2></Reveal>
        <div className="grid grid-3">
          {[
            ["Applying from Pakistan", "Bachelor's, Master's or PhD: CSC via HEC or the university route, DAAD, MAECI, university and regional awards."],
            ["Already studying in China", "Self-funded or on a partial award: university, provincial and municipal scholarships, annual reviews and renewals."],
            ["Studying in Germany or Italy", "Deutschlandstipendium, regional DSU support, university awards and doctoral funding for continuing students."],
          ].map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.07}>
              <div className="panel card-hover" style={{ height: "100%" }}>
                <div className="label" style={{ marginBottom: 14 }}>Journey {"ABC"[i]}</div>
                <h3 style={{ fontSize: 19, marginBottom: 8, fontFamily: "var(--serif)" }}>{t}</h3>
                <p className="muted" style={{ fontSize: 15 }}>{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="narrow">
        <Reveal><h2 style={{ marginBottom: 8 }}>Questions</h2></Reveal>
        <div className="faq">
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}<Plus size={18} /></summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="section container">
        <Reveal>
          <div className="panel dark" style={{ padding: "56px 32px", textAlign: "center" }}>
            <ShieldCheck size={26} color="var(--accent)" style={{ margin: "0 auto 16px" }} />
            <h2 style={{ color: "#fff" }}>Start free. Pay only for depth.</h2>
            <p className="muted" style={{ margin: "12px auto 26px", maxWidth: 520 }}>Search, official links and your eligibility preview are free. Basic scholarship facts and eligibility warnings always will be.</p>
            <Link to="/route" className="btn btn-lg" style={{ background: "var(--accent)", color: "var(--ink)" }}>Find my study route <ArrowRight size={16} /></Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
