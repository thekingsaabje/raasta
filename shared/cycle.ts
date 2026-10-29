/** What a research cycle state means today: "open"/"upcoming" whose official deadline has passed is closed. Display-only; never written back. */
export function effectiveCycle(cycle: string, deadline?: string | null, today = new Date().toISOString().slice(0, 10)): string {
  return (cycle === "open" || cycle === "upcoming") && deadline && deadline < today ? "closed" : cycle;
}
