import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { match, useRouter } from "./lib/router";
import { useAuth } from "./lib/auth";
import { Footer, Nav, Page } from "./components/Layout";
import { Home } from "./pages/Home";
import { Catalogue } from "./pages/Catalogue";
import { ScholarshipDetail } from "./pages/ScholarshipDetail";
import { Pricing } from "./pages/Pricing";
import { AuthPage } from "./pages/Auth";
import { Costs } from "./pages/Costs";
import { HowItWorks, Privacy } from "./pages/Static";
import { StudentApp } from "./pages/app/StudentApp";
import { Admin } from "./pages/Admin";
import { Empty, Skeleton } from "./components/ui";
import { Link } from "./lib/router";

function Guard({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <Page><Skeleton h={300} /></Page>;
  if (!user)
    return (
      <Page>
        <Empty title="Please sign in">
          <p className="muted">Your dashboard is private to your account.</p>
          <Link to="/login" className="btn btn-primary">Log in</Link>
        </Empty>
      </Page>
    );
  if (admin && user.role !== "admin") return <Page><Empty title="Admins only" /></Page>;
  return <>{children}</>;
}

const routes: [string, (p: Record<string, string>) => ReactNode][] = [
  ["/", () => <Home />],
  ["/scholarships", () => <Catalogue />],
  ["/scholarships/:id", (p) => <ScholarshipDetail id={p.id} />],
  ["/pricing", () => <Pricing />],
  ["/costs", () => <Costs />],
  ["/how-it-works", () => <HowItWorks />],
  ["/privacy", () => <Privacy />],
  ["/login", () => <AuthPage mode="login" />],
  ["/signup", () => <AuthPage mode="signup" />],
  ["/admin", () => <Guard admin><Admin /></Guard>],
];

export function App() {
  const { path } = useRouter();
  let content: ReactNode = null;
  if (path === "/app" || path.startsWith("/app/")) content = <Guard><StudentApp /></Guard>;
  else
    for (const [pattern, render] of routes) {
      const m = match(pattern, path);
      if (m) {
        content = render(m);
        break;
      }
    }
  content ??= (
    <Page>
      <Empty title="Page not found"><Link to="/" className="btn btn-primary">Go home</Link></Empty>
    </Page>
  );
  const key = path.startsWith("/app") ? "/app" : path;
  return (
    <>
      <a href="#main" className="sr-skip" style={{ position: "absolute", left: -9999 }}>Skip to content</a>
      <Nav />
      <AnimatePresence mode="wait">
        <motion.div key={key} id="main" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {content}
        </motion.div>
      </AnimatePresence>
      <Footer />
    </>
  );
}
