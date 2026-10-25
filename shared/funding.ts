import type { Coverage, FundingClass } from "./types";

export const FUNDING_LABEL: Record<FundingClass, string> = {
  full: "Full funding (documented)",
  partial: "Partial funding",
  tuition_only: "Tuition only",
  stipend_only: "Stipend only",
  unknown: "Coverage not confirmed",
};

/** Derive a funding class from documented coverage. "Full" needs tuition, living support and housing on record. */
export function classifyFunding(c: Coverage | null | undefined): FundingClass {
  if (!c || Object.keys(c).length === 0) return "unknown";
  const tuition = c.tuition === "full";
  const living = !!c.stipend;
  const housing = c.accommodation === "full" || c.accommodation === "partial";
  if (tuition && living && housing) return "full";
  if (tuition && !living && !housing) return "tuition_only";
  if (!c.tuition && living && !housing) return "stipend_only";
  if (c.tuition === "none" && living) return "stipend_only";
  return "partial";
}
