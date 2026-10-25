import { useState } from "react";
import { Page } from "../components/Layout";
import { Notice } from "../components/ui";
import { api } from "../lib/api";
import { Link, useRouter } from "../lib/router";

/** Completes an admin-issued, single-use reset link. */
export function ResetPage() {
  const { search } = useRouter();
  const token = search.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/reset", { token, password: pw });
      setDone(true);
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <Page>
      <div className="panel" style={{ maxWidth: 440, margin: "24px auto", padding: 32 }}>
        <h2>Set a new password</h2>
        {done ? (
          <div className="stack" style={{ marginTop: 16 }}><Notice kind="ok">Password changed. You've been signed out everywhere.</Notice><Link to="/login" className="btn btn-primary">Log in</Link></div>
        ) : (
          <form className="stack" style={{ marginTop: 16 }} onSubmit={submit}>
            {!/^[0-9a-f]{64}$/.test(token) && <Notice kind="bad">This link is incomplete. Ask an admin for a new reset link.</Notice>}
            <label className="field"><span>New password</span><input className="input" type="password" minLength={10} required value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></label>
            <span className="help">At least 10 characters. Links work once and expire after 24 hours.</span>
            {err && <Notice kind="bad">{err}</Notice>}
            <button className="btn btn-primary" disabled={pw.length < 10}>Change password</button>
          </form>
        )}
      </div>
    </Page>
  );
}
