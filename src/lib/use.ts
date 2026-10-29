import { useCallback, useEffect, useState, useRef } from "react";
import { api } from "./api";

/** Fetch JSON from the API with loading/error state and a reload function. */
export function useApi<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  // Only the newest request may update state: a slow, older response (e.g. before a filter changed) is dropped.
  const latest = useRef(0);
  const load = useCallback(async () => {
    if (!path) return;
    const call = ++latest.current;
    setLoading(true);
    try {
      const d = await api.get<T>(path);
      if (call !== latest.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (call !== latest.current) return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (call === latest.current) setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, loading, reload: load, setData };
}

export const COUNTRY: Record<string, { name: string; code: string }> = {
  CN: { name: "China", code: "CN" },
  DE: { name: "Germany", code: "DE" },
  IT: { name: "Italy", code: "IT" },
};

export const fmtPkr = (n: number) => "PKR " + Math.round(n).toLocaleString("en-PK");
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d.length === 10 ? d + "T00:00:00Z" : d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
