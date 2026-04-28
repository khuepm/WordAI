/**
 * stateManager - Global application state via React Context
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
} from 'react';
import type { Document, TextSelection } from '../types/document';
import type { AISuggestion } from '../types/ai';
import type { IPCError } from '../types/ipc';

// ─── State shape ──────────────────────────────────────────────────────────────

export interface AppState {
  /** Current document being edited */
  document: Document | null;
  /** Absolute file path for the current document */
  filePath: string;
  /** True once the document has been successfully saved to disk at least once */
  isFilePersisted: boolean;

  // UI flags (Req 17.2–17.5)
  isAIPanelOpen: boolean;
  isNegotiationOpen: boolean;
  isRenderDrawerOpen: boolean;
  isVersionHistoryOpen: boolean;
  hasUnsavedChanges: boolean;

  // AI state
  aiSelection: TextSelection | null;
  selectedSuggestion: AISuggestion | null;

  // Save state
  saveError: IPCError | null;

  // AI service connectivity (Req 25.4, 25.5)
  // null = checking, true = available, false = unavailable
  aiServiceAvailable: boolean | null;
}

const initialState: AppState = {
  document: null,
  filePath: '',
  isFilePersisted: false,
  isAIPanelOpen: false,
  isNegotiationOpen: false,
  isRenderDrawerOpen: false,
  isVersionHistoryOpen: false,
  hasUnsavedChanges: false,
  aiSelection: null,
  selectedSuggestion: null,
  saveError: null,
  aiServiceAvailable: null,
};

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_DOCUMENT'; payload: { document: Document; filePath: string; isFilePersisted?: boolean } }
  | { type: 'UPDATE_DOCUMENT'; payload: Document }
  | { type: 'RENAME_DOCUMENT'; payload: string }
  | { type: 'OPEN_AI_PANEL'; payload: TextSelection }
  | { type: 'CLOSE_AI_PANEL' }
  | { type: 'OPEN_NEGOTIATION'; payload: AISuggestion }
  | { type: 'CLOSE_NEGOTIATION' }
  | { type: 'OPEN_RENDER_DRAWER' }
  | { type: 'CLOSE_RENDER_DRAWER' }
  | { type: 'OPEN_VERSION_HISTORY' }
  | { type: 'CLOSE_VERSION_HISTORY' }
  | { type: 'MARK_UNSAVED' }
  | { type: 'MARK_SAVED'; payload: Document }
  | { type: 'SET_SAVE_ERROR'; payload: IPCError | null }
  | { type: 'SET_AI_SERVICE_STATUS'; payload: boolean | null }
  | { type: 'MARK_FILE_PERSISTED' };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_DOCUMENT':
      return {
        ...state,
        document: action.payload.document,
        filePath: action.payload.filePath,
        hasUnsavedChanges: false,
        isFilePersisted: action.payload.isFilePersisted ?? false,
      };

    case 'UPDATE_DOCUMENT':
      return {
        ...state,
        document: action.payload,
        hasUnsavedChanges: true, // Req 17.2
      };

    case 'RENAME_DOCUMENT':
      if (!state.document) return state;
      return {
        ...state,
        document: { ...state.document, title: action.payload, lastModified: new Date() },
        hasUnsavedChanges: true,
      };

    // Req 17.4 — open AI panel, set flag
    case 'OPEN_AI_PANEL':
      return {
        ...state,
        isAIPanelOpen: true,
        aiSelection: action.payload,
      };

    // Req 17.5 — close AI panel, reset AI state
    case 'CLOSE_AI_PANEL':
      return {
        ...state,
        isAIPanelOpen: false,
        aiSelection: null,
        selectedSuggestion: null,
      };

    case 'OPEN_NEGOTIATION':
      return {
        ...state,
        isNegotiationOpen: true,
        selectedSuggestion: action.payload,
      };

    case 'CLOSE_NEGOTIATION':
      return {
        ...state,
        isNegotiationOpen: false,
        selectedSuggestion: null,
      };

    case 'OPEN_RENDER_DRAWER':
      return { ...state, isRenderDrawerOpen: true };

    case 'CLOSE_RENDER_DRAWER':
      return { ...state, isRenderDrawerOpen: false };

    case 'OPEN_VERSION_HISTORY':
      return { ...state, isVersionHistoryOpen: true };

    case 'CLOSE_VERSION_HISTORY':
      return { ...state, isVersionHistoryOpen: false };

    // Req 17.3 — clear unsaved flag on successful save
    case 'MARK_SAVED':
      return {
        ...state,
        document: action.payload,
        hasUnsavedChanges: false,
        saveError: null,
        isFilePersisted: true,
      };

    case 'MARK_FILE_PERSISTED':
      return { ...state, isFilePersisted: true };

    case 'MARK_UNSAVED':
      return { ...state, hasUnsavedChanges: true };

    case 'SET_SAVE_ERROR':
      return { ...state, saveError: action.payload };

    case 'SET_AI_SERVICE_STATUS':
      return { ...state, aiServiceAvailable: action.payload };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  // Document actions
  setDocument: (document: Document, filePath: string, isFilePersisted?: boolean) => void;
  updateDocument: (document: Document) => void;
  renameDocument: (title: string) => void;
  markSaved: (document: Document) => void;
  setSaveError: (err: IPCError | null) => void;
  // UI flag actions (Req 17.4, 17.5)
  openAIPanel: (selection: TextSelection) => void;
  closeAIPanel: () => void;
  openNegotiation: (suggestion: AISuggestion) => void;
  closeNegotiation: () => void;
  openRenderDrawer: () => void;
  closeRenderDrawer: () => void;
  openVersionHistory: () => void;
  closeVersionHistory: () => void;
  // AI service connectivity (Req 25.4, 25.5)
  setAiServiceStatus: (available: boolean | null) => void;
  markFilePersisted: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const setDocument = useCallback((document: Document, filePath: string, isFilePersisted?: boolean) => {
    dispatch({ type: 'SET_DOCUMENT', payload: { document, filePath, isFilePersisted } });
  }, []);

  const updateDocument = useCallback((document: Document) => {
    dispatch({ type: 'UPDATE_DOCUMENT', payload: document });
  }, []);

  const renameDocument = useCallback((title: string) => {
    dispatch({ type: 'RENAME_DOCUMENT', payload: title });
  }, []);

  const markSaved = useCallback((document: Document) => {
    dispatch({ type: 'MARK_SAVED', payload: document });
  }, []);

  const setSaveError = useCallback((err: IPCError | null) => {
    dispatch({ type: 'SET_SAVE_ERROR', payload: err });
  }, []);

  const openAIPanel = useCallback((selection: TextSelection) => {
    dispatch({ type: 'OPEN_AI_PANEL', payload: selection });
  }, []);

  const closeAIPanel = useCallback(() => {
    dispatch({ type: 'CLOSE_AI_PANEL' });
  }, []);

  const openNegotiation = useCallback((suggestion: AISuggestion) => {
    dispatch({ type: 'OPEN_NEGOTIATION', payload: suggestion });
  }, []);

  const closeNegotiation = useCallback(() => {
    dispatch({ type: 'CLOSE_NEGOTIATION' });
  }, []);

  const openRenderDrawer = useCallback(() => {
    dispatch({ type: 'OPEN_RENDER_DRAWER' });
  }, []);

  const closeRenderDrawer = useCallback(() => {
    dispatch({ type: 'CLOSE_RENDER_DRAWER' });
  }, []);

  const openVersionHistory = useCallback(() => {
    dispatch({ type: 'OPEN_VERSION_HISTORY' });
  }, []);

  const closeVersionHistory = useCallback(() => {
    dispatch({ type: 'CLOSE_VERSION_HISTORY' });
  }, []);

  const setAiServiceStatus = useCallback((available: boolean | null) => {
    dispatch({ type: 'SET_AI_SERVICE_STATUS', payload: available });
  }, []);

  const markFilePersisted = useCallback(() => {
    dispatch({ type: 'MARK_FILE_PERSISTED' });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        setDocument,
        updateDocument,
        renameDocument,
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
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/** Access global app state and actions. Must be used inside AppStateProvider. */
export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return ctx;
}
