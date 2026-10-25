// Shape validation for machine rules. Anything that fails becomes a manual rule needing review.
import { z } from "zod";
import type { Rule } from "./types";

const level = z.enum(["bachelor", "master", "phd"]);
const forLevels = { forLevels: z.array(level).min(1).optional() };

export const ruleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("nationality"), allowed: z.array(z.string().regex(/^[A-Z]{2}$/)).min(1), ...forLevels }),
  z.object({ kind: z.literal("target_level"), levels: z.array(level).min(1), ...forLevels }),
  z.object({ kind: z.literal("degree_completed"), level: z.enum(["intermediate", "bachelor", "master", "phd"]), ...forLevels }),
  z.object({ kind: z.literal("min_grade"), scale: z.enum(["4", "5", "100", "german"]), min: z.number().positive(), ...forLevels }),
  z.object({ kind: z.literal("max_age"), max: z.number().int().min(10).max(80), asOf: z.iso.date(), ...forLevels }),
  z.object({ kind: z.literal("language"), anyOf: z.array(z.object({ test: z.string().min(2), min: z.number().nonnegative() })).min(1), ...forLevels }),
  z.object({ kind: z.literal("max_gap_years"), max: z.number().nonnegative(), ...forLevels }),
  z.object({ kind: z.literal("existing_scholarship"), forbidden: z.boolean(), ...forLevels }),
  z.object({ kind: z.literal("applicant_type"), allowed: z.array(z.enum(["new", "continuing"])).min(1), ...forLevels }),
  z.object({ kind: z.literal("min_experience_years"), min: z.number().nonnegative(), ...forLevels }),
  z.object({ kind: z.literal("field"), anyOf: z.array(z.string().min(2)).min(1), ...forLevels }),
  z.object({ kind: z.literal("manual"), ...forLevels }),
]);

export function parseRule(raw: unknown): Rule | null {
  const r = ruleSchema.safeParse(raw);
  return r.success ? (r.data as Rule) : null;
}

/** Infer the degree levels a rule applies to from its "applies to" note, e.g. "master applicants". */
export function levelsFromText(text: string | null | undefined): ("bachelor" | "master" | "phd")[] | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  const out: ("bachelor" | "master" | "phd")[] = [];
  if (/\b(bachelor|undergraduate|ug)\b[^,;]*applicant/.test(t) || /applicants? for (a )?bachelor/.test(t)) out.push("bachelor");
  if (/\b(master|ms|mphil|graduate)\b[^,;]*applicant/.test(t) || /applicants? for (a )?master/.test(t)) out.push("master");
  if (/\b(phd|doctoral|doctorate)\b[^,;]*applicant/.test(t) || /applicants? for (a )?(phd|doctora)/.test(t)) out.push("phd");
  return out.length ? out : undefined;
}
