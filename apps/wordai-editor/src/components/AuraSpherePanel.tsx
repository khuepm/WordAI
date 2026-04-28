/**
 * AuraSpherePanel - AI writing assistant panel
 * Requirements: 5.4, 6.1, 7.1, 7.2, 7.3, 13.8, 13.9, 13.10, 13.11, 16.4, 16.5, 18.1, 18.2, 18.3,
 *               19.2, 20.1, 20.2, 20.5, 21.4, 23.1–23.5, 24.2, 24.3
 */

import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';
import type { AISuggestion, ChatMessage } from '../types/ai';
import type { TextSelection } from '../types/document';
import { AIAccessGate } from './AIAccessGate';

export interface AuraSpherePanelProps {
  isOpen: boolean;
  onClose: () => void;
  selection: TextSelection | null;
  documentId: string;
  documentContext: string;
  onSuggestionSelect: (suggestion: AISuggestion) => void;
}

export function AuraSpherePanel({
  isOpen,
  onClose,
  selection,
  documentId,
  documentContext,
  onSuggestionSelect,
}: AuraSpherePanelProps) {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { t } = useTranslation();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when chat updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, suggestions]);

  // Escape key closes panel (Req 21.4)
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load initial suggestions when panel opens (Req 6.1)
  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const context = selection
        ? `Selected text: "${selection.text}"\n\nFull text:\n${documentContext}`
        : documentContext;
      const response = await invoke<{ success: boolean; data?: AISuggestion[]; error?: { code: string; message: string } }>(
        'request_ai_suggestion',
        { documentId, context }
      );
      if (response.success && response.data) {
        // Sort by confidence descending (Req 7.3)
        const sorted = [...response.data].sort((a, b) => b.confidenceScore - a.confidenceScore);
        setSuggestions(sorted);
      } else if (!response.success && response.error) {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AuraSphere failed to respond.');
    } finally {
      setIsLoading(false);
    }
  }, [documentId, documentContext, selection]);

  useEffect(() => {
    if (isOpen) {
      loadSuggestions();
    }
  }, [isOpen, loadSuggestions]);

  const sendChat = useCallback(async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);

    try {
      const response = await invoke<{ success: boolean; data?: ChatMessage; error?: { code: string; message: string } }>(
        'send_chat_message',
        { documentId, message, context: documentContext }
      );
      if (response.success && response.data) {
        setChatHistory(prev => [...prev, response.data!]);
      } else if (!response.success && response.error) {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message.');
    } finally {
      setIsLoading(false);
      setTimeout(() => chatInputRef.current?.focus(), 10);
    }
  }, [documentId, documentContext, isLoading]);

  const handleChatKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat(chatInput);
    }
  };

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
    setTimeout(() => {
      setSuggestions(prev => prev.filter(s => s.id !== id));
      setDismissedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 250);
  };

  const visibleSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  return (
    <aside
      data-testid="aura-sphere-panel"
      aria-hidden={!isOpen ? 'true' : 'false'}
      style={{
        position: 'fixed',
        right: 0,
        top: 'var(--topnav-height, 56px)',
        bottom: 0,
        width: '360px',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(199,196,215,0.15)',
        boxShadow: '0 40px 60px -5px rgba(67,67,213,0.08)',
        fontFamily: 'var(--font-family-ui)',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        opacity: isOpen ? 1 : 0,
        transition: 'transform 0.25s ease, opacity 0.25s ease',
        pointerEvents: isOpen ? 'auto' : 'none',
      }}
    >
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(199,196,215,0.1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: '#5d5fef',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#4343d5', lineHeight: 1.2 }}>AuraSphere</h2>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767586', opacity: 0.7, marginTop: 2 }}>{t('auraPanel.subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            aria-label={t('auraPanel.closeAriaLabel')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767586', padding: 4, display: 'flex' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <AIAccessGate>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Loading indicator */}
            {isLoading && (
              <div data-testid="loading-indicator" style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)' }} />
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)' }} />
              </div>
            )}

            {/* Error message */}
            {error && (
              <div>
                <div data-testid="error-message" style={{ fontSize: 12, color: '#ba1a1a', padding: '8px 12px', background: '#ffdad6', borderRadius: 8 }}>
                  {error}
                </div>
                <button
                  data-testid="retry-button"
                  onClick={loadSuggestions}
                  style={{ marginTop: 8, padding: '6px 12px', background: '#4343d5', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
                >
                  {t('auraPanel.retryButton')}
                </button>
              </div>
            )}

            {/* Suggestion cards (Req 7.1, 7.2, 7.3) */}
            {visibleSuggestions.map((s, idx) => (
              <div
                key={s.id}
                data-testid="suggestion-card"
                onClick={() => onSuggestionSelect(s)}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid rgba(199,196,215,0.25)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  animation: 'card-fade-in 0.3s ease forwards',
                  animationDelay: `${idx * 80}ms`,
                  opacity: dismissedIds.has(s.id) ? 0 : 1,
                  transition: 'opacity 0.25s ease',
                }}
              >
                <div style={{ padding: '16px 16px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4343d5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {s.explanation}
                    </span>
                    <button
                      aria-label={t('auraPanel.dismissSuggestion')}
                      onClick={(e) => { e.stopPropagation(); handleDismiss(s.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767586', padding: 2, display: 'flex' }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: '#191c1d', lineHeight: 1.6 }}>{s.suggestedText}</p>
                  {/* Confidence bar (Req 7.2) */}
                  <div style={{ marginTop: 8, height: 4, background: '#e1e3e4', borderRadius: 4, overflow: 'hidden' }}>
                    <div
                      data-testid="confidence-fill"
                      style={{ width: `${Math.round(s.confidenceScore * 100)}%`, height: '100%', background: '#4343d5', borderRadius: 4 }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Chat history */}
            {chatHistory.map((msg) => (
              msg.role === 'user' ? (
                <div key={msg.id} data-testid="chat-message-user" style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ background: '#e7e8e9', color: '#191c1d', padding: '12px 16px', borderRadius: '20px', maxWidth: '90%', fontSize: 14, lineHeight: 1.6 }}>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} data-testid="chat-message-assistant" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: 16, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4343d5' }}>AuraSphere AI</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, color: '#464555', lineHeight: 1.75 }}>{msg.content}</p>
                </div>
              )
            ))}

            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div style={{ padding: '24px', borderTop: '1px solid rgba(199,196,215,0.1)', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={chatInputRef}
                data-testid="chat-input"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={handleChatKeyDown}
                disabled={isLoading}
                placeholder={t('auraPanel.chatPlaceholder')}
                rows={3}
                style={{
                  width: '100%',
                  background: '#f3f4f5',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px 48px 14px 16px',
                  fontSize: 13,
                  color: '#191c1d',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  boxSizing: 'border-box',
                }}
              />
              <button
                data-testid="send-button"
                onClick={() => sendChat(chatInput)}
                disabled={isLoading || !chatInput.trim()}
                style={{
                  position: 'absolute',
                  right: 12,
                  bottom: 12,
                  width: 32, height: 32,
                  borderRadius: '50%',
                  background: chatInput.trim() ? '#4343d5' : '#c7c4d7',
                  border: 'none',
                  cursor: chatInput.trim() ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>north</span>
              </button>
            </div>
          </div>
        </div>
      </AIAccessGate>
    </aside>
  );
}
