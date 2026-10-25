import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { Notice, Skeleton, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { useApi } from "../../lib/use";
import { useAuth } from "../../lib/auth";
import { useRouter } from "../../lib/router";

export function SettingsPage() {
  const { data, loading } = useApi<any>("/me/notification-prefs");
  const [p, setP] = useState<any>(null);
  const toast = useToast();
  const { refresh } = useAuth();
  const { go } = useRouter();
  useEffect(() => {
    if (data?.prefs) setP({ ...data.prefs });
  }, [data]);
  if (loading || !p) return <Skeleton h={300} />;

  const save = async () => {
    await api.put("/me/notification-prefs", {
      deadlines: !!p.deadlines, documents: !!p.documents, opportunities: !!p.opportunities, renewals: !!p.renewals, paused: !!p.paused, max_per_week: Number(p.max_per_week),
    });
    toast("Notification settings saved");
  };
  const exportData = async () => {
    const d = await api.get("/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "raasta-my-data.json" });
    a.click();
    URL.revokeObjectURL(url);
  };
  const del = async () => {
    if (prompt('Type DELETE to permanently delete your account and data') !== "DELETE") return;
    await api.del("/me/account");
    await refresh();
    go("/");
  };

  return (
    <div className="stack" style={{ "--gap": "18px" } as any}>
      <div><h1>Settings</h1><p className="muted" style={{ marginTop: 8 }}>Notifications and your data.</p></div>
      <div className="card stack">
        <h3>In-app reminders</h3>
        {[["deadlines", "Deadline and rule changes"], ["documents", "Missing documents"], ["opportunities", "Verified new opportunities"], ["renewals", "Scholarship reviews and renewals"], ["paused", "Pause all reminders"]].map(([k, l]) => (
          <label key={k} className="row"><input type="checkbox" checked={!!p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} />{l}</label>
        ))}
        <label className="field" style={{ width: 220 }}><span className="subtle">Maximum per week</span><input className="input" type="number" min={0} max={14} value={p.max_per_week} onChange={(e) => setP({ ...p, max_per_week: e.target.value })} /></label>
        <p className="help">Corrections to a published error on an award you track are always shown. Email delivery isn't switched on yet.</p>
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={save}>Save</button>
      </div>
      <div className="card stack">
        <h3>Your data</h3>
        <button className="btn btn-ghost" style={{ alignSelf: "flex-start" }} onClick={exportData}><Download size={15} />Export my data (JSON)</button>
        <Notice kind="bad">Deleting your account removes your profile, applications, tasks, facts and documents. This can't be undone.</Notice>
        <button className="btn btn-danger" style={{ alignSelf: "flex-start" }} onClick={del}><Trash2 size={15} />Delete my account</button>
      </div>
    </div>
  );
}
