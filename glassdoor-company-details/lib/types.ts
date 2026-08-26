import { z } from "zod";

/** Closed choice set for company categorization. */
export const COMPANY_TYPES = [
  "Product",
  "Service",
  "Consulting",
  "Staffing",
  "Startup",
  "Other",
] as const;

export const SalaryRowSchema = z.object({
  designation: z.string(),
  avgLPA: z.number().nonnegative(),
  rangeLPA: z.string(),
  sampleSize: z.number().int().nonnegative().optional(),
});

export const CompanySchema = z.object({
  name: z.string(),
  slug: z.string(),
  industry: z.string(),
  type: z.enum(COMPANY_TYPES),
  rating: z.number().min(0).max(5),
  ratingBreakdown: z
    .object({
      career: z.number().min(0).max(5).optional(),
      comp: z.number().min(0).max(5).optional(),
      management: z.number().min(0).max(5).optional(),
      culture: z.number().min(0).max(5).optional(),
    })
    .optional(),
  totalReviews: z.number().int().nonnegative().optional(),
  headcount: z.object({ india: z.string(), global: z.string() }).optional(),
  good: z.array(z.string()),
  bad: z.array(z.string()),
  salaries: z.array(SalaryRowSchema),
  sourceReviews: z.number().int().nonnegative().optional(),
  analyzedAt: z.string().optional(),
});

export const EnrichedDatasetSchema = z.object({
  version: z.number(),
  generatedAt: z.string(),
  companies: z.array(CompanySchema),
});

export type Company = z.infer<typeof CompanySchema>;
export type SalaryRow = z.infer<typeof SalaryRowSchema>;
export type EnrichedDataset = z.infer<typeof EnrichedDatasetSchema>;

/** Raw scraped/pasted shape for one company (input to the LLM pipeline). */
export const RawCompanySchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  ratingBreakdown: z
    .object({
      career: z.number().min(0).max(5).optional(),
      comp: z.number().min(0).max(5).optional(),
      management: z.number().min(0).max(5).optional(),
      culture: z.number().min(0).max(5).optional(),
    })
    .optional(),
  totalReviews: z.number().int().nonnegative().optional(),
  headcount: z.object({ india: z.string(), global: z.string() }).optional(),
  reviews: z.array(z.string()),
  salaries: z.array(z.string()),
});

export const RawDatasetSchema = z.object({
  version: z.number(),
  scrapedAt: z.string(),
  companies: z.array(RawCompanySchema),
});

export type RawCompany = z.infer<typeof RawCompanySchema>;
export type RawDataset = z.infer<typeof RawDatasetSchema>;