/**
 * Unit tests for intentSourceService.detectSource
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectSource } from './intentSourceService';
import type { IntentLike } from './intentSourceService';
import type { AuraBundle } from '../components/prism/types';

// Mock auraBundleService
vi.mock('./auraBundleService', () => ({
  auraBundleService: {
    loadBundle: vi.fn(() => null),
    saveBundle: vi.fn(),
  },
}));

import { auraBundleService } from './auraBundleService';

const mockLoadBundle = vi.mocked(auraBundleService.loadBundle);

function makeIntent(sourcePath?: string | null): IntentLike {
  return {
    id: 'test-intent-id',
    metadata: { sourcePath },
  };
}

describe('intentSourceService.detectSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Extension-based detection (Requirement 6.1, 6.2, 6.3)', () => {
    it('returns kind "docx" for .docx extension', () => {
      const result = detectSource(makeIntent('/path/to/file.docx'));
      expect(result).toEqual({ kind: 'docx', filePath: '/path/to/file.docx' });
    });

    it('returns kind "docx" for .DOCX extension (case-insensitive)', () => {
      const result = detectSource(makeIntent('/path/to/FILE.DOCX'));
      expect(result).toEqual({ kind: 'docx', filePath: '/path/to/FILE.DOCX' });
    });

    it('returns kind "markdown" for .md extension', () => {
      const result = detectSource(makeIntent('/docs/readme.md'));
      expect(result).toEqual({ kind: 'markdown', filePath: '/docs/readme.md' });
    });

    it('returns kind "markdown" for .markdown extension', () => {
      const result = detectSource(makeIntent('/docs/notes.markdown'));
      expect(result).toEqual({ kind: 'markdown', filePath: '/docs/notes.markdown' });
    });

    it('returns kind "markdown" for .MD extension (case-insensitive)', () => {
      const result = detectSource(makeIntent('/docs/README.MD'));
      expect(result).toEqual({ kind: 'markdown', filePath: '/docs/README.MD' });
    });

    it('returns kind "markdown" for .MARKDOWN extension (case-insensitive)', () => {
      const result = detectSource(makeIntent('/docs/NOTES.MARKDOWN'));
      expect(result).toEqual({ kind: 'markdown', filePath: '/docs/NOTES.MARKDOWN' });
    });

    it('returns kind "html" for .html extension', () => {
      const result = detectSource(makeIntent('/web/page.html'));
      expect(result).toEqual({ kind: 'html', filePath: '/web/page.html' });
    });

    it('returns kind "html" for .htm extension', () => {
      const result = detectSource(makeIntent('/web/page.htm'));
      expect(result).toEqual({ kind: 'html', filePath: '/web/page.htm' });
    });

    it('returns kind "html" for .HTML extension (case-insensitive)', () => {
      const result = detectSource(makeIntent('/web/PAGE.HTML'));
      expect(result).toEqual({ kind: 'html', filePath: '/web/PAGE.HTML' });
    });

    it('returns kind "html" for .HTM extension (case-insensitive)', () => {
      const result = detectSource(makeIntent('/web/PAGE.HTM'));
      expect(result).toEqual({ kind: 'html', filePath: '/web/PAGE.HTM' });
    });
  });

  describe('Extension takes priority over bundle (Requirement 6.7)', () => {
    it('returns extension-based result even when bundle exists', () => {
      const mockBundle: AuraBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: 'test-intent-id',
        canonical: 'markdown',
        markdown: '# Test',
        variants: [],
        promotedVariantId: null,
        lastModified: new Date().toISOString(),
      };
      mockLoadBundle.mockReturnValue(mockBundle);

      const result = detectSource(makeIntent('/path/to/file.docx'));
      expect(result).toEqual({ kind: 'docx', filePath: '/path/to/file.docx' });
      // loadBundle should NOT be called when extension matches
      expect(mockLoadBundle).not.toHaveBeenCalled();
    });
  });

  describe('Bundle detection (Requirement 6.4)', () => {
    it('returns kind "aura" when no sourcePath and bundle exists', () => {
      const mockBundle: AuraBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: 'test-intent-id',
        canonical: 'markdown',
        markdown: '# Test',
        variants: [],
        promotedVariantId: null,
        lastModified: new Date().toISOString(),
      };
      mockLoadBundle.mockReturnValue(mockBundle);

      const result = detectSource(makeIntent(null));
      expect(result).toEqual({ kind: 'aura', bundle: mockBundle });
    });

    it('returns kind "aura" when sourcePath is undefined and bundle exists', () => {
      const mockBundle: AuraBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: 'test-intent-id',
        canonical: 'markdown',
        markdown: '# Hello',
        variants: [],
        promotedVariantId: null,
        lastModified: new Date().toISOString(),
      };
      mockLoadBundle.mockReturnValue(mockBundle);

      const result = detectSource({ id: 'test-intent-id', metadata: {} });
      expect(result).toEqual({ kind: 'aura', bundle: mockBundle });
    });

    it('returns kind "aura" when sourcePath is empty string and bundle exists', () => {
      const mockBundle: AuraBundle = {
        $schema: 'https://wordai.app/schemas/aura/v1.json',
        version: 1,
        intentId: 'test-intent-id',
        canonical: 'markdown',
        markdown: '# Hello',
        variants: [],
        promotedVariantId: null,
        lastModified: new Date().toISOString(),
      };
      mockLoadBundle.mockReturnValue(mockBundle);

      const result = detectSource(makeIntent(''));
      expect(result).toEqual({ kind: 'aura', bundle: mockBundle });
    });
  });

  describe('Fallback to markdown (Requirement 6.5)', () => {
    it('returns kind "markdown" when no sourcePath and no bundle', () => {
      mockLoadBundle.mockReturnValue(null);
      const result = detectSource(makeIntent(null));
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" for unknown extension and no bundle', () => {
      mockLoadBundle.mockReturnValue(null);
      const result = detectSource(makeIntent('/path/to/file.txt'));
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" for extension-less path and no bundle', () => {
      mockLoadBundle.mockReturnValue(null);
      const result = detectSource(makeIntent('/path/to/file'));
      expect(result).toEqual({ kind: 'markdown' });
    });
  });

  describe('Never throws (Requirement 6.6)', () => {
    it('returns kind "markdown" when intent is null', () => {
      const result = detectSource(null);
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" when intent is undefined', () => {
      const result = detectSource(undefined);
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" when metadata is null', () => {
      const result = detectSource({ id: 'test', metadata: null });
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" when metadata is undefined', () => {
      const result = detectSource({ id: 'test' });
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" when auraBundleService throws', () => {
      mockLoadBundle.mockImplementation(() => {
        throw new Error('Service unavailable');
      });
      const result = detectSource(makeIntent(null));
      expect(result).toEqual({ kind: 'markdown' });
    });

    it('returns kind "markdown" when sourcePath is whitespace only', () => {
      mockLoadBundle.mockReturnValue(null);
      const result = detectSource(makeIntent('   '));
      expect(result).toEqual({ kind: 'markdown' });
    });
  });
});
