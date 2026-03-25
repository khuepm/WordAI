/**
 * App - Application root with document initialization and AI panel coordination
 * Requirements: 1.1, 1.2, 5.1–5.5, 13.2, 13.3, 14.1, 14.2, 17.4, 17.5, 21.1
 */

import { useState, useEffect, useCallback } from 'react';
import EditorCanvas from './components/EditorCanvas';
import { AuraSpherePanel } from './components/AuraSpherePanel';
import { NegotiationPanel } from './components/NegotiationPanel';
import { useAutoSave } from './hooks/useAutoSave';
import { createDocument, loadDocument, getDocumentPath } from './services/documentService';
import type { Document, TextSelection } from './types/document';
import type { AISuggestion } from './types/ai';

const LAST_PATH_KEY = 'wordai_last_document_path';

function App() {
  const [document, setDocument] = useState<Document | null>(null);
  const [filePath, setFilePath] = useState('');
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [aiSelection, setAiSelection] = useState<TextSelection | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AISuggestion | null>(null);
  const [isNegotiationOpen, setIsNegotiationOpen] = useState(false);

  // Initialize: restore last document or create a fresh one
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
        setDocument(doc);
        setFilePath(path);
        localStorage.setItem(LAST_PATH_KEY, path);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  const handleDocumentChange = useCallback((doc: Document) => {
    setDocument(doc);
    const path = getDocumentPath(doc.id);
    localStorage.setItem(LAST_PATH_KEY, path);
  }, []);

  const handleSaveSuccess = useCallback((doc: Document) => {
    setDocument(doc);
  }, []);

  const handleSaveError = useCallback(() => {
    // error surfaced via saveError from useAutoSave
  }, []);

  // Cmd+K in EditorCanvas triggers this (Req 5.1, 5.2, 5.3, 21.1)
  const handleAITrigger = useCallback((selection: TextSelection) => {
    setAiSelection(selection);
    setIsAIPanelOpen(true);
  }, []);

  const handleAIPanelClose = useCallback(() => {
    setIsAIPanelOpen(false);
    setAiSelection(null);
  }, []);

  // Placeholder: parent will open NegotiationPanel in a later task (Req 8.1)
  const handleSuggestionSelect = useCallback((suggestion: AISuggestion) => {
    setSelectedSuggestion(suggestion);
    setIsNegotiationOpen(true);
  }, []);

  const handleNegotiationAccept = useCallback((acceptedText: string) => {
    if (!selectedSuggestion || !document) return;
    const newContent = document.content.replace(selectedSuggestion.originalText, acceptedText);
    const updatedDoc = {
      ...document,
      content: newContent,
      version: document.version + 1,
      lastModified: new Date(),
    };
    setDocument(updatedDoc);
    setIsNegotiationOpen(false);
    setSelectedSuggestion(null);
  }, [selectedSuggestion, document]);

  const handleNegotiationReject = useCallback(() => {
    setIsNegotiationOpen(false);
    setSelectedSuggestion(null);
  }, []);

  const { saveError, hasUnsavedChanges, triggerSave } = useAutoSave(
    document ?? ({} as Document),
    filePath,
    handleSaveSuccess,
    handleSaveError
  );

  if (!document) {
    return <div style={{ fontFamily: 'var(--font-family-ui)', padding: '2rem' }}>Loading…</div>;
  }

  // Derive context string for AI: selected text or first 500 chars of doc (Req 5.3)
  const aiContext = aiSelection?.text
    ? aiSelection.text
    : document.content.slice(0, 500);

  return (
    // Outer flex container so EditorCanvas shrinks when panel opens (Req 5.5)
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <EditorCanvas
        document={document}
        onDocumentChange={handleDocumentChange}
        onAITrigger={handleAITrigger}
        isAIPanelOpen={isAIPanelOpen}
        saveError={saveError}
        hasUnsavedChanges={hasUnsavedChanges}
        onManualSave={triggerSave}
      />
      <AuraSpherePanel
        isOpen={isAIPanelOpen}
        onClose={handleAIPanelClose}
        selection={aiSelection}
        documentId={document.id}
        documentContext={aiContext}
        onSuggestionSelect={handleSuggestionSelect}
      />
      <NegotiationPanel
        isOpen={isNegotiationOpen}
        suggestion={selectedSuggestion}
        onAccept={handleNegotiationAccept}
        onReject={handleNegotiationReject}
        onClose={handleNegotiationReject}
      />
    </div>
  );
}

export default App;
