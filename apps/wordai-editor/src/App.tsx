/**
 * App - Application root wired to global state manager
 * Requirements: 1.1, 1.2, 1.4, 3.3, 3.4, 5.1–5.5, 13.2, 13.3, 17.1–17.5, 21.1, 25.1–25.3
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import EditorCanvas from './components/EditorCanvas';
import { AuraSpherePanel } from './components/AuraSpherePanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { RenderDrawer } from './components/RenderDrawer';
import { VersionHistory } from './components/VersionHistory';
import { TopNavBar } from './components/TopNavBar';
import { PreferencesDialog } from './components/PreferencesDialog';
import { QuickSearchPopup } from './components/QuickSearchPopup';
import { Tooltip } from './components/Tooltip';
import { useAutoSave } from './hooks/useAutoSave';
import { createDocument, loadDocument, getDocumentPath } from './services/documentService';
import { useAppState } from './services/stateManager';
import * as auraBrainManager from './services/auraBrainManager';
import type { Document, TextSelection } from './types/document';
import type { AISuggestion } from './types/ai';
import type { SettingEntry, Tab } from './types/preferences';
import { ensureBlockValue, extractPlainText, replaceTextInBlockValue } from './utils/blockText';

const LAST_PATH_KEY = 'wordai_last_document_path';
const FONT_SIZE_KEY = 'wordai_font_size';
const DEFAULT_FONT_SIZE = 18;

function App() {
  const {
    state,
    setDocument,
    updateDocument,
    markSaved,
    setSaveError,
    openAIPanel,
    closeAIPanel,
    openNegotiation,
    closeNegotiation,
    openRenderDrawer,
    closeRenderDrawer,
    openVersionHistory,
    closeVersionHistory,
    setAiServiceStatus,
    markFilePersisted,
  } = useAppState();

  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return stored ? Number(stored) : DEFAULT_FONT_SIZE;
  });

  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [preferencesInitialTab, setPreferencesInitialTab] = useState<Tab | undefined>(undefined);
  const [preferencesTargetSettingId, setPreferencesTargetSettingId] = useState<string | undefined>(undefined);

  // AuraBrain sync state (Req 1.1, 1.2, 1.4, 3.3, 3.4)
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncErrorMsg, setSyncErrorMsg] = useState<string | null>(null);
  // Ref to track current content hash for dirty detection
  const currentHashRef = useRef<string | null>(null);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  }, []);

  // Cmd+Shift+P / Ctrl+Shift+P opens Quick Search (Req 1.1, 1.2)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Cmd+S / Ctrl+S → sync to AuraBrain (Req 1.1, 1.2, 1.4)
  const documentRef = useRef<Document | null>(null);

  useEffect(() => {
    const handleSaveKeyDown = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const doc = documentRef.current;
        if (!doc) return;
        setIsSyncing(true);
        setSyncErrorMsg(null);
        const result = await auraBrainManager.sync(doc);
        setIsSyncing(false);
        if (result.success) {
          // Req 1.2, 3.4: clear dirty indicator on success
          setIsDirty(false);
        } else {
          // Req 1.4: show error notification, keep dirty indicator
          setSyncErrorMsg(result.error ?? 'Sync failed. Please try again.');
        }
      }
    };
    window.addEventListener('keydown', handleSaveKeyDown);
    return () => window.removeEventListener('keydown', handleSaveKeyDown);
  }, []);

  const handleQuickSearchSelect = useCallback((entry: SettingEntry) => {
    setIsQuickSearchOpen(false);
    setPreferencesInitialTab(entry.tab as Tab);
    setPreferencesTargetSettingId(entry.id);
    setIsPreferencesOpen(true);
  }, []);

  const {
    document,
    filePath,
    isFilePersisted,
    isAIPanelOpen,
    isNegotiationOpen,
    isRenderDrawerOpen,
    isVersionHistoryOpen,
    aiSelection,
    selectedSuggestion,
    saveError,
    hasUnsavedChanges,
    aiServiceAvailable,
  } = state;

  // Keep documentRef in sync for the Cmd+S handler (Req 1.1)
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  // Initialize: restore last document or create a fresh one (Req 25.1–25.3)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const savedPath = localStorage.getItem(LAST_PATH_KEY);
      let doc: Document;
      let path: string;
      try {
        if (savedPath) {
          doc = await loadDocument(savedPath);
          path = savedPath;
          const persisted = !!savedPath;
          if (!cancelled) {
            setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path, persisted);
            localStorage.setItem(LAST_PATH_KEY, path);
          }
          return;
        } else {
          doc = await createDocument();
          path = getDocumentPath(doc.id);
          // Newly created docs are not yet persisted; keep auto-save disabled until first save.
          const persisted = false;
          if (!cancelled) {
            setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path, persisted);
            localStorage.setItem(LAST_PATH_KEY, path);
          }
          return;
        }
      } catch {
        // Always fall back to a new document — never stay stuck on loading
        try {
          doc = await createDocument();
          path = getDocumentPath(doc.id);
          const persisted = false;
          if (!cancelled) {
            setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path, persisted);
            localStorage.setItem(LAST_PATH_KEY, path);
          }
          return;
        } catch (e) {
          console.error('Failed to create document:', e);
          return;
        }
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep localStorage in sync when filePath changes
  useEffect(() => {
    if (filePath) localStorage.setItem(LAST_PATH_KEY, filePath);
  }, [filePath]);

  // Check AI service connectivity on startup (Req 25.4) — fire and forget, never blocks loading
  const checkAIHealth = useCallback(async () => {
    setAiServiceStatus(null);
    try {
      const available = await invoke<boolean>('check_ai_health', { apiKey: '', endpoint: null });
      setAiServiceStatus(available);
    } catch {
      setAiServiceStatus(false);
    }
  }, [setAiServiceStatus]);

  useEffect(() => {
    checkAIHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDocumentChange = useCallback((doc: Document) => {
    updateDocument(doc);
    // Req 3.3: mark dirty when content changes
    // Compute hash async and compare with lastSyncedHash
    auraBrainManager.computeContentHash(doc.content).then((hash) => {
      currentHashRef.current = hash;
      const dirty = auraBrainManager.isDirty(hash);
      setIsDirty(dirty);
    });
  }, [updateDocument]);

  const handleSaveSuccess = useCallback((doc: Document) => {
    markSaved(doc);
  }, [markSaved]);

  const handleSaveError = useCallback(() => {
    // saveError is surfaced via useAutoSave return value and stored in state
  }, []);

  // Cmd+K triggers AI panel (Req 5.1–5.3, 21.1)
  const handleAITrigger = useCallback((selection: TextSelection) => {
    openAIPanel(selection);
  }, [openAIPanel]);

  const handleSuggestionSelect = useCallback((suggestion: AISuggestion) => {
    openNegotiation(suggestion);
  }, [openNegotiation]);

  const handleNegotiationAccept = useCallback((acceptedText: string) => {
    if (!selectedSuggestion || !document) return;
    const newContent = replaceTextInBlockValue(
      document.content,
      selectedSuggestion.originalText,
      acceptedText
    );
    const updatedDoc: Document = {
      ...document,
      content: newContent,
      version: document.version + 1,
      lastModified: new Date(),
    };
    updateDocument(updatedDoc);
    closeNegotiation();
  }, [selectedSuggestion, document, updateDocument, closeNegotiation]);

  const handleVersionRestore = useCallback((content: string) => {
    if (!document) return;
    updateDocument({ ...document, content: ensureBlockValue(content), lastModified: new Date() });
  }, [document, updateDocument]);

  const handleNew = useCallback(async () => {
    const doc = await createDocument();
    const path = getDocumentPath(doc.id);
    setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path, false);
    localStorage.setItem(LAST_PATH_KEY, path);
  }, [setDocument]);

  const { saveError: autoSaveError, triggerSave } = useAutoSave(
    document ?? ({} as Document),
    document && filePath ? filePath : '',
    handleSaveSuccess,
    handleSaveError,
    isFilePersisted
  );

  // Sync auto-save error into global state
  useEffect(() => {
    setSaveError(autoSaveError);
  }, [autoSaveError, setSaveError]);

  if (!document) {
    return (
      <div
        data-testid="app-loading"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--font-family-ui)',
          color: 'var(--md-sys-color-on-surface-variant)',
          gap: '1rem',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--md-sys-color-surface-variant, #e7e0ec)',
            borderTopColor: 'var(--md-sys-color-primary, #6750a4)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
          aria-hidden="true"
        />
        <span>Loading…</span>
      </div>
    );
  }

  const aiContext = aiSelection?.text ?? extractPlainText(document.content).slice(0, 500);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <TopNavBar
        documentTitle={document.title}
        hasUnsavedChanges={hasUnsavedChanges}
        onNew={handleNew}
        onSave={triggerSave}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        isDirty={isDirty}
        isSyncing={isSyncing}
      />
      {/* AI service unavailable toast (Req 25.5) - compact bottom-left corner */}
      {aiServiceAvailable === false && !bannerDismissed && (
        <div
          data-testid="ai-service-banner"
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '24px',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: '#1f2937',
            color: '#f9fafb',
            fontFamily: 'var(--font-family-ui)',
            fontSize: '12px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '320px',
          }}
          role="alert"
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>⚠️</span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>AI unavailable. Editing continues.</span>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <button
              data-testid="ai-service-retry-button"
              onClick={() => { setBannerDismissed(false); checkAIHealth(); }}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#f9fafb',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: '11px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Retry
            </button>
            <button
              data-testid="ai-service-preferences-button"
              onClick={() => setIsPreferencesOpen(true)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#d1d5db',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: '11px',
                whiteSpace: 'nowrap',
              }}
            >
              Settings
            </button>
            <button
              data-testid="ai-service-close-button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Close"
              style={{
                background: 'transparent',
                color: '#9ca3af',
                border: 'none',
                borderRadius: '6px',
                padding: '2px 4px',
                cursor: 'pointer',
                fontFamily: 'var(--font-family-ui)',
                fontSize: '14px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Sync error notification (Req 1.4) — non-blocking toast, keeps dirty indicator */}
      {syncErrorMsg && (
        <div
          data-testid="sync-error-notification"
          role="alert"
          aria-live="assertive"
          style={{
            position: 'fixed',
            bottom: aiServiceAvailable === false && !bannerDismissed ? '80px' : '24px',
            left: '24px',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            background: '#7f1d1d',
            color: '#fef2f2',
            fontFamily: 'var(--font-family-ui)',
            fontSize: '12px',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            maxWidth: '360px',
          }}
        >
          <span style={{ fontSize: '16px', lineHeight: 1 }}>⚠️</span>
          <span style={{ flex: 1, lineHeight: 1.4 }}>Sync failed: {syncErrorMsg}</span>
          <button
            data-testid="sync-error-close-button"
            onClick={() => setSyncErrorMsg(null)}
            aria-label="Dismiss sync error"
            style={{
              background: 'transparent',
              color: '#fca5a5',
              border: 'none',
              borderRadius: '6px',
              padding: '2px 4px',
              cursor: 'pointer',
              fontFamily: 'var(--font-family-ui)',
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      )}
      <aside style={{
        position: 'fixed',
        left: 0,
        top: 'var(--topnav-height)',
        bottom: 0,
        width: 'var(--left-sidebar-width)',
        background: 'rgba(237, 238, 239, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(199, 196, 215, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '1.5rem',
        gap: '1.5rem',
        zIndex: 40,
      }}>
        <Tooltip text="AuraSphere AI">
          <button
            onClick={() => openAIPanel({ start: 0, end: 0, text: '' })}
            style={{
              padding: '0.75rem',
              background: isAIPanelOpen ? 'rgba(255,255,255,0.5)' : 'none',
              border: 'none',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              color: isAIPanelOpen ? 'var(--md-sys-color-primary)' : '#5a5a5a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isAIPanelOpen ? 'var(--shadow-ambient)' : 'none',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          </button>
        </Tooltip>
        <Tooltip text="Analytics">
          <button
            style={{ padding: '0.75rem', background: 'none', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', color: '#5a5a5a', opacity: 0.7, display: 'flex' }}
          >
            <span className="material-symbols-outlined">analytics</span>
          </button>
        </Tooltip>
        <Tooltip text="Version History">
          <button
            onClick={openVersionHistory}
            style={{ padding: '0.75rem', background: 'none', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', color: '#5a5a5a', opacity: 0.7, display: 'flex' }}
          >
            <span className="material-symbols-outlined">history</span>
          </button>
        </Tooltip>
        <Tooltip text="Settings">
          <button
            onClick={() => setIsPreferencesOpen(true)}
            style={{ padding: '0.75rem', background: 'none', border: 'none', borderRadius: '0.75rem', cursor: 'pointer', color: '#5a5a5a', opacity: 0.7, display: 'flex' }}
          >
            <span className="material-symbols-outlined">tune</span>
          </button>
        </Tooltip>
      </aside>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        paddingTop: 'var(--topnav-height)',
        paddingLeft: 'var(--left-sidebar-width)',
        paddingRight: isAIPanelOpen ? 'var(--right-panel-width)' : '0',
        transition: 'padding-right var(--transition-normal)',
        position: 'relative',
      }}>
        <EditorCanvas
          document={document}
          onDocumentChange={handleDocumentChange}
          onAITrigger={handleAITrigger}
          isAIPanelOpen={isAIPanelOpen}
          saveError={saveError}
          hasUnsavedChanges={hasUnsavedChanges}
          onManualSave={triggerSave}
          onOpenExport={openRenderDrawer}
          onOpenVersionHistory={openVersionHistory}
          fontSize={fontSize}
          onFontSizeChange={handleFontSizeChange}
        />
        <AuraSpherePanel
          isOpen={isAIPanelOpen}
          onClose={closeAIPanel}
          selection={aiSelection}
          documentId={document.id}
          documentContext={aiContext}
          onSuggestionSelect={handleSuggestionSelect}
        />
        <NegotiationPanel
          isOpen={isNegotiationOpen}
          suggestion={selectedSuggestion}
          onAccept={handleNegotiationAccept}
          onReject={closeNegotiation}
          onClose={closeNegotiation}
        />
        <RenderDrawer
          isOpen={isRenderDrawerOpen}
          onClose={closeRenderDrawer}
          documentId={document.id}
          documentContent={extractPlainText(document.content)}
        />
        <VersionHistory
          isOpen={isVersionHistoryOpen}
          onClose={closeVersionHistory}
          documentId={document.id}
          onRestore={handleVersionRestore}
        />
      </div>

      <PreferencesDialog
        isOpen={isPreferencesOpen}
        onClose={() => { setIsPreferencesOpen(false); setPreferencesTargetSettingId(undefined); }}
        initialTab={preferencesInitialTab}
        targetSettingId={preferencesTargetSettingId}
      />
      <QuickSearchPopup
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        onSelect={handleQuickSearchSelect}
      />
    </div >
  );
}

export default App;
