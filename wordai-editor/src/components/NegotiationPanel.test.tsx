/**
 * Unit tests for NegotiationPanel component
 * Requirements: 8.2, 8.3, 9.1, 9.2, 10.1, 10.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NegotiationPanel } from './NegotiationPanel';
import type { AISuggestion } from '../types/ai';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<AISuggestion> = {}): AISuggestion {
  return {
    id: 'test-id',
    originalText: 'The quick brown fox',
    suggestedText: 'The fast brown fox',
    explanation: 'More precise word choice.',
    confidenceScore: 0.9,
    ...overrides,
  };
}

const defaultProps = {
  isOpen: true,
  suggestion: makeSuggestion(),
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Visibility ───────────────────────────────────────────────────────────────

describe('NegotiationPanel - visibility', () => {
  it('renders modal when isOpen=true', () => {
    render(<NegotiationPanel {...defaultProps} />);
    expect(screen.getByTestId('negotiation-panel')).toBeInTheDocument();
  });

  it('does not render when isOpen=false', () => {
    render(<NegotiationPanel {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('negotiation-panel')).not.toBeInTheDocument();
  });
});

// ─── Text comparison display (Req 8.2, 8.3, 8.4) ─────────────────────────────

describe('NegotiationPanel - text comparison', () => {
  it('displays original text', () => {
    const suggestion = makeSuggestion({ originalText: 'Hello world today' });
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} />);
    const originalContainer = screen.getByTestId('original-text');
    expect(originalContainer).toBeInTheDocument();
    // Words from original text should appear
    expect(originalContainer.textContent).toContain('Hello');
  });

  it('displays suggested text', () => {
    const suggestion = makeSuggestion({ suggestedText: 'Hello universe today' });
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} />);
    const suggestedContainer = screen.getByTestId('suggested-text');
    expect(suggestedContainer).toBeInTheDocument();
    expect(suggestedContainer.textContent).toContain('Hello');
  });

  it('highlights differences between original and suggested text', () => {
    const suggestion = makeSuggestion({
      originalText: 'The quick brown fox',
      suggestedText: 'The fast brown fox',
    });
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} />);

    // "quick" should be in original with strikethrough
    const originalContainer = screen.getByTestId('original-text');
    const removedSpans = originalContainer.querySelectorAll('span[style*="line-through"]');
    expect(removedSpans.length).toBeGreaterThan(0);

    // "fast" should be in suggested marked as added
    const suggestedContainer = screen.getByTestId('suggested-text');
    const addedSpans = suggestedContainer.querySelectorAll('span[data-diff="added"]');
    expect(addedSpans.length).toBeGreaterThan(0);
  });
});

// ─── Accept action (Req 9.1, 9.2) ────────────────────────────────────────────

describe('NegotiationPanel - Accept action', () => {
  it('calls onAccept with suggestedText when Accept clicked', async () => {
    const onAccept = vi.fn();
    const suggestion = makeSuggestion({ suggestedText: 'The fast brown fox' });
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} onAccept={onAccept} />);

    await user.click(screen.getByTestId('accept-button'));
    expect(onAccept).toHaveBeenCalledWith('The fast brown fox');
  });

  it('calls onAccept with edited text when in edit mode', async () => {
    const onAccept = vi.fn();
    const suggestion = makeSuggestion({ suggestedText: 'The fast brown fox' });
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} onAccept={onAccept} />);

    // Enter edit mode
    await user.click(screen.getByTestId('edit-button'));
    const textarea = screen.getByTestId('edit-textarea');

    // Clear and type new text
    await user.clear(textarea);
    await user.type(textarea, 'A completely new sentence');

    await user.click(screen.getByTestId('accept-button'));
    expect(onAccept).toHaveBeenCalledWith('A completely new sentence');
  });
});

// ─── Reject action (Req 10.1) ─────────────────────────────────────────────────

describe('NegotiationPanel - Reject action', () => {
  it('calls onReject when Reject clicked', async () => {
    const onReject = vi.fn();
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} onReject={onReject} />);

    await user.click(screen.getByTestId('reject-button'));
    expect(onReject).toHaveBeenCalledOnce();
  });
});

// ─── Edit action (Req 10.2) ───────────────────────────────────────────────────

describe('NegotiationPanel - Edit action', () => {
  it('enables edit mode when Edit clicked', async () => {
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} />);

    await user.click(screen.getByTestId('edit-button'));
    expect(screen.getByTestId('edit-textarea')).toBeInTheDocument();
  });

  it('pre-fills textarea with suggestedText in edit mode', async () => {
    const suggestion = makeSuggestion({ suggestedText: 'The fast brown fox' });
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} suggestion={suggestion} />);

    await user.click(screen.getByTestId('edit-button'));
    expect(screen.getByTestId('edit-textarea')).toHaveValue('The fast brown fox');
  });
});

// ─── Escape key (Req 21.4) ────────────────────────────────────────────────────

describe('NegotiationPanel - Escape key', () => {
  it('calls onClose when Escape pressed', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<NegotiationPanel {...defaultProps} onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});
