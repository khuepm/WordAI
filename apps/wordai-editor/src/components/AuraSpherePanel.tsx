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
  onSuggestionSelect: (suggestion: AISuggestion) => void;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TabState = 'Assistant' | 'Analysis' | 'History';

// ─── Sub-Components ──────────────────────────────────────────────────────────


function SuggestionCard({ suggestion, isFocused, onSelect, onDismiss, animationIndex }: { suggestion: AISuggestion; isFocused: boolean; onSelect: (s: AISuggestion) => void; onDismiss: (id: string) => void; animationIndex: number; }) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed(true);
    setTimeout(() => onDismiss(suggestion.id), 250);
  }, [suggestion.id, onDismiss]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(suggestion);
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handleDismiss(e as unknown as React.MouseEvent);
    }
  }, [suggestion, onSelect, handleDismiss]);

  const pct = Math.round(suggestion.confidenceScore * 100);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`relative bg-white/55 backdrop-blur-md border border-white/20 rounded-xl p-4 cursor-pointer outline-none transition-all duration-250 ${isFocused ? 'shadow-[0_0_15px_rgba(67,67,213,0.3)] border-primary' : ''} ${dismissed ? 'opacity-0 pointer-events-none' : 'opacity-100'} animate-[card-fade-in_250ms_ease-out_both]`}
      style={{ animationDelay: `${animationIndex * 80}ms` }}
      onClick={() => onSelect(suggestion)}
      onKeyDown={handleKeyDown}
    >
      <p className="m-0 mb-1 text-sm text-on-surface leading-normal line-clamp-3 overflow-hidden">{suggestion.suggestedText}</p>
      {suggestion.explanation && <p className="m-0 mb-2 text-xs text-on-surface-variant leading-normal">{suggestion.explanation}</p>}
      <div className="flex items-center gap-1">
        <div className="flex-1 h-1 bg-outline-variant rounded-sm overflow-hidden">
          <div className="h-full bg-primary rounded-sm transition-all duration-200" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-on-surface-variant min-w-[28px] text-right">{pct}%</span>
      </div>
      <button
        className="absolute top-1 right-1 bg-transparent border-none cursor-pointer text-on-surface-variant text-[10px] p-1 rounded-sm opacity-60 leading-none"
        onClick={handleDismiss}
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
  // App State
  const [activeTab, setActiveTab] = useState<TabState>('Assistant');
  
  // Assistant State
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
    if (isOpen && activeTab === 'Assistant') {
      setTimeout(() => chatInputRef.current?.focus(), 320);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (!isOpen) return;
    if (!selection?.text && !documentContext) return;

    const req: AIRequest = { documentId, selectedText: selection?.text, context: documentContext };
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
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setIsLoading(false));
  }, [isOpen, documentId, documentContext, selection]);

  const handleDismiss = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleSendChat = useCallback(async () => {
    const text = chatInput.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
    setChatHistory((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);
    try {
      const req: AIRequest = { documentId, context: documentContext, prompt: text, chatHistory: [...chatHistory, userMsg] };
      const res = await invoke<IPCResponse<ChatMessage>>('send_chat_message', { request: req });
      if (res.success && res.data) {
        setChatHistory((prev) => [...prev, res.data!]);
      } else {
        setChatHistory((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: res.error?.message ?? 'Something went wrong.', timestamp: new Date() }]);
      }
    } catch (err: unknown) {
      setChatHistory((prev) => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: err instanceof Error ? err.message : 'Something went wrong.', timestamp: new Date() }]);
    } finally {
      setIsLoading(false);
    }
  }, [chatInput, chatHistory, documentId, documentContext]);

  const handleChatKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  }, [handleSendChat]);

  // Escape to close panel
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return (
      <aside className="fixed right-0 top-16 bottom-0 w-[360px] bg-white/70 backdrop-blur-[20px] border-l border-outline-variant/15 flex flex-col z-40 shadow-[0_40px_60px_-5px_rgba(67,67,213,0.08)] transform translate-x-full opacity-0 pointer-events-none transition-all duration-300" aria-hidden="true"></aside>
    );
  }

  return (
    <aside className="fixed right-0 top-16 bottom-0 w-[360px] bg-white/70 backdrop-blur-[20px] border-l border-outline-variant/15 flex flex-col z-40 shadow-[0_40px_60px_-5px_rgba(67,67,213,0.08)] transform translate-x-0 opacity-100 pointer-events-auto transition-all duration-300 font-label">
      
      {/* Header */}
      <div className="p-6 border-b border-outline-variant/10 shrink-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center">
              <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary m-0">AuraSphere Assistant</h2>
              <p className="text-[10px] font-label uppercase tracking-widest text-[#5a5a5a] opacity-70 m-0 leading-tight">AI Writing Partner</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection Status Indicator */}
            <div className="w-2 h-2 rounded-full bg-[#4CAF50] shadow-[0_0_10px_#4CAF50] transition-all duration-400" />
            <button className="bg-transparent border-none cursor-pointer text-on-surface-variant flex items-center hover:bg-surface-variant/50 p-1 rounded" onClick={onClose} aria-label="Close AI panel">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
        
        <div className="flex bg-surface-container rounded-lg p-1 gap-0.5">
            {(['Assistant', 'Analysis', 'History'] as TabState[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === tab ? 'bg-white/50 dark:bg-black/50 text-primary shadow-sm' : 'text-[#5a5a5a] opacity-70 hover:opacity-100 bg-transparent'}`}
              >
                {tab}
              </button>
            ))}
          </div>
      </div>

      {/* Dynamic Body based on Connection State & Tab */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {activeTab === 'Assistant' && (
          <>
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              {isLoading && (
                <div className="flex items-center gap-3 text-on-surface-variant text-sm p-4">
                  <div className="w-4 h-4 rounded-full border-2 border-outline-variant border-t-primary animate-spin" />
                  <span>Thinking…</span>
                </div>
              )}

              {error && !isLoading && (
                <div className="bg-error-container rounded-md p-4 flex flex-col gap-2">
                  <p className="m-0 text-on-error-container text-sm">{error}</p>
                </div>
              )}

              {!isLoading && !error && suggestions.length === 0 && (
                <p className="m-0 text-on-surface-variant text-sm text-center p-8 opacity-70">
                  {selection?.text
                    ? 'No suggestions yet. Ask me anything below.'
                    : 'Select text and press Cmd+K, or ask me anything below.'}
                </p>
              )}

              {suggestions.map((s, idx) => (
                <SuggestionCard
                  key={s.id}
                  suggestion={s}
                  isFocused={false}
                  onSelect={onSuggestionSelect}
                  onDismiss={handleDismiss}
                  animationIndex={idx}
                />
              ))}
            </div>

            {chatHistory.length > 0 && (
              <div className="max-h-[220px] overflow-y-auto p-4 flex flex-col gap-2 border-t border-outline-variant/20 bg-surface-container-lowest">
                {chatHistory.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-2 px-3 text-sm max-w-[90%] break-words ${msg.role === 'user' ? 'self-end bg-primary-container text-on-primary-container' : 'self-start bg-surface-variant text-on-surface-variant'}`}
                  >
                    {msg.content}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            )}

            <div className="p-6 border-t border-outline-variant/10 shrink-0 bg-white/50">
              <div className="relative group">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="Ra lệnh (e.g., @Báo_cáo_Q1)"
                  className="w-full bg-surface-container-low border-none rounded-xl p-4 pr-12 text-sm focus:ring-0 focus:bg-surface-container-lowest transition-all min-h-[100px] resize-none font-label outline-none"
                  disabled={isLoading}
                />
                <div className="absolute right-4 bottom-4 flex gap-2">
                  <button
                    className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:scale-105 transition-transform shadow-md border-none cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
                    onClick={handleSendChat}
                    disabled={isLoading || !chatInput.trim()}
                  >
                    <span className="material-symbols-outlined text-sm">north</span>
                  </button>
                </div>
                <div className="absolute left-4 bottom-4">
                  <button className="text-on-surface-variant/50 hover:text-primary transition-colors bg-transparent border-none cursor-pointer p-0">
                    <span className="material-symbols-outlined text-lg">attach_file</span>
                  </button>
                </div>
              </div>
              <p className="text-[9px] text-center mt-4 text-on-surface-variant opacity-40 uppercase tracking-[0.2em] m-0">Press Cmd + K to trigger AI</p>
            </div>
          </>
        )}

        {activeTab === 'Analysis' && (
          <div className="flex-1 p-6 space-y-8 animate-[fade-in-step_0.3s_forwards]">
            {/* Tone Analysis Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 opacity-70 m-0">Tone Analysis</h3>
                <span className="material-symbols-outlined text-primary text-sm">info</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1 m-0">Primary Tone</p>
                  <p className="font-headline text-lg font-bold text-on-surface m-0">Formal</p>
                  <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                    <div className="bg-primary h-full w-[82%]"></div>
                  </div>
                </div>
                <div className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/10 shadow-sm">
                  <p className="text-[10px] font-bold text-primary uppercase mb-1 m-0">Secondary</p>
                  <p className="font-headline text-lg font-bold text-on-surface m-0">Evocative</p>
                  <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                    <div className="bg-[#575995] h-full w-[64%]"></div>
                  </div>
                </div>
              </div>
            </section>
            
            {/* Reading Level Section */}
            <section className="bg-surface-container-low rounded-xl p-6 relative overflow-hidden border border-outline-variant/10 shadow-sm">
              <div className="relative z-10">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-4 m-0">Reading Level</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-primary font-headline tracking-tighter">Grade 10</span>
                  <span className="text-[10px] text-primary/60 font-bold uppercase">Academic</span>
                </div>
                <p className="mt-3 text-xs text-on-surface-variant font-body leading-relaxed m-0">Your prose is sophisticated yet accessible. Ideal for editorial features and thought leadership pieces.</p>
              </div>
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary/5 blur-3xl rounded-full"></div>
            </section>
            
            {/* Editorial Sentiment Graph */}
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 opacity-70 mb-4 m-0">Editorial Sentiment</h3>
              <div className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/10 shadow-sm h-48 relative flex items-end justify-between gap-1 overflow-hidden">
                <div className="w-full h-full absolute inset-0 p-6 flex items-end justify-between gap-2 opacity-10 pointer-events-none">
                  {[30, 50, 45, 70, 85, 60, 40].map((h, i) => (
                    <div key={i} className={`w-4 bg-primary rounded-t-sm`} style={{ height: `${h}%` }}></div>
                  ))}
                </div>
                <svg className="absolute inset-0 w-full h-full p-6" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <path d="M0,70 Q15,60 25,40 T50,20 T75,50 T100,30" fill="none" stroke="#4343d5" strokeWidth="2" vectorEffect="non-scaling-stroke"></path>
                  <circle cx="25" cy="40" fill="#4343d5" r="2"></circle>
                  <circle cx="50" cy="20" fill="#4343d5" r="2"></circle>
                </svg>
                <div className="w-full flex justify-between mt-auto pt-4 border-t border-slate-50 text-[8px] text-slate-400 font-bold uppercase tracking-widest relative z-10">
                  <span>Intro</span>
                  <span>Middle</span>
                  <span>Climax</span>
                  <span>Outro</span>
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'History' && (
          <div className="flex-1 p-6 space-y-6 animate-[fade-in-step_0.3s_forwards]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-[0.2em] font-black text-slate-400 m-0">Activity History</h3>
              <span className="material-symbols-outlined text-primary/40 cursor-pointer text-sm">filter_list</span>
            </div>
            
            <div className="space-y-4">
              <div className="sticky top-0 bg-white/50 backdrop-blur-md py-1 z-10">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Today</span>
              </div>
              
              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/10 hover:border-primary/30 transition-all group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                    <span className="text-[10px] font-bold text-primary uppercase">Style Refinement</span>
                  </div>
                  <span className="text-[9px] text-[#767586]">14:22</span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed mb-4 italic m-0">"Adjusted the tone to be more academic yet accessible..."</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="flex-1 py-1.5 bg-primary/5 hover:bg-primary/10 text-primary text-[10px] font-semibold rounded-lg transition-colors border-none cursor-pointer">Apply</button>
                  <button className="flex-1 py-1.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded-lg transition-colors border-none cursor-pointer">Revisit</button>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/10 hover:border-primary/30 transition-all group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-secondary">edit_note</span>
                    <span className="text-[10px] font-bold text-secondary uppercase">Structural Shift</span>
                  </div>
                  <span className="text-[9px] text-[#767586]">11:05</span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed mb-4 m-0">Moved the "AuraSphere" paragraph to follow digital focus definition.</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="flex-1 py-1.5 bg-primary/5 text-primary text-[10px] font-semibold rounded-lg border-none cursor-pointer">Apply</button>
                  <button className="flex-1 py-1.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded-lg border-none cursor-pointer">Revisit</button>
                </div>
              </div>

              <div className="sticky top-0 bg-white/50 backdrop-blur-md py-1 z-10 mt-6">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Yesterday</span>
              </div>
              
              <div className="bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/10 hover:border-primary/30 transition-all group">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-[#b65700]">history_edu</span>
                    <span className="text-[10px] font-bold text-[#b65700] uppercase">Contextual Injection</span>
                  </div>
                  <span className="text-[9px] text-[#767586]">Oct 12</span>
                </div>
                <p className="text-xs text-on-surface leading-relaxed mb-4 m-0">Added references to monastic cells and private libraries.</p>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button className="flex-1 py-1.5 bg-primary/5 text-primary text-[10px] font-semibold rounded-lg border-none cursor-pointer">Apply</button>
                  <button className="flex-1 py-1.5 bg-surface-container text-on-surface-variant text-[10px] font-semibold rounded-lg border-none cursor-pointer">Revisit</button>
                </div>
              </div>
            </div>

            <div className="mt-8 relative p-4 rounded-xl bg-gradient-to-tr from-primary to-primary-container text-white overflow-hidden shadow-lg shadow-primary/20">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/20 blur-2xl rounded-full"></div>
              <div className="relative z-10">
                <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mb-1 m-0">Aura Suggestion</p>
                <p className="text-[11px] leading-relaxed font-medium m-0">You've visited the "Negotiated" version 3 times. Merge permanently?</p>
                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-1 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-lg text-[9px] font-bold transition-colors border-none cursor-pointer text-white">Yes, Merge</button>
                  <button className="px-3 py-1 bg-transparent hover:bg-white/10 rounded-lg text-[9px] font-bold transition-colors border-none cursor-pointer text-white">Browse</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default AuraSpherePanel;
