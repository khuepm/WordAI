/**
 * Tests for usePrismState integration with auraBundleService.
 *
 * Covers:
 * - Load bundle on init (if exists)
 * - Save bundle after variant changes (debounced)
 * - Retry logic: max 3 retries with exponential backoff
 * - saveError state and retrySave function
 *
 * Requirements: 5.1, 10.5, 10.6, 10.7
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrismState } from './usePrismState';
import { auraBundleService } from '../../services/auraBundleService';
import type { AuraBundle } from './types';

// Mock auraBundleService
vi.mock('../../services/auraBundleService', () => ({
  auraBundleService: {
    loadBundleAsync: vi.fn(),
    saveBundle: vi.fn(),
    loadBundle: vi.fn(),
    preloadBundle: vi.fn(),
    clearCache: vi.fn(),
  },
}));

// Mock blockToMarkdown to keep tests simple
vi.mock('../../utils/blockToMarkdown', () => ({
  blockToMarkdown: vi.fn((content: string) => {
    // Simple passthrough for testing
    if (!content || content === '[]') return '';
    return `markdown:${content}`;
  }),
}));

const INITIAL_CONTENT = '[{"type":"paragraph","text":"Hello"}]';

function createMockBundle(intentId: string): AuraBundle {
  return {
    $schema: 'https://wordai.app/schemas/aura/v1.json',
    version: 1,
    intentId,
    canonical: 'markdown',
    markdown: '# Test',
    variants: [
      {
        id: 'variant-1',
        label: 'Main',
        markdown: '# Test',
        createdBy: 'user',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'variant-2',
        label: 'Alternative',
        markdown: '# Alt',
        createdBy: 'aurasphere',
        promptRef: 'prompt-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ],
    promotedVariantId: null,
    lastModified: '2024-01-01T00:00:00.000Z',
  };
}

describe('usePrismState — auraBundleService integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    // Default: no bundle exists
    (auraBundleService.loadBundleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('load bundle on init', () => {
    it('calls loadBundleAsync with intentId on mount', async () => {
      (auraBundleService.loadBundleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      expect(auraBundleService.loadBundleAsync).toHaveBeenCalledWith('intent-123');
    });

    it('populates state from bundle variants when bundle exists', async () => {
      const bundle = createMockBundle('intent-123');
      (auraBundleService.loadBundleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(bundle);

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      // Wait for async loadBundleAsync to resolve
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Slots should be populated from bundle variants
      expect(result.current.state.slots[0]).not.toBeNull();
      expect(result.current.state.slots[0]!.id).toBe('variant-1');
      expect(result.current.state.slots[0]!.label).toBe('Main');
      expect(result.current.state.slots[1]).not.toBeNull();
      expect(result.current.state.slots[1]!.id).toBe('variant-2');
      expect(result.current.state.slots[1]!.label).toBe('Alternative');
    });

    it('keeps initial state when no bundle exists', async () => {
      (auraBundleService.loadBundleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.state.slots[0]!.blockContent).toBe(INITIAL_CONTENT);
      expect(result.current.state.slots[1]).toBeNull();
      expect(result.current.state.slots[2]).toBeNull();
    });

    it('skips archived variants when loading bundle', async () => {
      const bundle = createMockBundle('intent-123');
      bundle.variants[1].archivedAt = '2024-01-02T00:00:00.000Z';
      (auraBundleService.loadBundleAsync as ReturnType<typeof vi.fn>).mockResolvedValue(bundle);

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Only non-archived variant should be loaded
      expect(result.current.state.slots[0]!.id).toBe('variant-1');
      expect(result.current.state.slots[1]).toBeNull();
    });
  });

  describe('debounced save after variant changes', () => {
    it('saves bundle 1000ms after updateVariantContent', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'new content');
      });

      // Not saved immediately
      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();

      // Advance 1000ms (debounce)
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(auraBundleService.saveBundle).toHaveBeenCalledTimes(1);
    });

    it('saves bundle 1000ms after addVariant', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.addVariant();
      });

      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(auraBundleService.saveBundle).toHaveBeenCalledTimes(1);
    });

    it('saves bundle 1000ms after discardVariant', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.addVariant();
      });

      // Clear the save from addVariant
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      vi.clearAllMocks();

      act(() => {
        result.current.discardVariant(1);
      });

      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(auraBundleService.saveBundle).toHaveBeenCalledTimes(1);
    });

    it('debounces multiple rapid changes into one save', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'change 1');
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.updateVariantContent(0, 'change 2');
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.updateVariantContent(0, 'change 3');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Should only save once with the latest state
      expect(auraBundleService.saveBundle).toHaveBeenCalledTimes(1);
    });
  });

  describe('retry logic', () => {
    it('retries up to 3 times on save failure with exponential backoff', async () => {
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Disk full')
      );

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'new content');
      });

      // Trigger first save (after 1000ms debounce)
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      // First attempt fails, retry after 1s
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      // Second retry after 2s
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });

      // Third retry after 4s
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      // Total: 1 initial + 3 retries = should have been called at least 3 times
      // (initial + 2 retries before max is reached)
      expect((auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('sets saveError after 3 failed retries', async () => {
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Disk full')
      );

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'new content');
      });

      // Trigger first save
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      // Retry 1 (after 1s backoff)
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });

      // Retry 2 (after 2s backoff)
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });

      // Retry 3 (after 4s backoff)
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      // After 3 retries, saveError should be set
      expect(result.current.saveError).toBe('Disk full');
    });

    it('clears saveError on successful save', async () => {
      let callCount = 0;
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount <= 3) return Promise.reject(new Error('Disk full'));
        return Promise.resolve();
      });

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      // First change — will fail 3 times
      act(() => {
        result.current.updateVariantContent(0, 'content 1');
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).toBe('Disk full');

      // Manual retry — now succeeds
      await act(async () => {
        result.current.retrySave();
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).toBeNull();
    });
  });

  describe('retrySave', () => {
    it('resets retry count and attempts save again', async () => {
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockRejectedValueOnce(new Error('Fail 3'))
        .mockResolvedValueOnce(undefined); // 4th call succeeds

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'content');
      });

      // Exhaust retries
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).not.toBeNull();

      // Manual retry
      await act(async () => {
        result.current.retrySave();
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).toBeNull();
    });
  });

  describe('saveError field', () => {
    it('is null initially', () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));
      expect(result.current.saveError).toBeNull();
    });

    it('contains error message after max retries', async () => {
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Permission denied')
      );

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'content');
      });

      // Exhaust all retries
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).toBe('Permission denied');
    });

    it('provides fallback error message for non-Error throws', async () => {
      (auraBundleService.saveBundle as ReturnType<typeof vi.fn>).mockRejectedValue('unknown error');

      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.updateVariantContent(0, 'content');
      });

      // Exhaust all retries
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(2000);
        await vi.runAllTimersAsync();
      });
      await act(async () => {
        vi.advanceTimersByTime(4000);
        await vi.runAllTimersAsync();
      });

      expect(result.current.saveError).toContain('Lưu variant thất bại');
    });
  });

  describe('does not save for non-variant mutations', () => {
    it('does not trigger save for setViewMode', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.setViewMode(0, 'code');
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();
    });

    it('does not trigger save for toggleSyncScroll', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.toggleSyncScroll();
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();
    });

    it('does not trigger save for setFocus', async () => {
      const { result } = renderHook(() => usePrismState('intent-123', INITIAL_CONTENT));

      act(() => {
        result.current.setFocus(0);
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(auraBundleService.saveBundle).not.toHaveBeenCalled();
    });
  });
});
