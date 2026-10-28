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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 12);
    on();
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  const links: [string, string][] = [
    ["/scholarships", "Scholarships"],
    ["/route", "Find my route"],
    ["/costs", "Cost planner"],
    ["/app/discover", "Discover"],
    ["/how-it-works", "How we verify"],
  ];
  return (
    <div className="nav-wrap">
      <nav className={`pill-nav ${scrolled ? "is-scrolled" : ""}`} aria-label="Main">
        <Link to="/" className="brand"><Logo size={24} />Raasta</Link>
        <div className={`nav-links ${open ? "open" : ""}`}>
          {links.map(([to, label]) => <Link key={to} to={to} aria-current={path === to ? "page" : undefined}>{label}</Link>)}
          {user?.role === "admin" && <Link to="/admin" aria-current={path === "/admin" ? "page" : undefined}>Admin</Link>}
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <Link to="/app" className="btn btn-primary btn-sm btn-pill">Dashboard</Link>
              <button className="btn btn-ghost btn-sm icon-btn btn-pill" aria-label="Sign out" title="Sign out" onClick={async () => { await logout(); go("/"); }}><LogOut size={15} /></button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm btn-pill hide-sm">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm btn-pill">Sign up</Link>
            </>
          )}
          <button className="btn btn-ghost btn-sm icon-btn btn-pill menu-btn" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={16} /> : <Menu size={16} />}</button>
        </div>
      </nav>
    </div>
  );
}

const FOOT: [string, [string, string][]][] = [
  ["Product", [["/scholarships", "Scholarships"], ["/route", "Find my route"], ["/costs", "Cost planner"], ["/app/discover", "Discover"], ["/pricing", "Pricing"]]],
  ["Trust", [["/how-it-works", "How we verify"], ["/privacy", "Privacy"]]],
  ["Countries", [["/scholarships?country=CN", "China"], ["/scholarships?country=DE", "Germany"], ["/scholarships?country=IT", "Italy"]]],
];

export function Footer() {
  return (
    <footer className="site-foot">
      <div className="container foot-grid">
        <div className="stack" style={{ "--gap": "14px" } as any}>
          <div className="brand"><Logo />Raasta</div>
          <p style={{ maxWidth: 360 }}>Source-backed study-abroad guidance for Pakistani students. Raasta is not a university, embassy or scholarship provider, and cannot guarantee admission, scholarships or visas.</p>
        </div>
        {FOOT.map(([title, items]) => (
          <div key={title} className="stack" style={{ "--gap": "9px" } as any}>
            <span className="foot-label">{title}</span>
            {items.map(([to, label]) => <Link key={to} to={to}>{label}</Link>)}
          </div>
        ))}
        <div className="stack foot-cta" style={{ "--gap": "12px" } as any}>
          <span className="foot-label">Start your route</span>
          <p>A few questions, then routes with the official evidence behind them. Free.</p>
          <Link to="/route" className="btn btn-sm btn-pill btn-light">Find my route</Link>
        </div>
      </div>
      <div className="container foot-bottom">
        <span>© {new Date().getFullYear()} Raasta</span>
        <span>Every fact links to its official source.</span>
      </div>
    </footer>
  );
}

export function Page({ children }: { children: ReactNode }) {
  return <main className="page container">{children}</main>;
}
