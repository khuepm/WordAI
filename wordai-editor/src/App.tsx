/**
 * App - Application root with document initialization
 * Requirements: 1.1, 1.2, 13.2, 13.3, 14.1, 14.2
 */

import { useState, useEffect, useCallback } from 'react';
import EditorCanvas from './components/EditorCanvas';
import { useAutoSave } from './hooks/useAutoSave';
import { createDocument, loadDocument, getDocumentPath } from './services/documentService';
import type { Document, TextSelection } from './types/document';

const LAST_PATH_KEY = 'wordai_last_document_path';

function App() {
  const [document, setDocument] = useState<Document | null>(null);
  const [filePath, setFilePath] = useState('');

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

  const handleAITrigger = useCallback((selection: TextSelection) => {
    console.log('AI trigger', selection);
  }, []);

  const { saveError, hasUnsavedChanges, triggerSave } = useAutoSave(
    document ?? ({} as Document),
    filePath,
    handleSaveSuccess,
    handleSaveError
  );

  if (!document) {
    return <div>Loading...</div>;
  }

  return (
    <EditorCanvas
      document={document}
      onDocumentChange={handleDocumentChange}
      onAITrigger={handleAITrigger}
      isAIPanelOpen={false}
      saveError={saveError}
      hasUnsavedChanges={hasUnsavedChanges}
      onManualSave={triggerSave}
    />
  );
}

export default App;
