// Proposed packages. Prices are hypotheses to test with real customers; stored in the `packages`
// table so they can change without code. Payments are disabled (PAYMENTS_ENABLED=false).
export interface PackageDef {
  id: string;
  name: string;
  price_pkr: number;
  period: "once" | "semester";
  summary: string;
  features: string[];
  exclusions: string[];
}

export const DEFAULT_PACKAGES: PackageDef[] = [
  {
    id: "explore",
    name: "Free Explore",
    price_pkr: 0,
    period: "once",
    summary: "Search scholarships and see what you can already check.",
    features: ["Scholarship search", "Official source links", "Eligibility preview", "Saved opportunities", "Basic checklist"],
    exclusions: [],
  },
  {
    id: "fit",
    name: "Raasta Fit",
    price_pkr: 1990,
    period: "once",
    summary: "A personal eligibility assessment and shortlist.",
    features: ["Personal eligibility assessment", "Academic and study-gap analysis", "Relevant shortlist", "Initial funding check"],
    exclusions: ["No human review", "No application submission"],
  },
  {
    id: "strategy",
    name: "Raasta Strategy",
    price_pkr: 5990,
    period: "once",
    summary: "A prioritised plan with costs, documents and deadlines.",
    features: ["Prioritised shortlist", "Financial gap analysis", "Document-by-document checklist", "Route comparison", "Roadmap and deadlines", "Writing Studio (within provider rules)"],
    exclusions: ["No human review", "No application submission"],
  },
  {
    id: "season",
    name: "Raasta Application Season",
    price_pkr: 12990,
    period: "once",
    summary: "A workspace for running several applications at once.",
    features: ["Application workspace", "Multiple trackers (scope to be defined)", "Document and revision tracking", "Deadline management", "Readiness checks"],
    exclusions: ["No managed submission", "Limits on applications and revisions to be defined before launch"],
  },
  {
    id: "intelligence",
    name: "Raasta Student Intelligence",
    price_pkr: 2490,
    period: "semester",
    summary: "For students already abroad: renewals and new funding.",
    features: ["Profile-matched monitoring", "Continuing-student funding", "Renewal reminders", "Academic-year planning"],
    exclusions: [],
  },
];
