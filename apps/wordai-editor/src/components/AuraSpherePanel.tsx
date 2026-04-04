import { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { AISuggestion, ChatMessage, AIRequest } from '../types/ai';
import type { TextSelection } from '../types/document';

export interface AuraSpherePanelProps {
  isOpen: boolean;
  onClose: () => void;
  selection: TextSelection | null;
  documentId: string;
  documentContext: string;
  onSuggestionSelect: (suggestion: AISuggestion) => void;
}

type TabState = 'Assistant' | 'Analysis' | 'History';

export function AuraSpherePanel({
  isOpen,
  onClose,
  selection,
  documentId,
  documentContext,
  onSuggestionSelect,
}: AuraSpherePanelProps) {
  const [activeTab, setActiveTab] = useState<TabState>('Assistant');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, suggestions]);

  const sendChatToAI = useCallback(async (message: string) => {
    setIsLoading(true);
    setError(null);

    const newUserMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setChatHistory(prev => [...prev, newUserMsg]);
    setChatInput('');

    try {
      let context = documentContext;
      if (selection) {
        context = `Selected text: "${selection.text}"\n\nFull text:\n${documentContext}`;
      }

      const request: AIRequest = {
        prompt: message,
        context: context,
        documentId: documentId,
      };

      const response = await invoke<{ response: string, suggestions: any[] }>('ai_chat', { request });

      const newAiMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date()
      };

      setChatHistory(prev => [...prev, newAiMsg]);

      if (response.suggestions && response.suggestions.length > 0) {
        setSuggestions(response.suggestions);
      }
    } catch (err) {
      console.error('Failed to get AI response:', err);
      setError('AuraSphere failed to respond. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => { chatInputRef.current?.focus(); }, 10);
    }
  }, [documentContext, documentId, selection]);

  const handleSendChat = () => {
    if (!chatInput.trim() || isLoading) return;
    sendChatToAI(chatInput.trim());
  };

  const handleChatKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  if (!isOpen) return null;

  // ---- Demo placeholder messages for the Assistant tab ----
  const hasDemoContent = chatHistory.length === 0;
  const demoVersions = [
    { id: '1', label: 'Version 1', tag: 'Formal Editorial', text: 'The intersection of artificial intelligence and creative writing represents more than just a technological shift; it is a fundamental...' },
    { id: '2', label: 'Version 2', tag: 'Minimalist & Bold', text: 'In the age of algorithmic synthesis, the role of the author is evolving. AuraSphere serves as the bridge between raw creative instinct...' },
    { id: '3', label: 'Version 3', tag: 'Technical Visionary', text: 'Our architecture introduces the Liquid Data model to long-form content. This proposal outlines how AuraSphere recedes into the digital periphery...' },
  ];

  return (
    <aside
      className="fixed right-0 top-16 bottom-0 z-40 flex flex-col font-label"
      style={{
        width: '360px',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(199,196,215,0.15)',
        boxShadow: '0 40px 60px -5px rgba(67,67,213,0.08)',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{ padding: '24px', borderBottom: '1px solid rgba(199,196,215,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          {/* Blue circle avatar icon */}
          <div style={{
            width: 40, height: 40,
            borderRadius: '50%',
            background: '#5d5fef',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 20, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#4343d5', lineHeight: 1.2 }}>AuraSphere</h2>
            <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767586', opacity: 0.7, marginTop: 2 }}>AI Writing Partner</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#767586', padding: 4, display: 'flex' }}
            aria-label="Close panel"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* ── TABS ── */}
        <div style={{
          display: 'flex',
          background: '#edeeef',
          borderRadius: 8,
          padding: 4,
          gap: 2,
        }}>
          {(['Assistant', 'Analysis', 'History'] as TabState[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1,
                padding: '6px 4px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'all 0.15s ease',
                background: activeTab === tab ? 'rgba(255,255,255,0.5)' : 'transparent',
                color: activeTab === tab ? '#4343d5' : '#5a5a5a',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                opacity: activeTab === tab ? 1 : 0.7,
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── CONTENT AREA ── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ═══════════════ ASSISTANT TAB ═══════════════ */}
        {activeTab === 'Assistant' && (
          <>
            <div
              style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}
            >
              {hasDemoContent ? (
                <>
                  {/* Demo user message */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{
                      background: '#e7e8e9',
                      color: '#191c1d',
                      padding: '12px 16px',
                      borderRadius: '20px',
                      maxWidth: '90%',
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}>
                      Can you help me rewrite the introduction to sound more visionary and professional? Give me a few options.
                    </div>
                  </div>

                  {/* Demo AI response */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: 16, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4343d5' }}>AuraSphere AI</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 15, color: '#464555', lineHeight: 1.75 }}>
                      Certainly. I've drafted three distinct versions focusing on the 'Ethereal Editor' concept with varying levels of formality.
                    </p>

                    {/* Demo version cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {demoVersions.map(v => (
                        <div key={v.id} style={{
                          background: '#fff',
                          borderRadius: 12,
                          border: '1px solid rgba(199,196,215,0.25)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                          overflow: 'hidden',
                        }}>
                          <div style={{ padding: '16px 16px 12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#4343d5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{v.label}</span>
                              <span style={{ fontSize: 11, color: '#767586' }}>{v.tag}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: '#191c1d', lineHeight: 1.6 }}>{v.text}</p>
                          </div>
                          <button style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: 'rgba(67,67,213,0.05)',
                            border: 'none',
                            borderTop: '1px solid rgba(199,196,215,0.15)',
                            cursor: 'pointer',
                            color: '#4343d5',
                            fontSize: 13,
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                          }}>
                            View Version
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Real chat history */
                chatHistory.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  return isUser ? (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{
                        background: '#e7e8e9',
                        color: '#191c1d',
                        padding: '12px 16px',
                        borderRadius: '20px',
                        maxWidth: '90%',
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}>
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: 16, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4343d5' }}>AuraSphere AI</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 15, color: '#464555', lineHeight: 1.75 }}>{msg.content}</p>

                      {/* Suggestions as version cards after last AI message */}
                      {index === chatHistory.length - 1 && suggestions.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {suggestions.map((s, idx) => (
                            <div key={s.id} style={{
                              background: '#fff',
                              borderRadius: 12,
                              border: '1px solid rgba(199,196,215,0.25)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                              overflow: 'hidden',
                            }}>
                              <div style={{ padding: '16px 16px 12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4343d5', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Version {idx + 1}</span>
                                  <span style={{ fontSize: 11, color: '#767586' }}>{s.explanation || 'Suggested Edit'}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, color: '#191c1d', lineHeight: 1.6 }}>{s.suggestedText}</p>
                              </div>
                              <button
                                onClick={() => onSuggestionSelect(s)}
                                style={{
                                  width: '100%',
                                  padding: '10px 16px',
                                  background: 'rgba(67,67,213,0.05)',
                                  border: 'none',
                                  borderTop: '1px solid rgba(199,196,215,0.15)',
                                  cursor: 'pointer',
                                  color: '#4343d5',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 4,
                                }}
                              >
                                View Version
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: 16, fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4343d5' }}>AuraSphere AI</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)', animation: 'bounce 1.2s infinite' }}></div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)', animation: 'bounce 1.2s infinite 0.2s' }}></div>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(67,67,213,0.4)', animation: 'bounce 1.2s infinite 0.4s' }}></div>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ fontSize: 12, color: '#ba1a1a', padding: '8px 12px', background: '#ffdad6', borderRadius: 8 }}>
                  {error}
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* ── INPUT AREA ── */}
            <div style={{ padding: '24px', borderTop: '1px solid rgba(199,196,215,0.1)', flexShrink: 0 }}>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  disabled={isLoading}
                  placeholder="Ra lệnh (e.g., @Báo_cáo_Q1)"
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
                {/* Send button */}
                <button
                  onClick={handleSendChat}
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
                    transition: 'background 0.15s ease',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>north</span>
                </button>
                {/* Attach button */}
                <button style={{
                  position: 'absolute',
                  left: 12,
                  bottom: 12,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#767586',
                  display: 'flex',
                  opacity: 0.5,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 20 }}>attach_file</span>
                </button>
              </div>
              <p style={{
                margin: '12px 0 0',
                fontSize: 9,
                textAlign: 'center',
                color: '#464555',
                opacity: 0.4,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}>Press Cmd + K to trigger AI</p>
            </div>
          </>
        )}

        {/* ═══════════════ ANALYSIS TAB ═══════════════ */}
        {activeTab === 'Analysis' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#767586', opacity: 0.7 }}>Tone Analysis</h3>
                <span className="material-symbols-outlined" style={{ color: '#4343d5', fontSize: 16 }}>info</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { label: 'Primary Tone', value: 'Formal', pct: 82, color: '#4343d5' },
                  { label: 'Secondary', value: 'Evocative', pct: 64, color: '#575995' },
                ].map(t => (
                  <div key={t.label} style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid rgba(199,196,215,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#4343d5', textTransform: 'uppercase' }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#191c1d', fontFamily: 'Manrope, sans-serif' }}>{t.value}</p>
                    <div style={{ marginTop: 12, height: 4, background: '#e1e3e4', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${t.pct}%`, height: '100%', background: t.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ background: '#f3f4f5', borderRadius: 12, padding: 24, position: 'relative', overflow: 'hidden', border: '1px solid rgba(199,196,215,0.2)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#4343d5' }}>Reading Level</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: '#4343d5', fontFamily: 'Manrope, sans-serif', lineHeight: 1 }}>Grade 10</span>
                <span style={{ fontSize: 10, color: 'rgba(67,67,213,0.6)', fontWeight: 700, textTransform: 'uppercase' }}>Academic</span>
              </div>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#464555', lineHeight: 1.6, fontFamily: 'Newsreader, serif' }}>
                Your prose is sophisticated yet accessible. Ideal for editorial features.
              </p>
              <div style={{ position: 'absolute', right: -32, bottom: -32, width: 128, height: 128, background: 'rgba(67,67,213,0.05)', borderRadius: '50%', filter: 'blur(30px)' }} />
            </section>

            <section>
              <h3 style={{ margin: '0 0 16px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#767586', opacity: 0.7 }}>Editorial Sentiment</h3>
              <div style={{ background: '#fff', padding: 24, borderRadius: 12, border: '1px solid rgba(199,196,215,0.2)', height: 192, position: 'relative' }}>
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', padding: 24, boxSizing: 'border-box' }} preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0,70 Q15,60 25,40 T50,20 T75,50 T100,30" fill="none" stroke="#4343d5" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <circle cx="25" cy="40" fill="#4343d5" r="2" />
                  <circle cx="50" cy="20" fill="#4343d5" r="2" />
                </svg>
                <div style={{ position: 'absolute', bottom: 16, left: 24, right: 24, display: 'flex', justifyContent: 'space-between' }}>
                  {['Intro', 'Middle', 'Climax', 'Outro'].map(l => (
                    <span key={l} style={{ fontSize: 8, color: '#767586', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</span>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════ HISTORY TAB ═══════════════ */}
        {activeTab === 'History' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#767586' }}>Activity History</h3>
              <span className="material-symbols-outlined" style={{ color: 'rgba(67,67,213,0.4)', fontSize: 14, cursor: 'pointer' }}>filter_list</span>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#767586', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Today</div>
            </div>

            {[
              { icon: 'psychology', color: '#4343d5', label: 'Style Refinement', time: '14:22', text: '"Adjusted the tone to be more academic yet accessible..."', italic: true },
              { icon: 'edit_note', color: '#575995', label: 'Structural Shift', time: '11:05', text: 'Moved the "AuraSphere" paragraph to follow digital focus definition.', italic: false },
            ].map(item => (
              <div key={item.label} style={{
                background: '#fff',
                padding: 16,
                borderRadius: 12,
                border: '1px solid rgba(199,196,215,0.2)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                marginBottom: 10,
                cursor: 'default',
              }}
                className="group"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: item.color, fontVariationSettings: item.icon === 'psychology' ? "'FILL' 1" : "'FILL' 0" }}>{item.icon}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 9, color: '#767586' }}>{item.time}</span>
                </div>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#191c1d', lineHeight: 1.6, fontStyle: item.italic ? 'italic' : 'normal' }}>{item.text}</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ flex: 1, padding: '8px 0', background: 'rgba(67,67,213,0.05)', color: '#4343d5', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Apply</button>
                  <button style={{ flex: 1, padding: '8px 0', background: '#edeeef', color: '#464555', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Revisit</button>
                </div>
              </div>
            ))}

            <div style={{ position: 'relative', marginTop: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#767586', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>Yesterday</div>
            </div>

            <div style={{ background: '#fff', padding: 16, borderRadius: 12, border: '1px solid rgba(199,196,215,0.2)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#b65700' }}>history_edu</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#b65700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Contextual Injection</span>
                </div>
                <span style={{ fontSize: 9, color: '#767586' }}>Oct 12</span>
              </div>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#191c1d', lineHeight: 1.6 }}>Added references to monastic cells and private libraries.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, padding: '8px 0', background: 'rgba(67,67,213,0.05)', color: '#4343d5', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Apply</button>
                <button style={{ flex: 1, padding: '8px 0', background: '#edeeef', color: '#464555', border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Revisit</button>
              </div>
            </div>

            {/* Suggestion banner */}
            <div style={{
              position: 'relative',
              padding: 16,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4343d5, #5d5fef)',
              color: '#fff',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(67,67,213,0.2)',
            }}>
              <div style={{ position: 'absolute', right: -16, top: -16, width: 64, height: 64, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', filter: 'blur(16px)' }} />
              <p style={{ margin: '0 0 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.8 }}>Aura Suggestion</p>
              <p style={{ margin: '0 0 12px', fontSize: 11, lineHeight: 1.5, fontWeight: 500 }}>You've visited the "Negotiated" version 3 times. Merge permanently?</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, fontSize: 9, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>Yes, Merge</button>
                <button style={{ padding: '4px 12px', background: 'transparent', border: 'none', borderRadius: 6, fontSize: 9, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: 0.8 }}>Browse</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AuraSpherePanel;
