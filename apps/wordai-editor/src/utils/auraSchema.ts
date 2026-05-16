import { z } from 'zod';

/**
 * ISO 8601 datetime string validation.
 * Accepts formats like: 2024-01-15T10:30:00.000Z, 2024-01-15T10:30:00Z, 2024-01-15T10:30:00+07:00
 */
const iso8601 = z.string().refine(
  (val) => !isNaN(Date.parse(val)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val),
  { message: 'Must be a valid ISO 8601 datetime string' }
);

/**
 * Schema for a single variant entry within an AuraBundle.
 */
export const auraVariantEntrySchema = z.object({
  id: z.string().min(1, 'Variant id must not be empty'),
  label: z.string().min(1, 'Variant label must not be empty').max(50, 'Variant label must be at most 50 characters'),
  markdown: z.string().min(1, 'Variant markdown must not be empty'),
  createdBy: z.enum(['user', 'aurasphere']),
  promptRef: z.string().optional(),
  createdAt: iso8601,
  archivedAt: iso8601.optional(),
});

/**
 * Zod schema for AuraBundle v1.
 *
 * Validates:
 * - $schema must be exactly 'https://wordai.app/schemas/aura/v1.json'
 * - version must be exactly 1
 * - intentId must be non-empty
 * - lastModified must be valid ISO 8601
 * - variants array max 50 entries
 * - promotedVariantId if not null must match one of the variant IDs
 */
export const auraBundleSchema = z
  .object({
    $schema: z.literal('https://wordai.app/schemas/aura/v1.json'),
    version: z.literal(1),
    intentId: z.string().min(1, 'intentId must not be empty'),
    canonical: z.literal('markdown'),
    markdown: z.string(),
    variants: z.array(auraVariantEntrySchema).max(50, 'variants must have at most 50 entries'),
    promotedVariantId: z.string().nullable(),
    lastModified: iso8601,
  })
  .refine(
    (bundle) => {
      if (bundle.promotedVariantId === null) return true;
      return bundle.variants.some((v) => v.id === bundle.promotedVariantId);
    },
    {
      message: 'promotedVariantId must match an existing variant id',
      path: ['promotedVariantId'],
    }
  );

/** Inferred TypeScript type from the AuraBundle schema */
export type AuraBundleSchema = z.infer<typeof auraBundleSchema>;

/** Inferred TypeScript type from the AuraVariantEntry schema */
export type AuraVariantEntrySchema = z.infer<typeof auraVariantEntrySchema>;
