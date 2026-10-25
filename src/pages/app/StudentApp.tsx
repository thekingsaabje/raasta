import { FileText, LayoutDashboard, ListChecks, Settings, Sparkles, UserRound } from "lucide-react";
import { Link, match, useRouter } from "../../lib/router";
import { Overview } from "./Overview";
import { ProfilePage } from "./Profile";
import { Matches } from "./Matches";
import { Applications, ApplicationDetail } from "./Applications";
import { WritingList, WritingEditor } from "./Writing";
import { SettingsPage } from "./Settings";

const NAV = [
  ["/app", "Overview", LayoutDashboard],
  ["/app/profile", "Profile", UserRound],
  ["/app/matches", "Matches", Sparkles],
  ["/app/applications", "Applications", ListChecks],
  ["/app/writing", "Writing Studio", FileText],
  ["/app/settings", "Settings", Settings],
] as const;

export function StudentApp() {
  const { path } = useRouter();
  let view;
  let m;
  if ((m = match("/app/applications/:id", path))) view = <ApplicationDetail id={m.id} />;
  else if ((m = match("/app/writing/:id", path))) view = <WritingEditor id={m.id} />;
  else if (path === "/app/profile") view = <ProfilePage />;
  else if (path === "/app/matches") view = <Matches />;
  else if (path === "/app/applications") view = <Applications />;
  else if (path === "/app/writing") view = <WritingList />;
  else if (path === "/app/settings") view = <SettingsPage />;
  else view = <Overview />;

  return (
    <main className="page container">
      <div className="side-layout">
        <nav className="side-nav" aria-label="Dashboard">
          {NAV.map(([to, label, Icon]) => (
            <Link key={to} to={to} aria-current={path === to || (to !== "/app" && path.startsWith(to)) ? "page" : undefined}>
              <Icon size={16} />{label}
            </Link>
          ))}
        </nav>
        <div key={path}>{view}</div>
      </div>
    </main>
  );
}
