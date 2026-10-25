import { useState } from "react";
import { motion } from "motion/react";
import { Page } from "../components/Layout";
import { Notice } from "../components/ui";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Link, useRouter } from "../lib/router";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { refresh } = useAuth();
  const { go } = useRouter();
  const [f, setF] = useState({ name: "", email: "", password: "", consent: false });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (signup) await api.post("/auth/register", f);
      else await api.post("/auth/login", { email: f.email, password: f.password });
      await refresh();
      go(signup ? "/app/profile" : "/app");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <motion.div className="card" style={{ maxWidth: 440, margin: "20px auto", padding: 28 }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h2>{signup ? "Create your free account" : "Welcome back"}</h2>
        <p className="muted" style={{ margin: "6px 0 20px" }}>{signup ? "Your profile and dashboard are private to you." : "Log in to your dashboard."}</p>
        <form className="stack" onSubmit={submit}>
          {signup && (
            <div className="field"><label htmlFor="name">Name</label><input id="name" className="input" required maxLength={100} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" /></div>
          )}
          <div className="field"><label htmlFor="email">Email</label><input id="email" type="email" className="input" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" /></div>
          <div className="field">
            <label htmlFor="pw">Password</label>
            <input id="pw" type="password" className="input" required minLength={signup ? 10 : 1} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={signup ? "new-password" : "current-password"} />
            {signup && <span className="help">At least 10 characters.</span>}
          </div>
          {signup && (
            <label className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap", fontSize: 14 } as any}>
              <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} style={{ marginTop: 4 }} />
              <span>I agree to Raasta storing my profile to give me guidance, as described in the <Link to="/privacy">privacy notice</Link>. I can export or delete my data at any time.</span>
            </label>
          )}
          {err && <Notice kind="bad">{err}</Notice>}
          <button className="btn btn-primary" disabled={busy || (signup && !f.consent)}>{busy ? "Please wait…" : signup ? "Create account" : "Log in"}</button>
          <p className="subtle" style={{ textAlign: "center" }}>
            {signup ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New here? <Link to="/signup">Create an account</Link></>}
          </p>
        </form>
      </motion.div>
    </Page>
  );
}
