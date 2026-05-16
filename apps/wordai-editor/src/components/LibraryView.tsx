/**
 * LibraryView — Full-screen document management view.
 *
 * Fetches `list_intents` on mount, manages all local UI state for search,
 * filtering, card loading, import, delete, and conflict resolution.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.2, 7.3, 8.6, 10.4, 10.5
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { AuraIntentDocument, AuraIntentSummary } from '../types/auraDocument';
import type { Document } from '../types/document';
import { auraIntentToDocument } from '../services/auraDocumentAdapter';
import { applyFilters } from '../utils/libraryFilters';
import type { LibraryFilter } from '../utils/libraryFilters';
import { LibrarySearchBar } from './LibrarySearchBar';
import { LibraryFilterChips } from './LibraryFilterChips';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryCard } from './LibraryCard';

// ─── ConflictState ────────────────────────────────────────────────────────────

export interface ConflictState {
  intentName: string;
  auraIntentId: string;
  resolve: (choice: 'update' | 'create_new' | 'cancel') => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LibraryViewProps {
  /** Called when the user opens a document (card click, new doc, or import) */
  onOpenDocument: (doc: Document) => void;
  /** Called to switch the active tab */
  onTabChange: (tab: 'editor' | 'library') => void;
  /** The id of the document currently loaded in the editor (for delete-active-doc logic) */
  currentDocumentId: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LibraryView({ onOpenDocument, onTabChange, currentDocumentId }: LibraryViewProps) {
  const { t } = useTranslation();

  // Keep refs to props that will be used in later sub-tasks so TS doesn't complain
  const onOpenDocumentRef = useRef(onOpenDocument);
  const onTabChangeRef = useRef(onTabChange);
  const currentDocumentIdRef = useRef(currentDocumentId);
  onOpenDocumentRef.current = onOpenDocument;
  onTabChangeRef.current = onTabChange;
  currentDocumentIdRef.current = currentDocumentId;

  // ── Local state ──────────────────────────────────────────────────────────
  const [intents, setIntents] = useState<AuraIntentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search: raw input value (immediate) and debounced query (applied to filter)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [activeFilter, setActiveFilter] = useState<LibraryFilter>('all');

  // Per-card states (wired in sub-tasks 9.2 and 9.5)
  const [cardLoadingId, setCardLoadingId] = useState<string | null>(null);
  const [cardErrorId, setCardErrorId] = useState<string | null>(null);

  // Import states (wired in sub-task 9.4)
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);

  // Delete states (wired in sub-task 9.5)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Conflict state (wired in sub-task 9.4)
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchIntents = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await invoke<AuraIntentSummary[]>('list_intents');
      setIntents(Array.isArray(result) ? result : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount (Req 2.1)
  useEffect(() => {
    void fetchIntents();
  }, [fetchIntents]);

  // ── Debounced search (300ms) — Req 7.2 ──────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Derived filtered + sorted list ──────────────────────────────────────

  const displayedIntents = applyFilters(intents, searchQuery, activeFilter);

  // ── Stub handlers (wired in later sub-tasks) ─────────────────────────────

  const handleCardOpen = useCallback(async (id: string) => {
    setCardLoadingId(id);
    setCardErrorId(null);
    try {
      const result = await invoke<AuraIntentDocument>('get_intent', { id });
      const doc = auraIntentToDocument(result).value;
      localStorage.setItem('wordai_last_intent_id', doc.id);
      onOpenDocumentRef.current(doc);
      onTabChangeRef.current('editor');
    } catch (err) {
      void err;
      setCardErrorId(id);
    } finally {
      setCardLoadingId(null);
    }
  }, []);

  const handleCardDelete = useCallback((_id: string) => {
    // Wired in sub-task 9.5 — will set deleteTargetId to show ConfirmationDialog
    setDeleteTargetId(null);
  }, []);

  const handleCreateNew = useCallback(() => {
    // Wired in sub-task 9.3 — will create in-memory doc and call onOpenDocumentRef.current
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  // Expose setters via no-op references so they are considered "used" by TS/ESLint.
  // These will be called in sub-tasks 9.4 and 9.5.
  const _futureSetters = {
    setIsImporting,
    setImportError,
    setImportWarnings,
    setDeleteTargetId,
    setIsDeleting,
    setDeleteError,
    setConflictState,
  };
  // Prevent tree-shaking of the reference (never actually called here)
  void _futureSetters;

  // ── Render: loading state (Req 2.4) ─────────────────────────────────────

  if (isLoading) {
    return (
      <div
        role="main"
        aria-label={t('library.title')}
        data-testid="library-view"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1rem',
          fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
          color: 'var(--md-sys-color-on-surface-variant)',
        }}
      >
        <div
          data-testid="library-loading"
          style={{
            width: '2rem',
            height: '2rem',
            border: '3px solid var(--md-sys-color-surface-variant, #e7e0ec)',
            borderTopColor: 'var(--md-sys-color-primary, #4343d5)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
          aria-hidden="true"
        />
        <span>{t('library.loading')}</span>
      </div>
    );
  }

  // ── Render: error state (Req 2.5) ────────────────────────────────────────

  if (loadError) {
    return (
      <div
        role="main"
        aria-label={t('library.title')}
        data-testid="library-view"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
          color: 'var(--md-sys-color-on-surface)',
        }}
      >
        <p
          data-testid="library-load-error"
          style={{
            margin: 0,
            color: 'var(--md-sys-color-error, #ba1a1a)',
            maxWidth: '32rem',
          }}
        >
          {t('library.loadError', { message: loadError })}
        </p>
        <button
          type="button"
          data-testid="library-retry-button"
          onClick={() => void fetchIntents()}
          style={{
            padding: '0.625rem 1.25rem',
            borderRadius: 'var(--radius-md, 0.625rem)',
            border: 'none',
            background: 'var(--md-sys-color-primary, #4343d5)',
            color: 'var(--md-sys-color-on-primary, #ffffff)',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('library.retry')}
        </button>
      </div>
    );
  }

  // ── Render: main view ────────────────────────────────────────────────────

  return (
    <div
      role="main"
      aria-label={t('library.title')}
      data-testid="library-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--md-sys-color-surface, #fafafa)',
        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: '1.5rem 2rem 1rem',
          borderBottom: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
          flexShrink: 0,
        }}
      >
        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            gap: '1rem',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface, #191c1d)',
                lineHeight: 1.3,
              }}
            >
              {t('library.title')}
            </h1>
            <p
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.8125rem',
                color: 'var(--md-sys-color-on-surface-variant, #464555)',
              }}
            >
              {t('library.subtitle')}
            </p>
          </div>

          {/* Action buttons — stubs for sub-tasks 9.3 and 9.4 */}
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            <button
              type="button"
              data-testid="library-new-document-button"
              onClick={handleCreateNew}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md, 0.625rem)',
                border: 'none',
                background: 'var(--md-sys-color-primary, #4343d5)',
                color: 'var(--md-sys-color-on-primary, #ffffff)',
                fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t('library.newDocument')}
            </button>
            <button
              type="button"
              data-testid="library-open-file-button"
              disabled={isImporting}
              aria-label={t('library.openFileAriaLabel')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-md, 0.625rem)',
                border: '1.5px solid var(--md-sys-color-outline-variant, #c5c4d4)',
                background: 'var(--md-sys-color-surface-container-low, #f3f3f7)',
                color: 'var(--md-sys-color-on-surface-variant, #464555)',
                fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: isImporting ? 'not-allowed' : 'pointer',
                opacity: isImporting ? 0.6 : 1,
              }}
            >
              {isImporting ? t('library.import.importing') : t('library.openFile')}
            </button>
          </div>
        </div>

        {/* Search region — role="search" (Req 10.5) */}
        <div role="search" aria-label={t('library.searchPlaceholder')}>
          <LibrarySearchBar
            value={searchInput}
            onChange={setSearchInput}
            onClear={handleClearSearch}
            autoFocus
          />
        </div>

        {/* Filter chips */}
        <div style={{ marginTop: '0.75rem' }}>
          <LibraryFilterChips
            activeFilter={activeFilter}
            onChange={setActiveFilter}
          />
        </div>
      </div>

      {/* ── Import error banner ── */}
      {importError && (
        <div
          data-testid="library-import-error"
          role="alert"
          style={{
            padding: '0.75rem 2rem',
            background: 'var(--md-sys-color-error-container, #ffdad6)',
            color: 'var(--md-sys-color-on-error-container, #410002)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            flexShrink: 0,
          }}
        >
          {t('library.import.errorMessage', { message: importError })}
        </div>
      )}

      {/* ── Import warnings banner ── */}
      {importWarnings.length > 0 && (
        <div
          data-testid="library-import-warnings"
          role="status"
          style={{
            padding: '0.75rem 2rem',
            background: 'var(--md-sys-color-secondary-container, #e4e0f7)',
            color: 'var(--md-sys-color-on-secondary-container, #1d1b4b)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            flexShrink: 0,
          }}
        >
          {t('library.import.warningsMessage', { count: importWarnings.length })}
        </div>
      )}

      {/* ── Delete error banner ── */}
      {deleteError && (
        <div
          data-testid="library-delete-error"
          role="alert"
          style={{
            padding: '0.75rem 2rem',
            background: 'var(--md-sys-color-error-container, #ffdad6)',
            color: 'var(--md-sys-color-on-error-container, #410002)',
            fontSize: '0.875rem',
            fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
            flexShrink: 0,
          }}
        >
          {t('library.delete.errorMessage', { message: deleteError })}
        </div>
      )}

      {/* ── Document grid region — role="region" (Req 10.5) ── */}
      <div
        role="region"
        aria-label={t('library.title')}
        data-testid="library-grid-region"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem 2rem',
        }}
      >
        {/* Empty state: no documents at all (Req 2.3) */}
        {intents.length === 0 && (
          <LibraryEmptyState
            reason="no-documents"
            onCreateNew={handleCreateNew}
          />
        )}

        {/* Empty state: search/filter yielded no results */}
        {intents.length > 0 && displayedIntents.length === 0 && (
          <LibraryEmptyState
            reason="no-results"
            searchQuery={searchQuery}
            onCreateNew={handleClearSearch}
          />
        )}

        {/* Document grid (Req 2.2) — full layout wired in sub-task 9.6 */}
        {displayedIntents.length > 0 && (
          <div
            data-testid="library-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '1rem',
            }}
          >
            {displayedIntents.map((summary) => (
              <LibraryCard
                key={summary.id}
                summary={summary}
                isLoading={cardLoadingId === summary.id}
                hasError={cardErrorId === summary.id}
                onOpen={handleCardOpen}
                onDelete={handleCardDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/*
        The following state values are declared here for completeness (per the design spec)
        and will be actively used in sub-tasks 9.2, 9.4, and 9.5:
          - deleteTargetId, isDeleting, conflictState
        They are referenced below to satisfy TypeScript's noUnusedLocals check.
      */}
      {deleteTargetId !== undefined && isDeleting !== undefined && conflictState !== undefined && null}
    </div>
  );
}
