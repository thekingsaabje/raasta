import { z } from "zod";

const level = z.enum(["intermediate", "bachelor", "master", "phd"]);

/**
 * Student profile. Every field is optional: we only ask for what a rule needs,
 * and a missing field produces UNKNOWN, never NOT_MET.
 */
export const profileSchema = z
  .object({
    nationality: z.string().length(2).toUpperCase().optional(),
    residence: z.string().max(60).optional(),
    birthDate: z.iso.date().optional(),
    journey: z.enum(["applying_from_pakistan", "studying_in_china", "studying_in_germany_italy", "holds_scholarship"]).optional(),
    /** Where a student already abroad is studying (used by the 'holds_scholarship' journey). */
    currentCountry: z.enum(["CN", "DE", "IT"]).optional(),
    /** Needs to renew an existing award (annual review) rather than find a new one. */
    needsRenewal: z.boolean().optional(),
    highestCompleted: level.optional(),
    currentUniversity: z.string().max(160).optional(),
    currentYear: z.number().int().min(1).max(8).optional(),
    qualificationName: z.string().max(160).optional(),
    awardingInstitution: z.string().max(160).optional(),
    field: z.string().max(120).optional(),
    grade: z
      .object({ scale: z.enum(["4", "5", "100", "german"]), value: z.number().min(0).max(100) })
      .optional(),
    graduationDate: z.iso.date().optional(),
    gapYears: z.number().min(0).max(30).optional(),
    failedCourses: z.number().int().min(0).max(100).optional(),
    languageTests: z.array(z.object({ test: z.string().max(20), score: z.number().min(0).max(1000) })).max(10).optional(),
    experienceYears: z.number().min(0).max(50).optional(),
    targetLevel: z.enum(["bachelor", "master", "phd"]).optional(),
    targetField: z.string().max(120).optional(),
    targetCountries: z.array(z.enum(["CN", "DE", "IT"])).max(3).optional(),
    intake: z.string().max(20).optional(),
    budgetPkr: z.number().min(0).max(1e10).optional(),
    /** Language situation when there's no score yet: planning a test, or relying on an English-medium (MOI) letter. */
    languageStatus: z.enum(["has_result", "planning", "moi"]).optional(),
    /** Whether the student can only go with full funding. Used to order results, never to hide them. */
    fundingNeed: z.enum(["full_only", "partial_ok"]).optional(),
    hasExistingScholarship: z.boolean().optional(),
    existingScholarshipName: z.string().max(160).optional(),
  })
  .strict();

export type Profile = z.infer<typeof profileSchema>;
