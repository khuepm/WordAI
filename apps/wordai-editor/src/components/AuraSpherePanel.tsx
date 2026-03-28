/**
 * AuraSpherePanel - AI assistant sidebar with chat interface and suggestion cards
 * Requirements: 5.4, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 7.5, 16.4, 16.5,
 *               18.1, 19.2, 20.1, 20.2, 23.1–23.5, 24.1–24.5
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  KeyboardEvent,
} from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AISuggestion, ChatMessage, AIRequest } from '../types/ai';
import type { TextSelection } from '../types/document';
import type { IPCResponse } from '../types/ipc';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AuraSpherePanelProps {
  isOpen: boolean;
  onClose: () => void;
  selection: TextSelection | null;
  documentId: string;
  documentContext: string;
  /** Called when user clicks a suggestion card — parent opens NegotiationPanel */
  onSuggestionSelect: (suggestion: AISuggestion) => void;
}

// ─── SuggestionCard sub-component ────────────────────────────────────────────

interface SuggestionCardProps {
  suggestion: AISuggestion;
  isFocused: boolean;
  onSelect: (s: AISuggestion) => void;
  onDismiss: (id: string) => void;
  animationIndex: number;
}

function SuggestionCard({ suggestion, isFocused, onSelect, onDismiss, animationIndex }: SuggestionCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDismissed(true);
      // Wait for fade-out animation before removing (Req 24.3)
      setTimeout(() => onDismiss(suggestion.id), 250);
    },
    [suggestion.id, onDismiss]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(suggestion);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDismiss(e as unknown as React.MouseEvent);
      }
    },
    [suggestion, onSelect, handleDismiss]
  );

  const pct = Math.round(suggestion.confidenceScore * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`AI suggestion: ${suggestion.suggestedText.slice(0, 60)}`}
      data-testid="suggestion-card"
      onClick={() => onSelect(suggestion)}
      onKeyDown={handleKeyDown}
      style={{
        ...cardStyles.card,
        animation: 'card-fade-in 250ms ease-out both',
        animationDelay: `${animationIndex * 80}ms`,
        ...(isFocused ? cardStyles.cardFocused : {}),
        ...(dismissed ? cardStyles.cardDismissed : {}),
      }}
    >
      {/* Suggested text preview */}
      <p style={cardStyles.suggestedText}>{suggestion.suggestedText}</p>

      {/* Explanation */}
      {suggestion.explanation && (
        <p style={cardStyles.explanation}>{suggestion.explanation}</p>
      )}

      {/* Confidence score bar (Req 7.2) */}
      <div style={cardStyles.confidenceRow} aria-label={`Confidence: ${pct}%`}>
        <div style={cardStyles.confidenceBar}>
          <div
            style={{ ...cardStyles.confidenceFill, width: `${pct}%` }}
            data-testid="confidence-fill"
          />
        </div>
        <span style={cardStyles.confidenceLabel}>{pct}%</span>
      </div>

      {/* Dismiss button */}
      <button
        style={cardStyles.dismissBtn}
        onClick={handleDismiss}
        aria-label="Dismiss suggestion"
        tabIndex={-1}
      >
        ✕
      </button>
    </div>
  );
}

// ─── AuraSpherePanel ─────────────────────────────────────────────────────────

export function AuraSpherePanel({
  isOpen,
  onClose,
  selection,
  documentId,
  documentContext,
  onSuggestionSelect,
}: AuraSpherePanelProps) {
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(-1);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom on new messages (scrollIntoView may be absent in test env)
  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [chatHistory]);

  // Focus chat input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => chatInputRef.current?.focus(), 320);
    }
  }, [isOpen]);

  // Request AI suggestions when panel opens with a selection (Req 6.1, 6.2)
  useEffect(() => {
    if (!isOpen) return;
    if (!selection?.text && !documentContext) return;

    const req: AIRequest = {
      documentId,
      selectedText: selection?.text,
      context: documentContext,
    };

    setIsLoading(true);
    setError(null);

    invoke<IPCResponse<AISuggestion[]>>('request_ai_suggestion', { request: req })
      .then((res) => {
        if (res.success && res.data) {
          // Sort by confidence descending (Req 7.3)
          const sorted = [...res.data].sort((a, b) => b.confidenceScore - a.confidenceScore);
          setSuggestions(sorted);
        } else {
          setError(res.error?.message ?? 'Failed to get suggestions.');
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
      })
      .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Dismiss a suggestion card (Req 24.3)
  const handleDismiss = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  // Retry AI request (Req 16.5)
  const handleRetry = useCallback(() => {
    if (!selection?.text && !documentContext) return;
    const req: AIRequest = {
      documentId,
      selectedText: selection?.text,
      context: documentContext,
    };
    setIsLoading(true);
    setError(null);
    invoke<IPCResponse<AISuggestion[]>>('request_ai_suggestion', { request: req })
      .then((res) => {
        if (res.success && res.data) {
          const sorted = [...res.data].sort((a, b) => b.confidenceScore - a.confidenceScore);
          setSuggestions(sorted);
        } else {
          setError(res.error?.message ?? 'Failed to get suggestions.');
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setIsLoading(false));
  }, [documentId, documentContext, selection]);

  // Send chat message (Req 23.2, 23.3, 23.4)
  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);

    try {
      const req: AIRequest = {
        documentId,
        context: documentContext,
        prompt: text,
        chatHistory: [...chatHistory, userMsg],
      };
      const res = await invoke<IPCResponse<ChatMessage>>('send_chat_message', { request: req });
      if (res.success && res.data) {
        setChatHistory((prev) => [...prev, res.data!]);
      } else {
        const errMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: res.error?.message ?? 'Something went wrong.',
          timestamp: new Date(),
        };
        setChatHistory((prev) => [...prev, errMsg]);
      }
    } catch (err: unknown) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Something went wrong.',
        timestamp: new Date(),
      };
      setChatHistory((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [chatInput, chatHistory, documentId, documentContext]);

  const handleChatKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendChat();
      }
    },
    [handleSendChat]
  );

  // Escape key closes the panel (Req 21.4) — attached to document so it fires
  // regardless of which element has focus inside the panel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Arrow-key navigation between suggestion cards (Req 24.4, 24.5)
  const handlePanelKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (suggestions.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedCardIndex((i) => Math.min(i + 1, suggestions.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedCardIndex((i) => Math.max(i - 1, 0));
      }
    },
    [suggestions.length]
  );

  return (
    <div
      role="complementary"
      aria-label="AuraSphere AI assistant panel"
      aria-hidden={!isOpen}
      data-testid="aura-sphere-panel"
      style={{
        ...panelStyles.panel,
        ...(isOpen ? panelStyles.panelOpen : panelStyles.panelClosed),
      }}
      onKeyDown={handlePanelKeyDown}
    >
      {/* Header */}
      <div style={panelStyles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'var(--md-sys-color-primary-container)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--md-sys-color-on-primary-container)', fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>AuraSphere</div>
            <div style={{ fontSize: '0.6rem', fontFamily: 'var(--font-family-label)', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#5a5a5a', opacity: 0.7 }}>AI Writing Partner</div>
          </div>
          <button
            style={{ ...panelStyles.closeBtn, marginLeft: 'auto' }}
            onClick={onClose}
            aria-label="Close AI panel"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--md-sys-color-surface-container)', borderRadius: 'var(--radius-md)', padding: '4px', gap: '2px' }}>
          {['Assistant', 'Analysis', 'History'].map((tab) => (
            <button key={tab} style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '0.65rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              background: tab === 'Assistant' ? 'rgba(255,255,255,0.5)' : 'transparent',
              color: tab === 'Assistant' ? 'var(--md-sys-color-primary)' : '#5a5a5a',
              fontFamily: 'var(--font-family-label)',
            }}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Suggestions area */}
      <div style={panelStyles.suggestionsArea} aria-label="AI suggestions">
        {isLoading && (
          <div style={panelStyles.loadingIndicator} role="status" aria-live="polite" data-testid="loading-indicator">
            <span style={panelStyles.spinner} aria-hidden="true" />
            <span>Thinking…</span>
          </div>
        )}

        {error && !isLoading && (
          <div style={panelStyles.errorBox} role="alert" data-testid="error-message">
            <p style={panelStyles.errorText}>{error}</p>
            <button style={panelStyles.retryBtn} onClick={handleRetry} data-testid="retry-button">
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && suggestions.length === 0 && (
          <p style={panelStyles.emptyHint}>
            {selection?.text
              ? 'No suggestions yet. Ask me anything below.'
              : 'Select text and press Cmd+K, or ask me anything below.'}
          </p>
        )}

        {suggestions.map((s, idx) => (
          <SuggestionCard
            key={s.id}
            suggestion={s}
            isFocused={focusedCardIndex === idx}
            onSelect={onSuggestionSelect}
            onDismiss={handleDismiss}
            animationIndex={idx}
          />
        ))}
      </div>

      {/* Chat history */}
      {chatHistory.length > 0 && (
        <div style={panelStyles.chatHistory} aria-label="Chat history" data-testid="chat-history">
          {chatHistory.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...panelStyles.chatBubble,
                ...(msg.role === 'user' ? panelStyles.chatBubbleUser : panelStyles.chatBubbleAssistant),
              }}
              data-testid={`chat-message-${msg.role}`}
            >
              {msg.content}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      )}

      {/* Chat input (Req 23.1) */}
      <div style={{ padding: 'var(--spacing-md) var(--spacing-lg)', borderTop: '1px solid rgba(199,196,215,0.1)', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={chatInputRef as unknown as React.RefObject<HTMLTextAreaElement>}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown as unknown as React.KeyboardEventHandler<HTMLTextAreaElement>}
            placeholder="Ask AuraSphere… (e.g. @Document)"
            style={{
              width: '100%',
              background: 'var(--md-sys-color-surface-container-low)',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem 3rem 1rem 1rem',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family-label)',
              color: 'var(--md-sys-color-on-surface)',
              resize: 'none',
              minHeight: '80px',
              outline: 'none',
            }}
            aria-label="Chat input"
            data-testid="chat-input"
            disabled={isLoading}
          />
          <button
            style={{
              position: 'absolute',
              right: '0.75rem',
              bottom: '0.75rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={handleSendChat}
            disabled={isLoading || !chatInput.trim()}
            aria-label="Send message"
            data-testid="send-button"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>north</span>
          </button>
        </div>
        <p style={{ fontSize: '0.6rem', textAlign: 'center', marginTop: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'var(--font-family-label)' }}>
          Press Cmd + K to trigger AI
        </p>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const panelStyles: Record<string, React.CSSProperties> = {
  panel: {
    position: 'fixed',
    top: 'var(--topnav-height)',
    right: 0,
    bottom: 0,
    width: 'var(--right-panel-width)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'var(--font-family-ui)',
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderLeft: '1px solid rgba(199, 196, 215, 0.15)',
    boxShadow: 'var(--shadow-ambient-strong)',
    transition: 'transform var(--transition-normal), opacity var(--transition-normal)',
    zIndex: 40,
    overflow: 'hidden',
  },
  panelOpen: {
    transform: 'translateX(0)',
    opacity: 1,
    pointerEvents: 'auto',
  },
  panelClosed: {
    transform: 'translateX(100%)',
    opacity: 0,
    pointerEvents: 'none',
  },
  header: {
    padding: 'var(--spacing-lg)',
    borderBottom: '1px solid rgba(199, 196, 215, 0.1)',
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 600,
    color: 'var(--md-sys-color-on-surface)',
    letterSpacing: '0.02em',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-base)',
    padding: 'var(--spacing-xs)',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  suggestionsArea: {
    flex: 1,
    overflowY: 'auto',
    padding: 'var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  loadingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-sm)',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-sm)',
    padding: 'var(--spacing-md)',
  },
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid var(--md-sys-color-outline-variant)',
    borderTopColor: 'var(--md-sys-color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  errorBox: {
    background: 'var(--md-sys-color-error-container)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-sm)',
  },
  errorText: {
    margin: 0,
    color: 'var(--md-sys-color-on-error-container)',
    fontSize: 'var(--font-size-sm)',
  },
  retryBtn: {
    alignSelf: 'flex-start',
    background: 'var(--md-sys-color-error)',
    color: 'var(--md-sys-color-on-error)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: 'var(--spacing-xs) var(--spacing-md)',
    cursor: 'pointer',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
  },
  emptyHint: {
    margin: 0,
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-sm)',
    textAlign: 'center',
    padding: 'var(--spacing-xl) var(--spacing-md)',
    opacity: 0.7,
  },
  chatHistory: {
    maxHeight: '220px',
    overflowY: 'auto',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--spacing-xs)',
    borderTop: '1px solid var(--md-sys-color-outline-variant)',
  },
  chatBubble: {
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    fontSize: 'var(--font-size-sm)',
    maxWidth: '90%',
    wordBreak: 'break-word',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    background: 'var(--md-sys-color-primary-container)',
    color: 'var(--md-sys-color-on-primary-container)',
  },
  chatBubbleAssistant: {
    alignSelf: 'flex-start',
    background: 'var(--md-sys-color-surface-variant)',
    color: 'var(--md-sys-color-on-surface-variant)',
  },
  chatInputRow: {
    display: 'flex',
    gap: 'var(--spacing-xs)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderTop: '1px solid var(--md-sys-color-outline-variant)',
    flexShrink: 0,
  },
  chatInput: {
    flex: 1,
    border: '1px solid var(--md-sys-color-outline-variant)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--spacing-xs) var(--spacing-sm)',
    fontFamily: 'var(--font-family-ui)',
    fontSize: 'var(--font-size-sm)',
    background: 'rgba(255,255,255,0.5)',
    color: 'var(--md-sys-color-on-surface)',
    outline: 'none',
  },
  sendBtn: {
    background: 'var(--md-sys-color-primary)',
    color: 'var(--md-sys-color-on-primary)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    width: '36px',
    height: '36px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
};

const cardStyles: Record<string, React.CSSProperties> = {
  card: {
    position: 'relative',
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid var(--glass-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--spacing-md)',
    cursor: 'pointer',
    transition: 'box-shadow var(--transition-fast), opacity 250ms ease',
    outline: 'none',
  },
  cardFocused: {
    // Hover/focus glow (Req 7.4, 24.1, 24.5)
    boxShadow: 'var(--shadow-glow)',
    border: '1px solid var(--md-sys-color-primary)',
  },
  cardDismissed: {
    opacity: 0,
    pointerEvents: 'none',
  },
  suggestedText: {
    margin: '0 0 var(--spacing-xs)',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--md-sys-color-on-surface)',
    lineHeight: 'var(--line-height-normal)',
    // Clamp to 3 lines
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  explanation: {
    margin: '0 0 var(--spacing-sm)',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    lineHeight: 'var(--line-height-normal)',
  },
  confidenceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--spacing-xs)',
  },
  confidenceBar: {
    flex: 1,
    height: '4px',
    background: 'var(--md-sys-color-outline-variant)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    background: 'var(--md-sys-color-primary)',
    borderRadius: '2px',
    transition: 'width var(--transition-fast)',
  },
  confidenceLabel: {
    fontSize: 'var(--font-size-xs)',
    color: 'var(--md-sys-color-on-surface-variant)',
    minWidth: '28px',
    textAlign: 'right',
  },
  dismissBtn: {
    position: 'absolute',
    top: 'var(--spacing-xs)',
    right: 'var(--spacing-xs)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--md-sys-color-on-surface-variant)',
    fontSize: 'var(--font-size-xs)',
    padding: '2px 4px',
    borderRadius: 'var(--radius-sm)',
    opacity: 0.6,
    lineHeight: 1,
  },
};

export default AuraSpherePanel;
