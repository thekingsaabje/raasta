// A small history-based router: enough for this app without another dependency.
import { createContext, useCallback, useContext, useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from "react";

const Ctx = createContext<{ path: string; search: URLSearchParams; go: (to: string, replace?: boolean) => void }>({
  path: "/",
  search: new URLSearchParams(),
  go: () => {},
});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState(() => ({ path: location.pathname, search: location.search }));
  useEffect(() => {
    const on = () => setLoc({ path: location.pathname, search: location.search });
    addEventListener("popstate", on);
    return () => removeEventListener("popstate", on);
  }, []);
  const go = useCallback((to: string, replace = false) => {
    history[replace ? "replaceState" : "pushState"](null, "", to);
    const u = new URL(to, location.origin);
    setLoc({ path: u.pathname, search: u.search });
    if (!replace && !u.hash) scrollTo({ top: 0 });
  }, []);
  return <Ctx.Provider value={{ path: loc.path, search: new URLSearchParams(loc.search), go }}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);

export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({ to, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const { go, path } = useRouter();
  return (
    <a
      {...rest}
      href={to}
      aria-current={"aria-current" in rest ? rest["aria-current"] : path === to ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        rest.onClick?.(e);
        go(to);
      }}
    >
      {children}
    </a>
  );
}
