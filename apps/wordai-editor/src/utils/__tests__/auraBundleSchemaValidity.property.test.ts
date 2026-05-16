/**
 * Property 6: AuraBundle Schema Validity
 *
 * For any valid AuraBundle, after applying any mutation (add variant, update markdown,
 * set promotedVariantId, archive a variant, update lastModified), the resulting bundle
 * SHALL always pass auraBundleSchema validation.
 *
 * **Validates: Requirements 5.2, 5.4, 5.5, 5.6**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { auraBundleSchema, type AuraBundleSchema } from '../auraSchema';

// ---------------------------------------------------------------------------
// Arbitraries — generate valid AuraBundle components
// ---------------------------------------------------------------------------

/** Generate a valid ISO 8601 datetime string using integer timestamps to avoid Invalid Date */
const iso8601Arb = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ts) => new Date(ts).toISOString());

/** Generate a non-empty label (1-50 chars) */
const labelArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0);

/** Generate a non-empty markdown string */
const markdownArb = fc
  .string({ minLength: 1, maxLength: 500 })
  .filter((s) => s.trim().length > 0);

/** Generate a valid AuraVariantEntry */
const variantEntryArb = fc.record({
  id: fc.uuid(),
  label: labelArb,
  markdown: markdownArb,
  createdBy: fc.constantFrom('user' as const, 'aurasphere' as const),
  createdAt: iso8601Arb,
});

/** Generate a valid AuraBundle with 1-5 variants */
const auraBundleArb: fc.Arbitrary<AuraBundleSchema> = fc
  .record({
    variants: fc.array(variantEntryArb, { minLength: 1, maxLength: 5 }),
    markdown: markdownArb,
    intentId: fc.uuid(),
    lastModified: iso8601Arb,
  })
  .map(({ variants, markdown, intentId, lastModified }) => ({
    $schema: 'https://wordai.app/schemas/aura/v1.json' as const,
    version: 1 as const,
    intentId,
    canonical: 'markdown' as const,
    markdown,
    variants,
    promotedVariantId: null,
    lastModified,
  }));

// ---------------------------------------------------------------------------
// Mutation functions — each takes a valid bundle and returns a mutated bundle
// ---------------------------------------------------------------------------

/** Mutation 1: Add a new variant entry */
function addVariantMutation(bundle: AuraBundleSchema, newEntry: AuraBundleSchema['variants'][0]): AuraBundleSchema {
  return {
    ...bundle,
    variants: [...bundle.variants, newEntry],
    lastModified: new Date().toISOString(),
  };
}

/** Mutation 2: Update markdown field */
function updateMarkdownMutation(bundle: AuraBundleSchema, newMarkdown: string): AuraBundleSchema {
  return {
    ...bundle,
    markdown: newMarkdown,
    lastModified: new Date().toISOString(),
  };
}

/** Mutation 3: Set promotedVariantId to an existing variant id */
function setPromotedVariantIdMutation(bundle: AuraBundleSchema, variantIndex: number): AuraBundleSchema {
  const idx = variantIndex % bundle.variants.length;
  return {
    ...bundle,
    promotedVariantId: bundle.variants[idx].id,
    lastModified: new Date().toISOString(),
  };
}

/** Mutation 4: Archive a variant (set archivedAt) */
function archiveVariantMutation(bundle: AuraBundleSchema, variantIndex: number, archivedAt: string): AuraBundleSchema {
  const idx = variantIndex % bundle.variants.length;
  const updatedVariants = bundle.variants.map((v, i) =>
    i === idx ? { ...v, archivedAt } : v
  );
  return {
    ...bundle,
    variants: updatedVariants,
    lastModified: new Date().toISOString(),
  };
}

/** Mutation 5: Update lastModified */
function updateLastModifiedMutation(bundle: AuraBundleSchema, newTimestamp: string): AuraBundleSchema {
  return {
    ...bundle,
    lastModified: newTimestamp,
  };
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Property 6: AuraBundle Schema Validity', () => {
  it('base generated bundle always passes schema validation', () => {
    fc.assert(
      fc.property(auraBundleArb, (bundle) => {
        const result = auraBundleSchema.safeParse(bundle);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('adding a new variant entry preserves schema validity', () => {
    fc.assert(
      fc.property(auraBundleArb, variantEntryArb, (bundle, newEntry) => {
        // Ensure we don't exceed 50 variants
        if (bundle.variants.length >= 50) return;

        const mutated = addVariantMutation(bundle, newEntry);
        const result = auraBundleSchema.safeParse(mutated);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('updating markdown field preserves schema validity', () => {
    fc.assert(
      fc.property(auraBundleArb, markdownArb, (bundle, newMarkdown) => {
        const mutated = updateMarkdownMutation(bundle, newMarkdown);
        const result = auraBundleSchema.safeParse(mutated);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('setting promotedVariantId to an existing variant id preserves schema validity', () => {
    fc.assert(
      fc.property(auraBundleArb, fc.nat(), (bundle, variantIndex) => {
        const mutated = setPromotedVariantIdMutation(bundle, variantIndex);
        const result = auraBundleSchema.safeParse(mutated);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('archiving a variant (setting archivedAt) preserves schema validity', () => {
    fc.assert(
      fc.property(auraBundleArb, fc.nat(), iso8601Arb, (bundle, variantIndex, archivedAt) => {
        const mutated = archiveVariantMutation(bundle, variantIndex, archivedAt);
        const result = auraBundleSchema.safeParse(mutated);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('updating lastModified preserves schema validity', () => {
    fc.assert(
      fc.property(auraBundleArb, iso8601Arb, (bundle, newTimestamp) => {
        const mutated = updateLastModifiedMutation(bundle, newTimestamp);
        const result = auraBundleSchema.safeParse(mutated);
        expect(result.success).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('applying multiple sequential mutations preserves schema validity', () => {
    fc.assert(
      fc.property(
        auraBundleArb,
        variantEntryArb,
        markdownArb,
        fc.nat(),
        iso8601Arb,
        iso8601Arb,
        (bundle, newEntry, newMarkdown, variantIndex, archivedAt, newTimestamp) => {
          // Ensure we don't exceed 50 variants
          if (bundle.variants.length >= 50) return;

          // Apply mutations sequentially
          let mutated = addVariantMutation(bundle, newEntry);
          mutated = updateMarkdownMutation(mutated, newMarkdown);
          mutated = setPromotedVariantIdMutation(mutated, variantIndex);
          mutated = archiveVariantMutation(mutated, variantIndex, archivedAt);
          mutated = updateLastModifiedMutation(mutated, newTimestamp);

          const result = auraBundleSchema.safeParse(mutated);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
