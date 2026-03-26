/**
 * App - Application root wired to global state manager
 * Requirements: 1.1, 1.2, 5.1–5.5, 13.2, 13.3, 17.1–17.5, 21.1, 25.1–25.3
 */

import { useEffect, useCallback } from 'react';
import EditorCanvas from './components/EditorCanvas';
import { AuraSpherePanel } from './components/AuraSpherePanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { RenderDrawer } from './components/RenderDrawer';
import { useAutoSave } from './hooks/useAutoSave';
import { createDocument, loadDocument, getDocumentPath } from './services/documentService';
import { useAppState } from './services/stateManager';
import type { Document, TextSelection } from './types/document';
import type { AISuggestion } from './types/ai';

const LAST_PATH_KEY = 'wordai_last_document_path';

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
  } = useAppState();

  const {
    document,
    filePath,
    isAIPanelOpen,
    isNegotiationOpen,
    isRenderDrawerOpen,
    aiSelection,
    selectedSuggestion,
    saveError,
    hasUnsavedChanges,
  } = state;

  // Initialize: restore last document or create a fresh one (Req 25.1–25.3)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const savedPath = localStorage.getItem(LAST_PATH_KEY);
      let doc: Document;
      let path: string;
      if (savedPath) {
        try {
          doc = await loadDocument(savedPath);
          path = savedPath;
        } catch {
          doc = await createDocument();
          path = getDocumentPath(doc.id);
        }
      } else {
        doc = await createDocument();
        path = getDocumentPath(doc.id);
      }
      if (!cancelled) {
        setDocument(doc, path);
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
    const newContent = document.content.replace(selectedSuggestion.originalText, acceptedText);
    const updatedDoc: Document = {
      ...document,
      content: newContent,
      version: document.version + 1,
      lastModified: new Date(),
    };
    updateDocument(updatedDoc);
    closeNegotiation();
  }, [selectedSuggestion, document, updateDocument, closeNegotiation]);

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
    return <div style={{ fontFamily: 'var(--font-family-ui)', padding: '2rem' }}>Loading…</div>;
  }

  const aiContext = aiSelection?.text ?? document.content.slice(0, 500);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <EditorCanvas
        document={document}
        onDocumentChange={handleDocumentChange}
        onAITrigger={handleAITrigger}
        isAIPanelOpen={isAIPanelOpen}
        saveError={saveError}
        hasUnsavedChanges={hasUnsavedChanges}
        onManualSave={triggerSave}
        onOpenExport={openRenderDrawer}
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
        documentContent={document.content}
      />
    </div>
  );
}

export default App;
