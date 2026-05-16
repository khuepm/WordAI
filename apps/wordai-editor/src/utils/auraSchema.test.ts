import { describe, it, expect } from 'vitest';
import { auraBundleSchema, auraVariantEntrySchema } from './auraSchema';

function validBundle(overrides: Record<string, unknown> = {}) {
  return {
    $schema: 'https://wordai.app/schemas/aura/v1.json' as const,
    version: 1 as const,
    intentId: 'intent-123',
    canonical: 'markdown' as const,
    markdown: '# Hello',
    variants: [
      {
        id: 'v1',
        label: 'Formal',
        markdown: '# Hello formal',
        createdBy: 'user' as const,
        createdAt: '2024-01-15T10:30:00.000Z',
      },
    ],
    promotedVariantId: null,
    lastModified: '2024-01-15T10:30:00.000Z',
    ...overrides,
  };
}

describe('auraBundleSchema', () => {
  it('accepts a valid AuraBundle', () => {
    const result = auraBundleSchema.safeParse(validBundle());
    expect(result.success).toBe(true);
  });

  it('rejects wrong $schema URL', () => {
    const result = auraBundleSchema.safeParse(validBundle({ $schema: 'https://wrong.url/v1.json' }));
    expect(result.success).toBe(false);
  });

  it('rejects version !== 1', () => {
    const result = auraBundleSchema.safeParse(validBundle({ version: 2 }));
    expect(result.success).toBe(false);
  });

  it('rejects empty intentId', () => {
    const result = auraBundleSchema.safeParse(validBundle({ intentId: '' }));
    expect(result.success).toBe(false);
  });

  it('rejects invalid lastModified (not ISO 8601)', () => {
    const result = auraBundleSchema.safeParse(validBundle({ lastModified: 'not-a-date' }));
    expect(result.success).toBe(false);
  });

  it('rejects lastModified without time component', () => {
    const result = auraBundleSchema.safeParse(validBundle({ lastModified: '2024-01-15' }));
    expect(result.success).toBe(false);
  });

  it('accepts lastModified with timezone offset', () => {
    const result = auraBundleSchema.safeParse(validBundle({ lastModified: '2024-01-15T10:30:00+07:00' }));
    expect(result.success).toBe(true);
  });

  it('rejects promotedVariantId that does not match any variant id', () => {
    const result = auraBundleSchema.safeParse(validBundle({ promotedVariantId: 'non-existent-id' }));
    expect(result.success).toBe(false);
  });

  it('accepts promotedVariantId that matches a variant id', () => {
    const result = auraBundleSchema.safeParse(validBundle({ promotedVariantId: 'v1' }));
    expect(result.success).toBe(true);
  });

  it('accepts promotedVariantId as null', () => {
    const result = auraBundleSchema.safeParse(validBundle({ promotedVariantId: null }));
    expect(result.success).toBe(true);
  });

  it('rejects variants array with more than 50 entries', () => {
    const variants = Array.from({ length: 51 }, (_, i) => ({
      id: `v${i}`,
      label: `Variant ${i}`,
      markdown: `Content ${i}`,
      createdBy: 'user' as const,
      createdAt: '2024-01-15T10:30:00.000Z',
    }));
    const result = auraBundleSchema.safeParse(validBundle({ variants }));
    expect(result.success).toBe(false);
  });

  it('accepts variants array with exactly 50 entries', () => {
    const variants = Array.from({ length: 50 }, (_, i) => ({
      id: `v${i}`,
      label: `Variant ${i}`,
      markdown: `Content ${i}`,
      createdBy: 'user' as const,
      createdAt: '2024-01-15T10:30:00.000Z',
    }));
    const result = auraBundleSchema.safeParse(validBundle({ variants }));
    expect(result.success).toBe(true);
  });

  it('accepts empty variants array', () => {
    const result = auraBundleSchema.safeParse(validBundle({ variants: [], promotedVariantId: null }));
    expect(result.success).toBe(true);
  });
});

describe('auraVariantEntrySchema', () => {
  it('accepts a valid variant entry', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty id', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: '',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty label', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: '',
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects label longer than 50 characters', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'A'.repeat(51),
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty markdown', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid createdBy value', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'unknown',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional promptRef', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'aurasphere',
      promptRef: 'prompt-abc',
      createdAt: '2024-01-15T10:30:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional archivedAt', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: '2024-01-15T10:30:00.000Z',
      archivedAt: '2024-02-01T12:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid createdAt (not ISO 8601)', () => {
    const result = auraVariantEntrySchema.safeParse({
      id: 'v1',
      label: 'Formal',
      markdown: '# Hello',
      createdBy: 'user',
      createdAt: 'invalid-date',
    });
    expect(result.success).toBe(false);
  });
});
