import { FileCheck2 } from "lucide-react";
import { Page } from "../components/Layout";
import { EligBadge, Reveal, StatusBadge } from "../components/ui";

export function HowItWorks() {
  return (
    <Page>
      <div className="narrow stack" style={{ "--gap": "20px", width: "100%", maxWidth: 820, marginInline: 0 } as any}>
        <h1 className="display" style={{ fontSize: "clamp(2.2rem,4.6vw,3.4rem)" }}>Trust comes from evidence, not badges.</h1>
        <div className="steps" style={{ marginTop: 10 }}>
          {[
            ["Official sources first", "The body that decides: provider, university, ministry, embassy, HEC, CSC, DAAD or the regional DSU office. Forums and agents are leads, never evidence."],
            ["One rule at a time", "Nationality, degree, grades, age, language, existing-scholarship limits, coverage, route and deadline: each stored separately with a verbatim quote, link and date."],
            ["Only people confirm", "Research collects word-for-word quotes from official pages, and a free checker re-reads those pages to make sure the quotes are still there. Only a Raasta reviewer can mark a record “confirmed”."],
            ["Monitoring and corrections", "Official pages are re-checked several times a day. A change opens a review task; a failed fetch never changes a status. Corrections keep history and notify students."],
          ].map(([t, d]) => <div key={t} style={{ paddingRight: 20 }}><h3 style={{ marginBottom: 8 }}>{t}</h3><p className="muted" style={{ fontSize: 15 }}>{d}</p></div>)}
        </div>
        <Reveal>
          <section className="panel">
            <h2 style={{ fontSize: 24, marginBottom: 12 }}>What the labels mean</h2>
            {[
              ["VERIFIED_OPEN", "", "A Raasta reviewer checked the current official call: applications are open."],
              ["VERIFIED_UPCOMING", "", "A reviewer checked: the application window opens later."],
              ["VERIFIED_CLOSED", "", "A reviewer checked: this round has closed. Watch for the next call."],
              ["NEEDS_REVIEW", "open", "The official page shows the call as open (we quote it), but a reviewer hasn't signed it off. Check the page before you apply."],
              ["NEEDS_REVIEW", "closed", "The official page shows this round as closed, or its deadline has passed."],
              ["NEEDS_REVIEW", "", "We haven't found the current call on the official page yet. Check the official page."],
              ["CONFLICTING_SOURCES", "", "Official sources disagree; both are kept until a reviewer resolves it."],
            ].map(([s, cy, d]) => <div key={s + cy} className="legend-row" style={{ borderTop: "1px solid var(--line)" }}><StatusBadge status={s} cycle={cy || null} /><span className="muted" style={{ fontSize: 15 }}>{d}</span></div>)}
            <div className="legend-row" style={{ borderTop: "1px solid var(--line)" }}><span className="badge b-neutral"><FileCheck2 size={13} />Quotes re-checked</span><span className="muted" style={{ fontSize: 15 }}>Our automatic checker re-read the official page recently and found every quoted sentence still there. It does not confirm that a call is open.</span></div>
            <div style={{ height: 18 }} />
            {[
              ["MET", "Your profile satisfies this published rule."],
              ["NOT_MET", "Your profile doesn't satisfy a verified rule."],
              ["UNKNOWN", "We need more information. Missing data never counts against you."],
              ["NEEDS_REVIEW", "A human or the institution must decide, e.g. grade equivalence."],
            ].map(([s, d]) => <div key={s} className="legend-row" style={{ borderTop: "1px solid var(--line)" }}><EligBadge status={s} /><span className="muted" style={{ fontSize: 15 }}>{d}</span></div>)}
          </section>
        </Reveal>
        <Reveal>
          <div className="card stack">
            <h3>What we never do</h3>
            <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Promise admission, scholarships or visas, or show a "chance of winning".</li>
              <li>Convert grading systems by simple arithmetic.</li>
              <li>Invent achievements or experiences in your writing.</li>
              <li>Ask for university portal passwords or full bank statements.</li>
              <li>Advise hiding the source of money or misrepresenting a sponsor.</li>
              <li>Show fake counts, reviews or testimonials.</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </Page>
  );
}

export function Privacy() {
  return (
    <Page>
      <div style={{ maxWidth: 760 }} className="stack">
        <span className="badge b-warn" style={{ alignSelf: "flex-start" }}>Draft notice</span>
        <h1>Your data, minimised.</h1>
        <div className="card stack muted">
          <p><strong>What we collect:</strong> your name, email and the profile answers you choose to give (education, grades, tests, goals, budget figures). We only ask for what an eligibility rule actually needs. Every profile field is optional.</p>
          <p><strong>What we don't collect:</strong> passwords for university portals, bank statements, passport scans or other sensitive uploads.</p>
          <p><strong>How it's used:</strong> to check rules, build your checklist and send reminders you've turned on. Your data is not sold. Student data is not sent to AI providers.</p>
          <p><strong>Your controls:</strong> export everything as JSON or delete your account at any time from Settings. Deletion removes your profile, applications, tasks, facts and documents.</p>
          <p><strong>Where it's stored:</strong> Cloudflare D1 (SQLite) databases. Passwords are stored only as salted PBKDF2 hashes.</p>
          <p className="subtle">This is a draft. Before processing real student records at scale, it will be reviewed against Pakistan's data-protection rules, the EU GDPR and China's PIPL.</p>
        </div>
      </div>
    </Page>
  );
}
