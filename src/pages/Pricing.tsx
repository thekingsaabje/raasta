import { Check, Minus } from "lucide-react";
import { motion } from "motion/react";
import { Page } from "../components/Layout";
import { CardSkeletons, Notice, Reveal, stagger } from "../components/ui";
import { useApi } from "../lib/use";
import { Link } from "../lib/router";

export function Pricing() {
  const { data, loading } = useApi<{ packages: any[]; paymentsEnabled: boolean }>("/packages");
  return (
    <Page>
      <Reveal>
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 28px" }}>
          <p className="eyebrow">Pricing</p>
          <h1 style={{ fontSize: "clamp(2rem,4.5vw,3.2rem)", marginTop: 6 }}>Pay for depth, not for basic facts.</h1>
          <p className="muted" style={{ marginTop: 12 }}>Scholarship facts, official links and essential eligibility warnings are always free.</p>
        </div>
      </Reveal>
      {data && !data.paymentsEnabled && (
        <div style={{ maxWidth: 760, margin: "0 auto 24px" }}>
          <Notice kind="warn">
            <strong>Paid plans are not on sale yet.</strong> These are proposed prices, shown so you know what to expect. Payments will open only when each plan's features are complete and tested. Until then, every working feature is free to use.
          </Notice>
        </div>
      )}
      {loading ? (
        <CardSkeletons n={5} />
      ) : (
        <motion.div className="grid grid-3" variants={stagger.container} initial="hidden" animate="show">
          {data?.packages.map((p) => (
            <motion.div key={p.id} variants={stagger.item} className="card card-hover stack" style={{ "--gap": "14px" } as any}>
              <h3>{p.name}</h3>
              <div>
                <span className="stat">{p.price_pkr === 0 ? "Free" : `PKR ${p.price_pkr.toLocaleString("en-PK")}`}</span>
                {p.period === "semester" && <span className="subtle"> / semester</span>}
                {p.price_pkr > 0 && <div className="subtle">Proposed price</div>}
              </div>
              <p className="muted">{p.summary}</p>
              <div className="divider" />
              <div className="stack" style={{ "--gap": "8px" } as any}>
                {p.features.map((f: string) => <span key={f} className="row" style={{ "--gap": "8px", flexWrap: "nowrap", alignItems: "flex-start" } as any}><Check size={16} color="var(--ok)" style={{ flexShrink: 0, marginTop: 3 }} />{f}</span>)}
                {p.exclusions.map((f: string) => <span key={f} className="row subtle" style={{ "--gap": "8px", flexWrap: "nowrap", alignItems: "flex-start" } as any}><Minus size={16} style={{ flexShrink: 0, marginTop: 3 }} />{f}</span>)}
              </div>
              <div style={{ marginTop: "auto" }}>
                {p.price_pkr === 0 ? <Link to="/signup" className="btn btn-primary" style={{ width: "100%" }}>Start free</Link> : <button className="btn btn-ghost" style={{ width: "100%" }} disabled>Not yet available</button>}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      <p className="subtle" style={{ textAlign: "center", marginTop: 28, maxWidth: 680, marginInline: "auto" }}>
        No plan can guarantee admission, a scholarship or a visa. Human review and managed applications are not offered yet. They'll be listed separately only when qualified staff are available and the provider allows that kind of help.
      </p>
    </Page>
  );
}
