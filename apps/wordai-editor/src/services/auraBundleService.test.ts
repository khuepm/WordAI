/**
 * Unit tests for auraBundleService
 *
 * Tests load/save operations with mocked I/O layer.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auraBundleService, setIO, resetIO, type AuraBundleIO } from './auraBundleService';
import type { AuraBundle } from '../components/prism/types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createValidBundle(intentId = 'test-intent-123'): AuraBundle {
  return {
    $schema: 'https://wordai.app/schemas/aura/v1.json',
    version: 1,
    intentId,
    canonical: 'markdown',
    markdown: '# Hello World',
    variants: [
      {
        id: 'variant-1',
        label: 'Original',
        markdown: '# Hello World',
        createdBy: 'user',
        createdAt: '2024-01-15T10:30:00.000Z',
      },
    ],
    promotedVariantId: null,
    lastModified: '2024-01-15T10:30:00.000Z',
  };
}

function createMockIO(fileStore: Record<string, string> = {}): AuraBundleIO {
  return {
    async readFile(path: string): Promise<string> {
      const content = fileStore[path];
      if (content === undefined) {
        throw new Error(`FILE_NOT_FOUND: ${path}`);
      }
      return content;
    },
    async writeFile(path: string, content: string): Promise<void> {
      fileStore[path] = content;
    },
    async exists(path: string): Promise<boolean> {
      return path in fileStore;
    },
    async mkdir(_path: string): Promise<void> {
      // no-op for tests
    },
    async getAppDataDir(): Promise<string> {
      return '/mock/appdata';
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('auraBundleService', () => {
  let fileStore: Record<string, string>;
  let mockIO: AuraBundleIO;

  beforeEach(() => {
    fileStore = {};
    mockIO = createMockIO(fileStore);
    setIO(mockIO);
    auraBundleService.clearCache();
  });

  afterEach(() => {
    resetIO();
  });

  describe('loadBundle (sync, from cache)', () => {
    it('returns null when cache is empty', () => {
      const result = auraBundleService.loadBundle('nonexistent');
      expect(result).toBeNull();
    });

    it('returns cached bundle after preload', async () => {
      const bundle = createValidBundle();
      fileStore['/mock/appdata/aura/test-intent-123.aura.json'] = JSON.stringify(bundle);

      await auraBundleService.preloadBundle('test-intent-123');
      const result = auraBundleService.loadBundle('test-intent-123');

      expect(result).not.toBeNull();
      expect(result!.intentId).toBe('test-intent-123');
    });
  });

  describe('loadBundleAsync', () => {
    it('returns null when file does not exist', async () => {
      const result = await auraBundleService.loadBundleAsync('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when file content is invalid JSON', async () => {
      fileStore['/mock/appdata/aura/bad-json.aura.json'] = 'not valid json {{{';
      const result = await auraBundleService.loadBundleAsync('bad-json');
      expect(result).toBeNull();
    });

    it('returns null when file content does not pass schema validation', async () => {
      const invalidBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 2, // wrong version
        intentId: 'test',
        canonical: 'markdown',
        markdown: '',
        variants: [],
        promotedVariantId: null,
        lastModified: '2024-01-15T10:30:00.000Z',
      };
      fileStore['/mock/appdata/aura/invalid.aura.json'] = JSON.stringify(invalidBundle);

      const result = await auraBundleService.loadBundleAsync('invalid');
      expect(result).toBeNull();
    });

    it('returns valid bundle and populates cache', async () => {
      const bundle = createValidBundle('my-intent');
      fileStore['/mock/appdata/aura/my-intent.aura.json'] = JSON.stringify(bundle);

      const result = await auraBundleService.loadBundleAsync('my-intent');
      expect(result).not.toBeNull();
      expect(result!.intentId).toBe('my-intent');
      expect(result!.variants).toHaveLength(1);

      // Cache should be populated
      const cached = auraBundleService.loadBundle('my-intent');
      expect(cached).not.toBeNull();
      expect(cached!.intentId).toBe('my-intent');
    });

    it('returns null when I/O throws an error', async () => {
      const errorIO: AuraBundleIO = {
        ...mockIO,
        async exists() {
          throw new Error('Disk error');
        },
      };
      setIO(errorIO);

      const result = await auraBundleService.loadBundleAsync('any-id');
      expect(result).toBeNull();
    });

    it('returns null when promotedVariantId does not match any variant', async () => {
      const bundle = createValidBundle();
      bundle.promotedVariantId = 'nonexistent-variant-id';
      fileStore['/mock/appdata/aura/test-intent-123.aura.json'] = JSON.stringify(bundle);

      const result = await auraBundleService.loadBundleAsync('test-intent-123');
      expect(result).toBeNull();
    });
  });

  describe('saveBundle', () => {
    it('saves valid bundle to disk', async () => {
      const bundle = createValidBundle();
      await auraBundleService.saveBundle(bundle);

      const savedContent = fileStore['/mock/appdata/aura/test-intent-123.aura.json'];
      expect(savedContent).toBeDefined();

      const parsed = JSON.parse(savedContent);
      expect(parsed.intentId).toBe('test-intent-123');
      expect(parsed.variants).toHaveLength(1);
    });

    it('updates lastModified to current timestamp', async () => {
      const bundle = createValidBundle();
      const beforeSave = new Date().toISOString();

      await auraBundleService.saveBundle(bundle);

      const savedContent = fileStore['/mock/appdata/aura/test-intent-123.aura.json'];
      const parsed = JSON.parse(savedContent);

      // lastModified should be updated (>= beforeSave)
      expect(new Date(parsed.lastModified).getTime()).toBeGreaterThanOrEqual(
        new Date(beforeSave).getTime() - 1000
      );
    });

    it('throws when bundle is invalid', async () => {
      const invalidBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: '', // empty — invalid
        canonical: 'markdown',
        markdown: '',
        variants: [],
        promotedVariantId: null,
        lastModified: '2024-01-15T10:30:00.000Z',
      } as unknown as AuraBundle;

      await expect(auraBundleService.saveBundle(invalidBundle)).rejects.toThrow(
        'AuraBundle validation failed'
      );
    });

    it('overwrites existing file', async () => {
      const bundle1 = createValidBundle();
      bundle1.markdown = '# Version 1';
      await auraBundleService.saveBundle(bundle1);

      const bundle2 = createValidBundle();
      bundle2.markdown = '# Version 2';
      await auraBundleService.saveBundle(bundle2);

      const savedContent = fileStore['/mock/appdata/aura/test-intent-123.aura.json'];
      const parsed = JSON.parse(savedContent);
      expect(parsed.markdown).toBe('# Version 2');
    });

    it('updates cache after save', async () => {
      const bundle = createValidBundle();
      bundle.markdown = '# Cached content';
      await auraBundleService.saveBundle(bundle);

      const cached = auraBundleService.loadBundle('test-intent-123');
      expect(cached).not.toBeNull();
      expect(cached!.markdown).toBe('# Cached content');
    });

    it('creates directory before writing', async () => {
      const mkdirSpy = vi.fn();
      const ioWithSpy: AuraBundleIO = {
        ...mockIO,
        mkdir: mkdirSpy,
      };
      setIO(ioWithSpy);

      const bundle = createValidBundle();
      await auraBundleService.saveBundle(bundle);

      expect(mkdirSpy).toHaveBeenCalledWith('/mock/appdata/aura');
    });
  });

  describe('clearCache', () => {
    it('clears specific bundle from cache', async () => {
      const bundle = createValidBundle();
      fileStore['/mock/appdata/aura/test-intent-123.aura.json'] = JSON.stringify(bundle);
      await auraBundleService.preloadBundle('test-intent-123');

      expect(auraBundleService.loadBundle('test-intent-123')).not.toBeNull();

      auraBundleService.clearCache('test-intent-123');
      expect(auraBundleService.loadBundle('test-intent-123')).toBeNull();
    });

    it('clears all bundles from cache when no id provided', async () => {
      const bundle1 = createValidBundle('intent-1');
      const bundle2 = createValidBundle('intent-2');
      fileStore['/mock/appdata/aura/intent-1.aura.json'] = JSON.stringify(bundle1);
      fileStore['/mock/appdata/aura/intent-2.aura.json'] = JSON.stringify(bundle2);

      await auraBundleService.preloadBundle('intent-1');
      await auraBundleService.preloadBundle('intent-2');

      auraBundleService.clearCache();
      expect(auraBundleService.loadBundle('intent-1')).toBeNull();
      expect(auraBundleService.loadBundle('intent-2')).toBeNull();
    });
  });
});
