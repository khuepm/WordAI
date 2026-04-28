/**
 * Visual regression tests — DOM-level assertions for CSS properties, inline styles,
 * and class names applied by glassmorphism, animation, and typography features.
 *
 * Requirements: 18.1, 18.2, 18.3, 19.1, 19.2, 20.1, 20.2, 20.3, 20.4, 20.5
 *
 * NOTE: jsdom cannot resolve CSS variables, so all assertions target inline style
 * values set directly in React style objects (not computed styles from CSS classes).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuraSpherePanel } from './AuraSpherePanel';
import { NegotiationPanel } from './NegotiationPanel';
import { RenderDrawer } from './RenderDrawer';
import { EditorCanvas } from './EditorCanvas';
import type { AISuggestion } from '../types/ai';
import type { Document } from '../types/document';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockInvoke = vi.fn().mockResolvedValue({ success: true, data: [] });

vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));
vi.mock('@tauri-apps/api', () => ({}));
vi.mock('@tauri-apps/plugin-opener', () => ({}));
// Mock authStore so components can render without AuthStateProvider
vi.mock('../services/authStore', () => ({
  useAIAccessState: () => 'active',
  useAuthState: () => ({ authState: { accessContext: null, aiAccessState: 'active', isLoading: false, authError: null } }),
  useAccessContext: () => null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defaultAuraSphereProps = {
  isOpen: true,
  onClose: vi.fn(),
  selection: null,
  documentId: 'doc-1',
  documentContext: 'Some document context',
  onSuggestionSelect: vi.fn(),
};

const suggestion: AISuggestion = {
  id: '1',
  suggestedText: 'Better text',
  originalText: 'Original',
  explanation: 'Clearer',
  confidenceScore: 0.9,
};

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'test-doc',
    title: 'Test',
    content: '',
    version: 1,
    lastModified: new Date('2024-01-01T00:00:00Z'),
    metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
    ...overrides,
  };
}

// ─── 1. Glassmorphism effects ─────────────────────────────────────────────────

describe('Glassmorphism effects', () => {
  // Req 18.1, 18.2, 18.3 — AuraSpherePanel
  describe('AuraSpherePanel (Req 18.1, 18.2, 18.3)', () => {
    it('applies backdropFilter with blur to the panel element', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      expect(panel.style.backdropFilter).toContain('blur');
    });

    it('applies a semi-transparent rgba background to the panel element', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      expect(panel.style.background).toContain('rgba');
    });

    it('applies a borderLeft style referencing the glass border', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      // borderLeft is set as "1px solid var(--glass-border)"
      expect(panel.style.borderLeft).toBeTruthy();
    });
  });

  // Req 18.1, 18.2 — NegotiationPanel
  describe('NegotiationPanel (Req 18.1, 18.2)', () => {
    it('applies backdropFilter with blur to the modal element', () => {
      render(
        <NegotiationPanel
          isOpen={true}
          suggestion={suggestion}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const modal = screen.getByTestId('negotiation-panel');
      expect(modal.style.backdropFilter).toContain('blur');
    });

    it('applies a semi-transparent rgba background to the modal element', () => {
      render(
        <NegotiationPanel
          isOpen={true}
          suggestion={suggestion}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const modal = screen.getByTestId('negotiation-panel');
      expect(modal.style.background).toContain('rgba');
    });
  });

  // Req 18.1, 18.2 — RenderDrawer
  describe('RenderDrawer (Req 18.1, 18.2)', () => {
    it('applies backdropFilter with blur to the drawer element', () => {
      render(
        <RenderDrawer
          isOpen={true}
          onClose={vi.fn()}
          documentId="doc-1"
          documentContent="content"
        />
      );
      const drawer = screen.getByTestId('render-drawer');
      expect(drawer.style.backdropFilter).toContain('blur');
    });

    it('applies a semi-transparent rgba background to the drawer element', () => {
      render(
        <RenderDrawer
          isOpen={true}
          onClose={vi.fn()}
          documentId="doc-1"
          documentContent="content"
        />
      );
      const drawer = screen.getByTestId('render-drawer');
      expect(drawer.style.background).toContain('rgba');
    });
  });
});

// ─── 2. Animation classes / styles ───────────────────────────────────────────

describe('Animation styles', () => {
  // Req 20.1, 20.2 — AuraSpherePanel slide animation
  describe('AuraSpherePanel slide animation (Req 20.1, 20.2)', () => {
    it('has transform translateX(100%) and opacity 0 when closed', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={false} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      expect(panel.style.transform).toBe('translateX(100%)');
      expect(panel.style.opacity).toBe('0');
    });

    it('has transform translateX(0) and opacity 1 when open', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      expect(panel.style.transform).toBe('translateX(0)');
      expect(panel.style.opacity).toBe('1');
    });
  });

  // Req 20.5 — Suggestion card stagger animation
  describe('Suggestion card stagger animation (Req 20.5)', () => {
    const threeSuggestions = [
      { id: '1', suggestedText: 'First', originalText: 'A', explanation: 'E1', confidenceScore: 0.9 },
      { id: '2', suggestedText: 'Second', originalText: 'B', explanation: 'E2', confidenceScore: 0.8 },
      { id: '3', suggestedText: 'Third', originalText: 'C', explanation: 'E3', confidenceScore: 0.7 },
    ];

    beforeEach(() => {
      mockInvoke.mockResolvedValue({ success: true, data: threeSuggestions });
    });

    it('each suggestion card has animation style containing card-fade-in', async () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      await waitFor(() => expect(screen.getAllByTestId('suggestion-card')).toHaveLength(3));
      const cards = screen.getAllByTestId('suggestion-card');
      for (const card of cards) {
        expect(card.style.animation).toContain('card-fade-in');
      }
    });

    it('second card (index 1) has animationDelay of 80ms', async () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      await waitFor(() => expect(screen.getAllByTestId('suggestion-card')).toHaveLength(3));
      const cards = screen.getAllByTestId('suggestion-card');
      expect(cards[1].style.animationDelay).toBe('80ms');
    });

    it('third card (index 2) has animationDelay of 160ms', async () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      await waitFor(() => expect(screen.getAllByTestId('suggestion-card')).toHaveLength(3));
      const cards = screen.getAllByTestId('suggestion-card');
      expect(cards[2].style.animationDelay).toBe('160ms');
    });
  });

  // Req 20.3 — NegotiationPanel fade-in animation
  describe('NegotiationPanel fade-in animation (Req 20.3)', () => {
    it('modal has animation style containing negotiation-fade-in', () => {
      render(
        <NegotiationPanel
          isOpen={true}
          suggestion={suggestion}
          onAccept={vi.fn()}
          onReject={vi.fn()}
          onClose={vi.fn()}
        />
      );
      const modal = screen.getByTestId('negotiation-panel');
      expect(modal.style.animation).toContain('negotiation-fade-in');
    });
  });

  // Req 20.4 — RenderDrawer slide-up animation
  describe('RenderDrawer slide-up animation (Req 20.4)', () => {
    it('has transform translateY(100%) when closed', () => {
      render(
        <RenderDrawer
          isOpen={false}
          onClose={vi.fn()}
          documentId="doc-1"
          documentContent="content"
        />
      );
      const drawer = screen.getByTestId('render-drawer');
      expect(drawer.style.transform).toBe('translateY(100%)');
    });

    it('has transform translateY(0) when open', () => {
      render(
        <RenderDrawer
          isOpen={true}
          onClose={vi.fn()}
          documentId="doc-1"
          documentContent="content"
        />
      );
      const drawer = screen.getByTestId('render-drawer');
      expect(drawer.style.transform).toBe('translateY(0)');
    });
  });
});

// ─── 3. Typography ────────────────────────────────────────────────────────────

describe('Typography styles', () => {
  // Req 19.1 — EditorCanvas textarea uses content font
  describe('EditorCanvas textarea font (Req 19.1)', () => {
    it('textarea has fontFamily referencing the content font (Newsreader or CSS var)', () => {
      render(
        <EditorCanvas
          document={makeDoc()}
          onDocumentChange={vi.fn()}
          onAITrigger={vi.fn()}
          isAIPanelOpen={false}
        />
      );
      const textarea = screen.getByRole('textbox', { name: /document editor/i });
      const fontFamily = textarea.style.fontFamily;
      expect(
        fontFamily.includes('var(--font-family-content)') || fontFamily.includes('Newsreader')
      ).toBe(true);
    });
  });

  // Req 19.2 — EditorCanvas metadata bar uses UI font
  describe('EditorCanvas metadata bar font (Req 19.2)', () => {
    it('metadata bar has fontFamily referencing the UI font (Manrope or CSS var)', () => {
      render(
        <EditorCanvas
          document={makeDoc()}
          onDocumentChange={vi.fn()}
          onAITrigger={vi.fn()}
          isAIPanelOpen={false}
        />
      );
      const metaBar = screen.getByRole('generic', { name: /document metadata/i });
      const fontFamily = metaBar.style.fontFamily;
      expect(
        fontFamily.includes('var(--font-family-ui)') || fontFamily.includes('Manrope')
      ).toBe(true);
    });
  });

  // Req 19.2 — AuraSpherePanel uses UI font
  describe('AuraSpherePanel font (Req 19.2)', () => {
    it('panel element has fontFamily referencing the UI font (Manrope or CSS var)', () => {
      render(<AuraSpherePanel {...defaultAuraSphereProps} isOpen={true} />);
      const panel = screen.getByTestId('aura-sphere-panel');
      const fontFamily = panel.style.fontFamily;
      expect(
        fontFamily.includes('var(--font-family-ui)') || fontFamily.includes('Manrope')
      ).toBe(true);
    });
  });

  // Req 19.5 — Font size scaling
  describe('Font size scaling (Req 19.5)', () => {
    it('textarea has fontSize 16px when fontSize prop is 16', () => {
      render(
        <EditorCanvas
          document={makeDoc()}
          onDocumentChange={vi.fn()}
          onAITrigger={vi.fn()}
          isAIPanelOpen={false}
          fontSize={16}
        />
      );
      const textarea = screen.getByRole('textbox', { name: /document editor/i });
      expect(textarea.style.fontSize).toBe('16px');
    });

    it('textarea has fontSize 22px when fontSize prop is 22', () => {
      render(
        <EditorCanvas
          document={makeDoc()}
          onDocumentChange={vi.fn()}
          onAITrigger={vi.fn()}
          isAIPanelOpen={false}
          fontSize={22}
        />
      );
      const textarea = screen.getByRole('textbox', { name: /document editor/i });
      expect(textarea.style.fontSize).toBe('22px');
    });
  });
});
