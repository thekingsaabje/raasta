import { CheckCircle2, CircleHelp, FileQuestion, Landmark, UserRound } from "lucide-react";
import type { Evidence, Rates } from "../../../shared/planner";
import { convert } from "../../../shared/planner";

const EV: Record<Evidence | "NEEDS_REVIEW", [string, string, any, string]> = {
  NEEDS_REVIEW: ["b-bad", "Needs review", CircleHelp, "Outdated or conflicting with another official source. Don't rely on it."],
  VERIFIED: ["b-ok", "Official figure", CheckCircle2, "Taken from an official source and checked for the current period."],
  OFFICIAL_ESTIMATE: ["b-info", "Official estimate", Landmark, "An official body's average or guidance. Real costs vary."],
  ESTIMATE: ["b-warn", "Estimate", CircleHelp, "Not confirmed for your programme and period."],
  USER: ["b-neutral", "Your figure", UserRound, "Entered by you."],
  UNKNOWN: ["b-bad", "Unknown", FileQuestion, "Not known yet, so it's excluded from totals."],
};

export function EvidenceBadge({ status }: { status: Evidence | "NEEDS_REVIEW" }) {
  const [cls, label, Icon, title] = EV[status];
  return <span className={`badge ${cls}`} title={title}><Icon size={12} />{label}</span>;
}

/** Format a PKR amount in the chosen display currency. Without a rate we show PKR rather than inventing one. */
export function money(pkr: number, display: string, rates: Rates): string {
  const v = convert(pkr, display, rates);
  if (v === null) return `PKR ${Math.round(pkr).toLocaleString("en-PK")}`;
  const digits = display === "PKR" ? 0 : 0;
  return `${display} ${v.toLocaleString("en-GB", { maximumFractionDigits: digits })}`;
}

export const STAGE_LABEL = {
  before_application: "Before applying",
  before_visa: "Before the visa",
  before_departure: "Before you fly",
  on_arrival: "On arrival",
  during_study: "During the first year",
} as const;
