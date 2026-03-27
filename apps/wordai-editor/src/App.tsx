/**
 * App - Application root wired to global state manager
 * Requirements: 1.1, 1.2, 5.1–5.5, 13.2, 13.3, 17.1–17.5, 21.1, 25.1–25.3
 */

import { useEffect, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import EditorCanvas from './components/EditorCanvas';
import { AuraSpherePanel } from './components/AuraSpherePanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { RenderDrawer } from './components/RenderDrawer';
import { VersionHistory } from './components/VersionHistory';
import { TopNavBar } from './components/TopNavBar';
import { useAutoSave } from './hooks/useAutoSave';
import { createDocument, loadDocument, getDocumentPath } from './services/documentService';
import { useAppState } from './services/stateManager';
import type { Document, TextSelection } from './types/document';
import type { AISuggestion } from './types/ai';
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
  } = useAppState();

  const [fontSize, setFontSize] = useState<number>(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    return stored ? Number(stored) : DEFAULT_FONT_SIZE;
  });

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
    localStorage.setItem(FONT_SIZE_KEY, String(size));
  }, []);

  const {
    document,
    filePath,
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
        } else {
          doc = await createDocument();
          path = getDocumentPath(doc.id);
        }
      } catch {
        // Always fall back to a new document — never stay stuck on loading
        try {
          doc = await createDocument();
          path = getDocumentPath(doc.id);
        } catch (e) {
          console.error('Failed to create document:', e);
          return;
        }
      }
      if (!cancelled) {
        setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path);
        localStorage.setItem(LAST_PATH_KEY, path);
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
    setDocument({ ...doc, content: ensureBlockValue(doc.content) }, path);
    localStorage.setItem(LAST_PATH_KEY, path);
  }, [setDocument]);

  const { saveError: autoSaveError, triggerSave } = useAutoSave(
    document ?? ({} as Document),
    filePath,
    handleSaveSuccess,
    handleSaveError
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
      />
      {/* AI service unavailable banner (Req 25.5) */}
      {aiServiceAvailable === false && (
        <div
          data-testid="ai-service-banner"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-xs) var(--spacing-lg)',
            background: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            fontFamily: 'var(--font-family-ui)',
            fontSize: 'var(--font-size-sm)',
            borderBottom: '1px solid var(--md-sys-color-error)',
          }}
          role="alert"
        >
          <span>AI service unavailable. Editing continues normally.</span>
          <button
            data-testid="ai-service-retry-button"
            onClick={checkAIHealth}
            style={{
              background: 'var(--md-sys-color-error)',
              color: 'var(--md-sys-color-on-error)',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: 'var(--spacing-xs) var(--spacing-md)',
              cursor: 'pointer',
              fontFamily: 'var(--font-family-ui)',
              fontSize: 'var(--font-size-sm)',
              marginLeft: 'var(--spacing-md)',
            }}
          >
            Retry
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', paddingTop: '48px', position: 'relative' }}>
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
    </div>
  );
}

export default App;
