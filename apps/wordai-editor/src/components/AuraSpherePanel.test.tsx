/**
 * Unit tests for AuraSpherePanel component
 * Requirements: 5.4, 6.1, 7.1, 7.3, 23.2, 23.3, 23.4
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuraSpherePanel } from './AuraSpherePanel';
import type { AISuggestion, ChatMessage } from '../types/ai';
import type { IPCResponse } from '../types/ipc';

// ─── Tauri mock ───────────────────────────────────────────────────────────────

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<AISuggestion> = {}): AISuggestion {
  return {
    id: crypto.randomUUID(),
    suggestedText: 'Suggested text here',
    explanation: 'This improves clarity.',
    confidenceScore: 0.85,
    originalText: 'Original text',
    ...overrides,
  };
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  selection: null,
  documentId: 'doc-1',
  documentContext: 'Some document context',
  onSuggestionSelect: vi.fn(),
};

/** Wait until the initial suggestion request resolves (loading indicator gone) */
async function waitForLoad() {
  await waitFor(() =>
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
  );
}

// ─── Panel open/close (Req 5.4, 20.1, 20.2) ──────────────────────────────────

describe('AuraSpherePanel - visibility', () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue({ success: true, data: [] } satisfies IPCResponse<AISuggestion[]>);
  });

  it('renders the panel element', () => {
    render(<AuraSpherePanel {...defaultProps} />);
    expect(screen.getByTestId('aura-sphere-panel')).toBeInTheDocument();
  });

  it('is visible (aria-hidden=false) when isOpen=true', () => {
    render(<AuraSpherePanel {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId('aura-sphere-panel')).toHaveAttribute('aria-hidden', 'false');
  });

  it('is hidden (aria-hidden=true) when isOpen=false', () => {
    render(<AuraSpherePanel {...defaultProps} isOpen={false} />);
    expect(screen.getByTestId('aura-sphere-panel')).toHaveAttribute('aria-hidden', 'true');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /close ai panel/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed (Req 21.4)', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ─── AI request submission (Req 6.1, 16.4, 16.5) ─────────────────────────────

describe('AuraSpherePanel - AI request submission', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('shows loading indicator while request is in flight (Req 6.1)', async () => {
    mockInvoke.mockReturnValue(new Promise(() => { })); // never resolves
    render(<AuraSpherePanel {...defaultProps} />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });

  it('hides loading indicator after request resolves', async () => {
    mockInvoke.mockResolvedValue({ success: true, data: [] });
    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );
  });

  it('displays error message when request fails (Req 16.4)', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: { code: 'AI_ERROR', message: 'Service unavailable' },
    } satisfies IPCResponse<AISuggestion[]>);

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('error-message')).toHaveTextContent('Service unavailable')
    );
  });

  it('shows retry button on error (Req 16.5)', async () => {
    mockInvoke.mockResolvedValue({
      success: false,
      error: { code: 'AI_ERROR', message: 'Timeout' },
    } satisfies IPCResponse<AISuggestion[]>);

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    );
  });

  it('retries the request when retry button is clicked (Req 16.5)', async () => {
    const user = userEvent.setup();
    mockInvoke
      .mockResolvedValueOnce({ success: false, error: { code: 'ERR', message: 'fail' } })
      .mockResolvedValueOnce({ success: true, data: [] });

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() => expect(screen.getByTestId('retry-button')).toBeInTheDocument());

    const callsBefore = mockInvoke.mock.calls.length;
    await user.click(screen.getByTestId('retry-button'));
    await waitFor(() =>
      expect(mockInvoke.mock.calls.length).toBe(callsBefore + 1)
    );
  });
});

// ─── Suggestion card rendering (Req 7.1, 7.2, 7.3) ───────────────────────────

describe('AuraSpherePanel - suggestion cards', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('renders suggestion cards for each suggestion (Req 7.1)', async () => {
    const suggestions = [makeSuggestion(), makeSuggestion(), makeSuggestion()];
    mockInvoke.mockResolvedValue({ success: true, data: suggestions });

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() =>
      expect(screen.getAllByTestId('suggestion-card')).toHaveLength(3)
    );
  });

  it('displays suggested text and explanation on each card (Req 7.1)', async () => {
    const s = makeSuggestion({ suggestedText: 'Better phrasing', explanation: 'More concise' });
    mockInvoke.mockResolvedValue({ success: true, data: [s] });

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() => {
      expect(screen.getByText('Better phrasing')).toBeInTheDocument();
      expect(screen.getByText('More concise')).toBeInTheDocument();
    });
  });

  it('shows confidence score bar (Req 7.2)', async () => {
    const s = makeSuggestion({ confidenceScore: 0.72 });
    mockInvoke.mockResolvedValue({ success: true, data: [s] });

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() => {
      const fill = screen.getByTestId('confidence-fill');
      expect(fill).toHaveStyle({ width: '72%' });
    });
  });

  it('sorts suggestions by confidence score descending (Req 7.3)', async () => {
    const low = makeSuggestion({ suggestedText: 'Low confidence', confidenceScore: 0.3 });
    const high = makeSuggestion({ suggestedText: 'High confidence', confidenceScore: 0.9 });
    const mid = makeSuggestion({ suggestedText: 'Mid confidence', confidenceScore: 0.6 });
    mockInvoke.mockResolvedValue({ success: true, data: [low, high, mid] });

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() => {
      const cards = screen.getAllByTestId('suggestion-card');
      expect(within(cards[0]).getByText('High confidence')).toBeInTheDocument();
      expect(within(cards[1]).getByText('Mid confidence')).toBeInTheDocument();
      expect(within(cards[2]).getByText('Low confidence')).toBeInTheDocument();
    });
  });

  it('calls onSuggestionSelect when a card is clicked (Req 24.2)', async () => {
    const onSuggestionSelect: Mock = vi.fn();
    const s = makeSuggestion({ suggestedText: 'Click me' });
    mockInvoke.mockResolvedValue({ success: true, data: [s] });
    const user = userEvent.setup();

    render(<AuraSpherePanel {...defaultProps} onSuggestionSelect={onSuggestionSelect} />);
    await waitFor(() => screen.getByText('Click me'));
    await user.click(screen.getByTestId('suggestion-card'));
    expect(onSuggestionSelect).toHaveBeenCalledWith(s);
  });

  it('removes a card after dismiss is clicked (Req 24.3)', async () => {
    const s = makeSuggestion({ suggestedText: 'Dismiss me' });
    mockInvoke.mockResolvedValue({ success: true, data: [s] });
    const user = userEvent.setup();

    render(<AuraSpherePanel {...defaultProps} />);
    await waitFor(() => screen.getByText('Dismiss me'));

    await user.click(screen.getByRole('button', { name: /dismiss suggestion/i }));

    // After the 250ms fade-out the card is removed from state
    await waitFor(
      () => expect(screen.queryByTestId('suggestion-card')).not.toBeInTheDocument(),
      { timeout: 1000 }
    );
  });
});

// ─── Chat interface (Req 23.2, 23.3, 23.4) ───────────────────────────────────

describe('AuraSpherePanel - chat interface', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'request_ai_suggestion') {
        return Promise.resolve({ success: true, data: [] } satisfies IPCResponse<AISuggestion[]>);
      }
      if (cmd === 'send_chat_message') {
        return Promise.resolve({
          success: true,
          data: {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'AI response here',
            timestamp: new Date(),
          } satisfies ChatMessage,
        } satisfies IPCResponse<ChatMessage>);
      }
      return Promise.resolve({ success: true, data: null });
    });
  });

  it('renders the chat input field (Req 23.1)', async () => {
    render(<AuraSpherePanel {...defaultProps} />);
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('displays user message in chat history after sending (Req 23.3)', async () => {
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} />);
    // Wait for initial suggestion load so input is enabled
    await waitForLoad();

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Hello AI');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('chat-message-user')).toHaveTextContent('Hello AI')
    );
  });

  it('displays AI response in chat history (Req 23.4)', async () => {
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} />);
    await waitForLoad();

    await user.type(screen.getByTestId('chat-input'), 'Hello AI');
    await user.keyboard('{Enter}');

    await waitFor(() =>
      expect(screen.getByTestId('chat-message-assistant')).toHaveTextContent('AI response here')
    );
  });

  it('clears input after sending (Req 23.2)', async () => {
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} />);
    await waitForLoad();

    const input = screen.getByTestId('chat-input');
    await user.type(input, 'Hello');
    await user.keyboard('{Enter}');

    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('sends message via send button click (Req 23.2)', async () => {
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} />);
    await waitForLoad();

    await user.type(screen.getByTestId('chat-input'), 'Button send');
    await user.click(screen.getByTestId('send-button'));

    await waitFor(() =>
      expect(screen.getByTestId('chat-message-user')).toHaveTextContent('Button send')
    );
  });

  it('maintains chat history across multiple messages (Req 23.5)', async () => {
    const user = userEvent.setup();
    render(<AuraSpherePanel {...defaultProps} />);
    await waitForLoad();

    const input = screen.getByTestId('chat-input');

    await user.type(input, 'First message');
    await user.keyboard('{Enter}');
    await waitFor(() => screen.getByText('First message'));

    // Wait for AI response so input is re-enabled before next message
    await waitFor(() => screen.getAllByTestId('chat-message-assistant').length >= 1);

    await user.type(input, 'Second message');
    await user.keyboard('{Enter}');
    await waitFor(() => screen.getByText('Second message'));

    expect(screen.getByText('First message')).toBeInTheDocument();
    expect(screen.getByText('Second message')).toBeInTheDocument();
  });
});
