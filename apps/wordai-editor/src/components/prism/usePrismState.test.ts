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

  describe('pinVariant', () => {
    it('pins an unpinned variant (sets pinned=true)', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      expect(result.current.state.slots[0]!.pinned).toBe(false);

      act(() => {
        result.current.pinVariant(0);
      });

      expect(result.current.state.slots[0]!.pinned).toBe(true);
    });

    it('unpins a pinned variant (sets pinned=false)', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.pinVariant(0);
      });
      expect(result.current.state.slots[0]!.pinned).toBe(true);

      act(() => {
        result.current.pinVariant(0);
      });
      expect(result.current.state.slots[0]!.pinned).toBe(false);
    });

    it('does nothing when slot is null', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const stateBefore = result.current.state;

      act(() => {
        result.current.pinVariant(1);
      });

      expect(result.current.state).toBe(stateBefore);
    });

    it('pins variant at slot 1', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });

      expect(result.current.state.slots[1]!.pinned).toBe(false);

      act(() => {
        result.current.pinVariant(1);
      });

      expect(result.current.state.slots[1]!.pinned).toBe(true);
    });

    it('does not affect other slots when pinning', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
        result.current.addVariant();
      });

      act(() => {
        result.current.pinVariant(1);
      });

      expect(result.current.state.slots[0]!.pinned).toBe(false);
      expect(result.current.state.slots[1]!.pinned).toBe(true);
      expect(result.current.state.slots[2]!.pinned).toBe(false);
    });
  });

  describe('promoteVariant', () => {
    it('promotes variant from slot 1 to slot 0', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });

      // Update slot 1 content to differentiate it
      const slot1Content = '[{"type":"paragraph","text":"Promoted content"}]';
      act(() => {
        result.current.updateVariantContent(1, slot1Content);
      });

      const slot1Id = result.current.state.slots[1]!.id;

      act(() => {
        result.current.promoteVariant(1);
      });

      const { state } = result.current;
      // Slot 0 should now contain the promoted variant
      expect(state.slots[0]).not.toBeNull();
      expect(state.slots[0]!.id).toBe(slot1Id);
      expect(state.slots[0]!.blockContent).toBe(slot1Content);
      // Other slots should be null (no pinned variants)
      expect(state.slots[1]).toBeNull();
      expect(state.slots[2]).toBeNull();
    });

    it('promotes variant from slot 2 to slot 0', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
        result.current.addVariant();
      });

      const slot2Content = '[{"type":"paragraph","text":"Slot 2 content"}]';
      act(() => {
        result.current.updateVariantContent(2, slot2Content);
      });

      const slot2Id = result.current.state.slots[2]!.id;

      act(() => {
        result.current.promoteVariant(2);
      });

      const { state } = result.current;
      expect(state.slots[0]!.id).toBe(slot2Id);
      expect(state.slots[0]!.blockContent).toBe(slot2Content);
      expect(state.slots[1]).toBeNull();
      expect(state.slots[2]).toBeNull();
    });

    it('does nothing when promoting a null slot', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      const stateBefore = result.current.state;

      act(() => {
        result.current.promoteVariant(1);
      });

      expect(result.current.state).toBe(stateBefore);
    });

    it('resets focusedSlot to 0 after promote', () => {
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

      act(() => {
        result.current.promoteVariant(1);
      });

      expect(result.current.state.focusedSlot).toBe(0);
    });

    it('resets modes and codeSubTabs to defaults after promote', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.setViewMode(1, 'code');
        result.current.setCodeSubTab(1, 'html');
      });

      act(() => {
        result.current.promoteVariant(1);
      });

      expect(result.current.state.modes).toEqual(['preview', 'preview', 'preview']);
      expect(result.current.state.codeSubTabs).toEqual(['markdown', 'markdown', 'markdown']);
    });

    it('preserves pinned variants in their slots after promote', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
        result.current.addVariant();
      });

      // Pin slot 2
      act(() => {
        result.current.pinVariant(2);
      });

      const slot2Id = result.current.state.slots[2]!.id;

      // Promote slot 1
      act(() => {
        result.current.promoteVariant(1);
      });

      const { state } = result.current;
      // Slot 0 = promoted variant (from slot 1)
      expect(state.slots[0]).not.toBeNull();
      // Slot 1 = null (was not pinned, not promoted)
      expect(state.slots[1]).toBeNull();
      // Slot 2 = preserved (pinned)
      expect(state.slots[2]).not.toBeNull();
      expect(state.slots[2]!.id).toBe(slot2Id);
      expect(state.slots[2]!.pinned).toBe(true);
    });

    it('promoting slot 0 keeps slot 0 content unchanged', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addVariant();
      });

      const slot0Id = result.current.state.slots[0]!.id;

      act(() => {
        result.current.promoteVariant(0);
      });

      const { state } = result.current;
      expect(state.slots[0]!.id).toBe(slot0Id);
      // Other non-pinned slots should be cleared
      expect(state.slots[1]).toBeNull();
      expect(state.slots[2]).toBeNull();
    });
  });

  describe('addAuraSphereVariants', () => {
    it('places valid variants into empty slots in ascending index order', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'Formal', markdown: '# Formal\n\nContent A', promptRef: 'p1' },
            { label: 'Casual', markdown: '# Casual\n\nContent B', promptRef: 'p2' },
          ],
        });
      });

      const { state } = result.current;
      // Slot 0 has content so it's skipped; variants go to slot 1 and 2
      expect(state.slots[1]).not.toBeNull();
      expect(state.slots[1]!.label).toBe('Formal');
      expect(state.slots[1]!.promptRef).toBe('p1');
      expect(state.slots[2]).not.toBeNull();
      expect(state.slots[2]!.label).toBe('Casual');
      expect(state.slots[2]!.promptRef).toBe('p2');
    });

    it('skips slot 0 when it has content', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'AI Variant', markdown: '# AI', promptRef: 'p1' },
          ],
        });
      });

      // Slot 0 should remain unchanged (Main variant)
      expect(result.current.state.slots[0]!.label).toBe('Main');
      // Variant placed in slot 1
      expect(result.current.state.slots[1]!.label).toBe('AI Variant');
    });

    it('skips pinned slots', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      // Add a variant to slot 1 and pin it
      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.pinVariant(1);
      });

      const pinnedId = result.current.state.slots[1]!.id;

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'AI Variant', markdown: '# AI', promptRef: 'p1' },
          ],
        });
      });

      // Slot 1 should remain pinned and unchanged
      expect(result.current.state.slots[1]!.id).toBe(pinnedId);
      expect(result.current.state.slots[1]!.pinned).toBe(true);
      // Variant placed in slot 2
      expect(result.current.state.slots[2]!.label).toBe('AI Variant');
    });

    it('skips dirty slots', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      // Add a variant to slot 1 and make it dirty
      act(() => {
        result.current.addVariant();
      });
      act(() => {
        result.current.updateVariantContent(1, 'dirty content');
      });

      const dirtyId = result.current.state.slots[1]!.id;

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'AI Variant', markdown: '# AI', promptRef: 'p1' },
          ],
        });
      });

      // Slot 1 should remain unchanged (dirty)
      expect(result.current.state.slots[1]!.id).toBe(dirtyId);
      expect(result.current.state.slots[1]!.dirty).toBe(true);
      // Variant placed in slot 2
      expect(result.current.state.slots[2]!.label).toBe('AI Variant');
    });

    it('skips variants with empty label', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: '', markdown: '# Valid markdown', promptRef: 'p1' },
            { label: 'Valid', markdown: '# Valid', promptRef: 'p2' },
          ],
        });
      });

      // First variant (empty label) skipped, second placed in slot 1
      expect(result.current.state.slots[1]!.label).toBe('Valid');
      expect(result.current.state.slots[2]).toBeNull();
    });

    it('skips variants with empty markdown', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'Empty MD', markdown: '', promptRef: 'p1' },
            { label: 'Valid', markdown: '# Valid', promptRef: 'p2' },
          ],
        });
      });

      // First variant (empty markdown) skipped, second placed in slot 1
      expect(result.current.state.slots[1]!.label).toBe('Valid');
      expect(result.current.state.slots[2]).toBeNull();
    });

    it('skips variants with whitespace-only label', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: '   ', markdown: '# Content', promptRef: 'p1' },
            { label: 'Valid', markdown: '# Valid', promptRef: 'p2' },
          ],
        });
      });

      expect(result.current.state.slots[1]!.label).toBe('Valid');
      expect(result.current.state.slots[2]).toBeNull();
    });

    it('does nothing when all slots are full or protected', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      // Fill all slots
      act(() => {
        result.current.addVariant();
        result.current.addVariant();
      });
      // Pin both
      act(() => {
        result.current.pinVariant(1);
        result.current.pinVariant(2);
      });

      const slot0Id = result.current.state.slots[0]!.id;
      const slot1Id = result.current.state.slots[1]!.id;
      const slot2Id = result.current.state.slots[2]!.id;

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'AI', markdown: '# AI', promptRef: 'p1' },
          ],
        });
      });

      // State should not change (all slots protected)
      expect(result.current.state.slots[0]!.id).toBe(slot0Id);
      expect(result.current.state.slots[1]!.id).toBe(slot1Id);
      expect(result.current.state.slots[2]!.id).toBe(slot2Id);
    });

    it('does nothing when all variants are invalid', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: '', markdown: '# Hello', promptRef: 'p1' },
            { label: 'Valid Label', markdown: '', promptRef: 'p2' },
          ],
        });
      });

      // No valid variants → state unchanged
      expect(result.current.state.slots[1]).toBeNull();
      expect(result.current.state.slots[2]).toBeNull();
    });

    it('converts markdown to blockContent using markdownToBlock', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'Test', markdown: '# Hello World', promptRef: 'p1' },
          ],
        });
      });

      const slot1 = result.current.state.slots[1]!;
      const parsed = JSON.parse(slot1.blockContent);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].type).toBe('header');
      expect(parsed[0].text).toBe('Hello World');
    });

    it('new variants have pinned=false and dirty=false', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'AI', markdown: '# AI Content', promptRef: 'p1' },
          ],
        });
      });

      const slot1 = result.current.state.slots[1]!;
      expect(slot1.pinned).toBe(false);
      expect(slot1.dirty).toBe(false);
    });

    it('excess variants are ignored when not enough slots available', () => {
      const { result } = renderHook(() =>
        usePrismState('intent-1', INITIAL_CONTENT)
      );

      // Fill slot 1 and pin it
      act(() => {
        result.current.addVariant();
        result.current.pinVariant(1);
      });

      act(() => {
        result.current.addAuraSphereVariants({
          variants: [
            { label: 'V1', markdown: '# V1', promptRef: 'p1' },
            { label: 'V2', markdown: '# V2', promptRef: 'p2' },
            { label: 'V3', markdown: '# V3', promptRef: 'p3' },
          ],
        });
      });

      // Only slot 2 is available (slot 0 has content, slot 1 is pinned)
      expect(result.current.state.slots[2]!.label).toBe('V1');
    });
  });

  describe('stubs (no-ops for later milestones)', () => {
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
