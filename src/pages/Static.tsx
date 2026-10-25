import { Page } from "../components/Layout";
import { EligBadge, Reveal, StatusBadge } from "../components/ui";

export function HowItWorks() {
  return (
    <Page>
      <div style={{ maxWidth: 820 }} className="stack">
        <p className="eyebrow">How we verify</p>
        <h1 style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)" }}>Trust comes from evidence, not badges.</h1>
        <Reveal>
          <div className="card stack">
            <h3>1. Official sources first</h3>
            <p className="muted">We use the body that actually decides: the scholarship provider, the university or faculty, the ministry or embassy, HEC, CSC, DAAD or the regional DSU office. Forums, agents and social media only help us find leads. They are never evidence.</p>
            <h3>2. Each rule stored separately</h3>
            <p className="muted">Nationality, degree, grades, age, language, experience, existing-scholarship limits, coverage, route and deadline are each stored as their own rule, with a short quote, the source link and the retrieval date.</p>
            <h3>3. A person verifies before we call it confirmed</h3>
            <p className="muted">A page being online doesn't prove it's current. A record is only marked verified once the current call's window and main rules have been checked. If sources disagree (for example the Chinese and English versions), we keep both and mark the rule for review.</p>
            <h3>4. Monitoring and corrections</h3>
            <p className="muted">Official pages are re-checked on a schedule. When a page changes, it goes back into review. Every correction keeps the old version, and students who saved or track that award are notified.</p>
          </div>
        </Reveal>
        <Reveal>
          <div className="card stack">
            <h3>What the labels mean</h3>
            <div className="stack" style={{ "--gap": "10px" } as any}>
              {[
                ["VERIFIED_OPEN", "A person checked the current call; applications are open."],
                ["VERIFIED_UPCOMING", "Checked; the window opens later."],
                ["VERIFIED_CLOSED", "Checked; this cycle has closed."],
                ["NEEDS_REVIEW", "Source found, but the current call hasn't been confirmed yet."],
                ["CONFLICTING_SOURCES", "Official sources disagree; we're resolving it."],
              ].map(([s, d]) => <div key={s} className="row"><StatusBadge status={s} /><span className="muted">{d}</span></div>)}
              <div className="divider" />
              {[
                ["MET", "Your profile satisfies this published rule."],
                ["NOT_MET", "Your profile does not satisfy a verified rule."],
                ["UNKNOWN", "We need more information from you. Missing data never counts against you."],
                ["NEEDS_REVIEW", "Needs a human or the institution to decide, e.g. grade equivalence."],
              ].map(([s, d]) => <div key={s} className="row"><EligBadge status={s} /><span className="muted">{d}</span></div>)}
            </div>
          </div>
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
        <p className="eyebrow">Privacy notice (draft)</p>
        <h1 style={{ fontSize: "clamp(2rem,4.5vw,3rem)" }}>Your data, minimised.</h1>
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
