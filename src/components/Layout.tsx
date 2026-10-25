import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Link, useRouter } from "../lib/router";
import { useAuth } from "../lib/auth";

export function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#12372A" />
      <path d="M8 24c4-1 6-4 8-8s4-7 8-8" stroke="#F4C46B" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="24" cy="8" r="2.5" fill="#F4C46B" />
    </svg>
  );
}

export function Nav() {
  const { user, logout } = useAuth();
  const { go } = useRouter();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="nav-wrap">
      <nav className="container nav" aria-label="Main">
        <Link to="/" className="brand"><Logo />Raasta</Link>
        <div className={`nav-links ${open ? "open" : ""}`}>
          <Link to="/scholarships" onClick={close}>Scholarships</Link>
          <Link to="/costs" onClick={close}>Cost planner</Link>
          <Link to="/how-it-works" onClick={close}>How we verify</Link>
          <Link to="/pricing" onClick={close}>Pricing</Link>
          {user && <Link to="/app" onClick={close}>Dashboard</Link>}
          {user?.role === "admin" && <Link to="/admin" onClick={close}>Admin</Link>}
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <Link to="/app" className="btn btn-primary btn-sm">My dashboard</Link>
              <button className="btn btn-ghost btn-sm icon-btn" aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); go("/"); }}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Start free</Link>
            </>
          )}
          <button className="btn btn-ghost icon-btn menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={16} /> : <Menu size={16} />}</button>
        </div>
      </nav>
    </div>
  );
}

export function Footer() {
  return (
    <footer>
      <div className="container grid grid-4">
        <div className="stack" style={{ "--gap": "8px" } as any}>
          <div className="brand"><Logo />Raasta</div>
          <p className="subtle">Source-backed study-abroad guidance for Pakistani students. Raasta is not a university, embassy or scholarship provider, and cannot guarantee admission, scholarships or visas.</p>
        </div>
        <div className="stack" style={{ "--gap": "6px" } as any}>
          <strong>Product</strong>
          <Link to="/scholarships">Scholarships</Link>
          <Link to="/costs">Cost planner</Link>
          <Link to="/pricing">Pricing</Link>
        </div>
        <div className="stack" style={{ "--gap": "6px" } as any}>
          <strong>Trust</strong>
          <Link to="/how-it-works">How we verify</Link>
          <Link to="/privacy">Privacy</Link>
        </div>
        <div className="stack" style={{ "--gap": "6px" } as any}>
          <strong>Countries</strong>
          <Link to="/scholarships?country=CN">China</Link>
          <Link to="/scholarships?country=DE">Germany</Link>
          <Link to="/scholarships?country=IT">Italy</Link>
        </div>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page container">{children}</main>;
}
