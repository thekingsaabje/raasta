import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0E3B2E" />
      <path d="M9 24c4-1 6-4 8-8s3.5-6.5 7-8" stroke="#E2A13A" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="8" r="2.4" fill="#E2A13A" />
    </svg>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const { go, path } = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="nav-wrap">
      <nav className="container nav" aria-label="Main" style={{ position: "relative" }}>
        <Link to="/" className="brand"><Logo />Raasta</Link>
        <div className={`nav-links ${open ? "open" : ""}`}>
          <Link to="/scholarships">Scholarships</Link>
          <Link to="/costs">Cost planner</Link>
          <Link to="/how-it-works">How we verify</Link>
          <Link to="/pricing">Pricing</Link>
          {user?.role === "admin" && <Link to="/admin">Admin</Link>}
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <Link to="/app" className="btn btn-primary btn-sm">Dashboard</Link>
              <button className="btn btn-ghost btn-sm icon-btn" aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); go("/"); }}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Start free</Link>
            </>
          )}
          <button className="btn btn-ghost btn-sm icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={16} /> : <Menu size={16} />}</button>
        </div>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="container grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))", gap: 32 }}>
        <div className="stack" style={{ "--gap": "12px", gridColumn: "span 2" } as any}>
          <div className="brand"><Logo />Raasta</div>
          <p className="subtle" style={{ maxWidth: 380 }}>Source-backed study-abroad guidance for Pakistani students. Raasta is not a university, embassy or scholarship provider, and cannot guarantee admission, scholarships or visas.</p>
        </div>
        <div className="stack" style={{ "--gap": "8px" } as any}>
          <span className="label">Product</span>
          <Link to="/scholarships">Scholarships</Link><Link to="/costs">Cost planner</Link><Link to="/pricing">Pricing</Link>
        </div>
        <div className="stack" style={{ "--gap": "8px" } as any}>
          <span className="label">Trust</span>
          <Link to="/how-it-works">How we verify</Link><Link to="/privacy">Privacy</Link>
        </div>
        <div className="stack" style={{ "--gap": "8px" } as any}>
          <span className="label">Countries</span>
          <Link to="/scholarships?country=CN">China</Link><Link to="/scholarships?country=DE">Germany</Link><Link to="/scholarships?country=IT">Italy</Link>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page container">{children}</main>;
}
