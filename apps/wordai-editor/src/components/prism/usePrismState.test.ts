import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePrismState } from './usePrismState';

const INITIAL_CONTENT = '[]';

describe('usePrismState', () => {
  describe('initialization', () => {
    it('initializes with slot 0 containing main variant and slots 1-2 null', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const { state } = result.current;
      expect(state.slots).toHaveLength(3);
      expect(state.slots[0]).not.toBeNull();
      expect(state.slots[1]).toBeNull();
      expect(state.slots[2]).toBeNull();
    });

    it('slot 0 has correct initial properties', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const mainVariant = result.current.state.slots[0]!;
      expect(mainVariant.label).toBe('Main');
      expect(mainVariant.blockContent).toBe(INITIAL_CONTENT);
      expect(mainVariant.source).toEqual({ kind: 'markdown' });
      expect(mainVariant.pinned).toBe(false);
      expect(mainVariant.dirty).toBe(false);
      expect(mainVariant.id).toBeTruthy();
    });

    it('initializes modes, codeSubTabs, focusedSlot, syncScroll correctly', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const { state } = result.current;
      expect(state.modes).toEqual(['preview', 'preview', 'preview']);
      expect(state.codeSubTabs).toEqual(['markdown', 'markdown', 'markdown']);
      expect(state.focusedSlot).toBe(0);
      expect(state.syncScroll).toBe(false);
    });
  });

  describe('addVariant', () => {
    it('adds variant to lowest-index null slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });

      const { state } = result.current;
      expect(state.slots[1]).not.toBeNull();
      expect(state.slots[1]!.label).toBe('Variant 2');
      expect(state.slots[1]!.blockContent).toBe(INITIAL_CONTENT);
      expect(state.slots[2]).toBeNull();
    });

    it('adds second variant to slot 2 when slot 1 is occupied', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.addVariant();
      });

      const { state } = result.current;
      expect(state.slots[1]).not.toBeNull();
      expect(state.slots[2]).not.toBeNull();
      expect(state.slots[2]!.label).toBe('Variant 3');
    });

    it('does nothing when all slots are full', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.addVariant();
      });

      const stateBefore = result.current.state;

      act(() => {
        result.current.addVariant();
      });

      expect(result.current.state).toBe(stateBefore);
    });

    it('clones slot 0 blockContent into new variant', () => {
      const content = '[{"type":"paragraph","text":"Hello"}]';
      const { result } = renderHook(() =>
        usePrismState('intent-1', content)
      );

      act(() => {
        result.current.addVariant();
      });

      expect(result.current.state.slots[1]!.blockContent).toBe(content);
    });

    it('new variant has unique id', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });

      const slot0Id = result.current.state.slots[0]!.id;
      const slot1Id = result.current.state.slots[1]!.id;
      expect(slot0Id).not.toBe(slot1Id);
    });
  });

  describe('discardVariant', () => {
    it('sets slot to null for slot 1', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.discardVariant(1);
      });

      expect(result.current.state.slots[1]).toBeNull();
    });

    it('sets slot to null for slot 2', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
        result.current.addVariant();
      });
      act(() => {
        result.current.discardVariant(2);
      });

      expect(result.current.state.slots[2]).toBeNull();
    });

    it('refuses to discard slot 0', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const stateBefore = result.current.state;

      act(() => {
        result.current.discardVariant(0);
      });

      expect(result.current.state.slots[0]).not.toBeNull();
      expect(result.current.state).toBe(stateBefore);
    });

    it('moves focus to slot 0 when focused slot is discarded', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.setFocus(1);
      });
      act(() => {
        result.current.discardVariant(1);
      });

      expect(result.current.state.focusedSlot).toBe(0);
    });
  });

  describe('updateVariantContent', () => {
    it('updates blockContent for specified slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const newContent = '[{"type":"paragraph","text":"Updated"}]';
      act(() => {
        result.current.updateVariantContent(0, newContent);
      });

      expect(result.current.state.slots[0]!.blockContent).toBe(newContent);
    });

    it('sets dirty=true after update', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.updateVariantContent(0, 'new content');
      });

      expect(result.current.state.slots[0]!.dirty).toBe(true);
    });

    it('does nothing for null slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const stateBefore = result.current.state;

      act(() => {
        result.current.updateVariantContent(1, 'content');
      });

      expect(result.current.state).toBe(stateBefore);
    });
  });

  describe('setViewMode', () => {
    it('updates mode for specified slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.setViewMode(0, 'code');
      });

      expect(result.current.state.modes[0]).toBe('code');
      expect(result.current.state.modes[1]).toBe('preview');
      expect(result.current.state.modes[2]).toBe('preview');
    });
  });

  describe('setCodeSubTab', () => {
    it('updates codeSubTab for specified slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.setCodeSubTab(1, 'html');
      });

      expect(result.current.state.codeSubTabs[1]).toBe('html');
    });
  });

  describe('setFocus', () => {
    it('updates focusedSlot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.setFocus(1);
      });

      expect(result.current.state.focusedSlot).toBe(1);
    });

    it('does not set focus to null slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.setFocus(2);
      });

      expect(result.current.state.focusedSlot).toBe(0);
    });
  });

  describe('toggleSyncScroll', () => {
    it('toggles syncScroll from false to true', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.toggleSyncScroll();
      });

      expect(result.current.state.syncScroll).toBe(true);
    });

    it('toggles syncScroll from true to false', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.toggleSyncScroll();
      });
      act(() => {
        result.current.toggleSyncScroll();
      });

      expect(result.current.state.syncScroll).toBe(false);
    });
  });

  describe('stubs (no-ops for later milestones)', () => {
    it('promoteVariant does not throw', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      expect(() => {
        act(() => {
          result.current.promoteVariant(0);
        });
      }).not.toThrow();
    });

    it('pinVariant does not throw', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      expect(() => {
        act(() => {
          result.current.pinVariant(0);
        });
      }).not.toThrow();
    });

    it('addAuraSphereVariants does not throw', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      expect(() => {
        act(() => {
          result.current.addAuraSphereVariants({
            variants: [{ label: 'AI', markdown: '# Hello', promptRef: 'p1' }],
          });
        });
      }).not.toThrow();
    });

    it('updateFromMarkdown does not throw', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      expect(() => {
        act(() => {
          result.current.updateFromMarkdown(0, '# Hello');
        });
      }).not.toThrow();
    });
  });
});
