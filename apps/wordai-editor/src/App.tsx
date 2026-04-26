/**
 * App - Application root wired to global state manager
 * Requirements: 1.1, 1.2, 1.4, 3.3, 3.4, 5.1–5.5, 13.2, 13.3, 17.1–17.5, 21.1, 25.1–25.3
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import './i18n';
import { invoke } from '@tauri-apps/api/core';
import EditorCanvas from './components/EditorCanvas';
import { EditorStatusBar } from './components/EditorStatusBar';
import { AuraSpherePanel } from './components/AuraSpherePanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { RenderDrawer } from './components/RenderDrawer';
import { VersionHistory } from './components/VersionHistory';
import { TopNavBar } from './components/TopNavBar';
import { PreferencesDialog } from './components/PreferencesDialog';
import { QuickSearchPopup } from './components/QuickSearchPopup';
import { Tooltip } from './components/Tooltip';
import { useAutoSync } from './hooks/useAutoSave';
import { useAuraBrainSyncState } from './hooks/useAuraBrainSyncState';
import { loadDocument } from './services/documentService';
import { useAppState } from './services/stateManager';
import * as auraBrainManager from './services/auraBrainManager';
import { auraIntentToDocument } from './services/auraDocumentAdapter';
import { getAuraBrainStoragePath } from './services/platformService';
import { loadPreferences } from './services/preferencesService';
import type { AuraIntentDocument, AuraIntentSummary } from './types/auraDocument';
import type { Document, TextSelection } from './types/document';
import type { AISuggestion } from './types/ai';
import { defaultPreferences, type Preferences, type SettingEntry, type Tab } from './types/preferences';
import { ensureBlockValue, extractPlainText, replaceTextInBlockValue } from './utils/blockText';

const LAST_INTENT_KEY = 'wordai_last_intent_id';
const LEGACY_LAST_PATH_KEY = 'wordai_last_document_path';
const FONT_SIZE_KEY = 'wordai_font_size';
const DEFAULT_FONT_SIZE = 18;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePreferences(value: unknown): Preferences {
  if (!isRecord(value)) return defaultPreferences;

  const general = isRecord(value.general) ? value.general : {};
  const autoSave = isRecord(general.autoSave) ? general.autoSave : {};
  const aiEngine = isRecord(value.aiEngine) ? value.aiEngine : {};
  const typography = isRecord(value.typography) ? value.typography : {};
  const privacy = isRecord(value.privacy) ? value.privacy : {};

  return {
    general: {
      ...defaultPreferences.general,
      ...general,
      autoSave: {
        ...defaultPreferences.general.autoSave,
        ...autoSave,
      },
    } as Preferences['general'],
    aiEngine: {
      ...defaultPreferences.aiEngine,
      ...aiEngine,
    } as Preferences['aiEngine'],
    typography: {
      ...defaultPreferences.typography,
      ...typography,
    } as Preferences['typography'],
    privacy: {
      ...defaultPreferences.privacy,
      ...privacy,
    } as Preferences['privacy'],
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return 'AuraBrain storage is not available.';
}

function createInMemoryDocument(title = 'Untitled Intent'): Document {
  return {
    id: crypto.randomUUID(),
    title,
    content: '',
    metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
    version: 1,
    lastModified: new Date(),
  };
}

function App() {
  const {
    state,
    setDocument,
    updateDocument,
    openAIPanel,
    closeAIPanel,
    openNegotiation,
    closeNegotiation,
    openRenderDrawer,
    closeRenderDrawer,
    openVersionHistory,
    closeVersionHistory,
    setAiServiceStatus,
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
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [storagePath, setStoragePath] = useState('');
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupRetryKey, setStartupRetryKey] = useState(0);
  const [syncErrorDismissed, setSyncErrorDismissed] = useState(false);

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
        setSyncErrorDismissed(false);
        const result = await auraBrainManager.syncDocument(doc, 'manual');
        if (result.success && !result.queued) {
          localStorage.setItem(LAST_INTENT_KEY, doc.id);
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

  const refreshPreferences = useCallback(async () => {
    try {
      const loaded = await loadPreferences('default');
      setPreferences(normalizePreferences(loaded));
    } catch {
      setPreferences(defaultPreferences);
    }
  }, []);

  const {
    document,
    isAIPanelOpen,
    isNegotiationOpen,
    isRenderDrawerOpen,
    isVersionHistoryOpen,
    aiSelection,
    selectedSuggestion,
    aiServiceAvailable,
  } = state;

  const syncView = useAuraBrainSyncState(document);

  // Keep documentRef in sync for the Cmd+S handler (Req 1.1)
  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(() => {
    void refreshPreferences();
    getAuraBrainStoragePath()
      .then(setStoragePath)
      .catch(() => setStoragePath(''));
  }, [refreshPreferences]);

  // Initialize: restore last AuraBrain intent or create a fresh in-memory intent.
  useEffect(() => {
    let cancelled = false;
    setStartupError(null);
    async function openAuraIntent(intent: AuraIntentDocument) {
      const doc = auraIntentToDocument(intent).value;
      const normalized = { ...doc, content: ensureBlockValue(doc.content) };
      if (!cancelled) {
        setDocument(normalized, '', true);
        await auraBrainManager.initializeSyncedBaseline(normalized);
        localStorage.setItem(LAST_INTENT_KEY, normalized.id);
      }
    }

    function openNewDocument() {
      const doc = createInMemoryDocument();
      setDocument(doc, '', false);
      auraBrainManager.resetForNewDocument(doc.id);
    }

    async function init() {
      try {
        const lastIntentId = localStorage.getItem(LAST_INTENT_KEY);
        if (lastIntentId) {
          const lastIntent = await invoke<AuraIntentDocument | null>('get_intent', { id: lastIntentId });
          if (lastIntent) {
            await openAuraIntent(lastIntent);
            return;
          }
        }

        const intents = await invoke<AuraIntentSummary[]>('list_intents');
        if (Array.isArray(intents) && intents.length > 0) {
          const mostRecent = await invoke<AuraIntentDocument | null>('get_intent', { id: intents[0].id });
          if (mostRecent) {
            await openAuraIntent(mostRecent);
            return;
          }
        }

        const legacyPath = localStorage.getItem(LEGACY_LAST_PATH_KEY);
        if (legacyPath) {
          const legacyDoc = await loadDocument(legacyPath);
          const normalized = { ...legacyDoc, content: ensureBlockValue(legacyDoc.content) };
          const syncResult = await auraBrainManager.syncDocument(normalized, 'startup');
          if (!cancelled) {
            setDocument(normalized, '', syncResult.success);
            if (syncResult.success) localStorage.setItem(LAST_INTENT_KEY, normalized.id);
          }
          return;
        }

        if (!cancelled) openNewDocument();
      } catch (err) {
        if (!cancelled) setStartupError(errorMessage(err));
      }
    }
    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupRetryKey]);

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
  }, [updateDocument]);

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

  const handleNew = useCallback(() => {
    const doc = createInMemoryDocument();
    setDocument(doc, '', false);
    auraBrainManager.resetForNewDocument(doc.id);
    localStorage.removeItem(LAST_INTENT_KEY);
  }, [setDocument]);

  const handleManualSync = useCallback(async () => {
    if (!document) return;
    setSyncErrorDismissed(false);
    const result = await auraBrainManager.syncDocument(document, 'manual');
    if (result.success && !result.queued) {
      localStorage.setItem(LAST_INTENT_KEY, document.id);
    }
  }, [document]);

  const handleImportedDocument = useCallback((doc: Document) => {
    const normalized = { ...doc, content: ensureBlockValue(doc.content) };
    setDocument(normalized, '', true);
    void auraBrainManager.initializeSyncedBaseline(normalized);
    localStorage.setItem(LAST_INTENT_KEY, normalized.id);
  }, [setDocument]);

  useAutoSync({
    document,
    autoSyncEnabled: preferences.general.autoSyncEnabled,
    autoSyncInterval: preferences.general.autoSyncInterval,
  });

  useEffect(() => {
    setSyncErrorDismissed(false);
  }, [syncView.syncError]);

  const handleRevealDiagnostics = useCallback(async () => {
    if (!storagePath) return;
    await invoke('reveal_in_file_manager', { path: storagePath }).catch(() => undefined);
  }, [storagePath]);

  if (startupError) {
    return (
      <div
        data-testid="startup-error"
        role="alert"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          height: '100vh',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font-family-ui)',
          color: 'var(--md-sys-color-on-surface)',
          background: 'var(--md-sys-color-surface)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>AuraBrain storage is unavailable</h1>
        <p style={{ margin: 0, maxWidth: 560, color: 'var(--md-sys-color-on-surface-variant)' }}>
          {startupError}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setStartupRetryKey((key) => key + 1)}
            style={{ padding: '0.625rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
          {storagePath && (
            <button
              type="button"
              onClick={handleRevealDiagnostics}
              style={{ padding: '0.625rem 1rem', borderRadius: 8, border: '1px solid currentColor', cursor: 'pointer' }}
            >
              Reveal diagnostics
            </button>
          )}
        </div>
      </div>
    );
  }

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
        hasUnsavedChanges={syncView.isDirty}
        onNew={handleNew}
        onSave={openRenderDrawer}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        isDirty={syncView.isDirty}
        isSyncing={syncView.isSyncing}
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
      {syncView.syncError && !syncErrorDismissed && (
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
          <span style={{ flex: 1, lineHeight: 1.4 }}>Sync failed: {syncView.syncError}</span>
          <button
            data-testid="sync-error-close-button"
            onClick={() => setSyncErrorDismissed(true)}
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
        flexDirection: 'column',
        flex: 1,
        overflow: 'hidden',
        paddingTop: 'var(--topnav-height)',
        paddingLeft: 'var(--left-sidebar-width)',
        paddingRight: isAIPanelOpen ? 'var(--right-panel-width)' : '0',
        transition: 'padding-right var(--transition-normal)',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <EditorCanvas
            document={document}
            onDocumentChange={handleDocumentChange}
            onAITrigger={handleAITrigger}
            isAIPanelOpen={isAIPanelOpen}
            saveError={syncView.syncError ? { code: 'SYNC_ERROR', message: syncView.syncError } : null}
            hasUnsavedChanges={syncView.isDirty}
            onManualSave={handleManualSync}
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
            document={document}
            onImportDocument={handleImportedDocument}
          />
          <VersionHistory
            isOpen={isVersionHistoryOpen}
            onClose={closeVersionHistory}
            documentId={document.id}
            onRestore={handleVersionRestore}
          />
        </div>
        {/* Editor Status Bar — fixed at bottom of editor area (Req 13.1) */}
        <EditorStatusBar
          isSyncing={syncView.isSyncing}
          isDirty={syncView.isDirty}
          lastSyncedAt={syncView.lastSyncedAt}
          storagePath={storagePath}
        />
      </div>

      <PreferencesDialog
        isOpen={isPreferencesOpen}
        onClose={() => { setIsPreferencesOpen(false); setPreferencesTargetSettingId(undefined); }}
        onApply={refreshPreferences}
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
