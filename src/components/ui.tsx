import { AnimatePresence, motion, type Variants } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, Clock, FlaskConical, HelpCircle, ShieldCheck, X, XCircle } from "lucide-react";

export function Reveal({ children, delay = 0, y = 18, className }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

export const stagger: { container: Variants; item: Variants } = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.05 } } },
  item: { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } } },
};

// "Verified" only ever means a Raasta reviewer confirmed the current call. Research evidence is shown as "Looks …".
const OPP: Record<string, { label: string; cls: string; icon: ReactNode; explain: string }> = {
  VERIFIED_OPEN: { label: "Open · confirmed", cls: "b-ok", icon: <ShieldCheck size={13} />, explain: "A Raasta reviewer checked the current official call: applications are open." },
  VERIFIED_UPCOMING: { label: "Upcoming · confirmed", cls: "b-info", icon: <ShieldCheck size={13} />, explain: "A reviewer checked the current call: it opens later." },
  VERIFIED_CLOSED: { label: "Closed · confirmed", cls: "b-neutral", icon: <ShieldCheck size={13} />, explain: "A reviewer checked: this round has closed. Watch for the next call." },
  CANCELLED: { label: "Cancelled", cls: "b-bad", icon: <XCircle size={13} />, explain: "The provider has cancelled this call." },
  NEEDS_REVIEW: { label: "Needs verification", cls: "b-warn", icon: <Clock size={13} />, explain: "Not yet confirmed by a reviewer. Treat it as a lead and check the official page." },
  CONFLICTING_SOURCES: { label: "Conflicting information", cls: "b-bad", icon: <AlertTriangle size={13} />, explain: "Official sources disagree; we keep both until a reviewer resolves it." },
  UNKNOWN: { label: "Status unknown", cls: "b-neutral", icon: <CircleHelp size={13} />, explain: "We don't know the current status." },
};
const LOOKS: Record<string, { label: string; cls: string }> = {
  open: { label: "Looks open · not yet verified", cls: "b-warn" },
  upcoming: { label: "Looks upcoming · not yet verified", cls: "b-warn" },
  closed: { label: "Looks closed · not yet verified", cls: "b-neutral" },
};
export const statusExplain = (status: string) => (OPP[status] ?? OPP.UNKNOWN).explain;

export function StatusBadge({ status, cycle, reason }: { status: string; method?: string | null; cycle?: string | null; reason?: string | null }) {
  const s = OPP[status] ?? OPP.UNKNOWN;
  const looks = status === "NEEDS_REVIEW" && cycle ? LOOKS[cycle] : undefined;
  return (
    <span className={`badge ${looks?.cls ?? s.cls}`} title={reason ?? s.explain}>
      {s.icon}{looks?.label ?? s.label}
    </span>
  );
}

const ELIG: Record<string, { label: string; cls: string; icon: ReactNode }> = {
  MET: { label: "Met", cls: "b-ok", icon: <CheckCircle2 size={13} /> },
  NOT_MET: { label: "Not met", cls: "b-bad", icon: <XCircle size={13} /> },
  UNKNOWN: { label: "Unknown", cls: "b-neutral", icon: <HelpCircle size={13} /> },
  NEEDS_REVIEW: { label: "Needs review", cls: "b-warn", icon: <AlertTriangle size={13} /> },
};
export function EligBadge({ status, prefix }: { status: string; prefix?: string }) {
  const s = ELIG[status] ?? ELIG.UNKNOWN;
  return <span className={`badge ${s.cls}`}>{s.icon}{prefix ? `${prefix}: ` : ""}{s.label}</span>;
}

export const TestBadge = () => <span className="badge b-test" title="Clearly labelled sample data for testing"><FlaskConical size={13} />Test data</span>;

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

export function Ring({ value, size = 110 }: { value: number; size?: number }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ece9e1" strokeWidth={10} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="var(--brand-2)" strokeWidth={10} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }} className="ring-label">{value}%</div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? "modal-wide" : ""}`} initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.25 }} onClick={(e) => e.stopPropagation()}>
            <div className="row between" style={{ marginBottom: 14 }}>
              <h3>{title}</h3>
              <button className="btn btn-soft icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Skeleton = ({ h = 18, w = "100%" }: { h?: number; w?: number | string }) => <div className="skel" style={{ height: h, width: w }} />;
export function CardSkeletons({ n = 6 }: { n?: number }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="card stack"><Skeleton w="40%" /><Skeleton h={26} /><Skeleton /><Skeleton w="70%" /></div>
      ))}
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty stack" style={{ alignItems: "center" }}>
      {icon}
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div className="toast" role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "bad" | "ok"; children: ReactNode }) {
  const Icon = kind === "info" ? HelpCircle : kind === "ok" ? CheckCircle2 : AlertTriangle;
  return <div className={`notice notice-${kind}`}><Icon size={17} style={{ flexShrink: 0, marginTop: 2 }} /><div>{children}</div></div>;
}
