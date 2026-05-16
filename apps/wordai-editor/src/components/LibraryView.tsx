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
import { importFile } from '../services/exportService';
import { applyFilters } from '../utils/libraryFilters';
import type { LibraryFilter } from '../utils/libraryFilters';
import { LibrarySearchBar } from './LibrarySearchBar';
import { LibraryFilterChips } from './LibraryFilterChips';
import { LibraryEmptyState } from './LibraryEmptyState';
import { LibraryCard } from './LibraryCard';
import { ReplaceConfirmationDialog } from './ReplaceConfirmationDialog';
import { ConfirmationDialog } from './ConfirmationDialog';

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

  const handleCardDelete = useCallback((id: string) => {
    setDeleteTargetId(id);
    setDeleteError(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    const id = deleteTargetId;
    if (!id || isDeleting) return;
    setIsDeleting(true);
    try {
      await invoke('delete_intent', { id });
      // Remove the card from local state without a full reload
      setIntents((prev) => prev.filter((s) => s.id !== id));
      setDeleteTargetId(null);
      // If the deleted document is the one currently open, open a new blank document
      if (id === currentDocumentIdRef.current) {
        const blankDoc = {
          id: crypto.randomUUID(),
          title: 'Untitled Intent',
          content: '',
          metadata: { wordCount: 0, readingTime: 0, status: 'draft' as const, tags: [] },
          version: 1,
          lastModified: new Date(),
        };
        onOpenDocumentRef.current(blankDoc);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setDeleteError(message);
      setDeleteTargetId(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTargetId, isDeleting]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteTargetId(null);
  }, []);

  const handleCreateNew = useCallback(() => {
    const doc: Document = {
      id: crypto.randomUUID(),
      title: 'Untitled Intent',
      content: '',
      metadata: { wordCount: 0, readingTime: 0, status: 'draft', tags: [] },
      version: 1,
      lastModified: new Date(),
    };
    onOpenDocumentRef.current(doc);
    onTabChangeRef.current('editor');
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  // ── Import (Open File) flow — Req 5.1–5.6, 6.1–6.9 ─────────────────────

  const handleOpenFile = useCallback(async () => {
    setIsImporting(true);
    setImportError(null);
    setImportWarnings([]);

    const result = await importFile({
      onConflict: (intentName, auraIntentId) =>
        new Promise<'update' | 'create_new' | 'cancel'>((resolve) => {
          setConflictState({ intentName, auraIntentId, resolve });
        }),
      onOpenIntent: (doc) => {
        onOpenDocumentRef.current(doc);
        onTabChangeRef.current('editor');
      },
    });

    setIsImporting(false);
    setConflictState(null);

    if (result.status === 'error') {
      setImportError(result.message);
    } else if (result.status === 'opened' && result.warnings.length > 0) {
      setImportWarnings(result.warnings);
    }
  }, []);

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
        background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
      }}
    >
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

      {/* ── Main scrollable canvas ── */}
      <div
        role="region"
        aria-label={t('library.title')}
        data-testid="library-grid-region"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '3rem 2rem 4rem',
        }}
      >
        <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
          {/* ── Page Header ── */}
          <div style={{ marginBottom: '3rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                marginBottom: '0.75rem',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-on-background, #191c1d)',
                }}
              >
                {t('library.title')}
              </h1>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  type="button"
                  data-testid="library-new-document-button"
                  onClick={handleCreateNew}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    background: 'var(--md-sys-color-primary, #4343d5)',
                    color: 'var(--md-sys-color-on-primary, #ffffff)',
                    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 300ms',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                  <span>{t('library.newDocument')}</span>
                </button>
                <button
                  type="button"
                  data-testid="library-open-file-button"
                  onClick={() => void handleOpenFile()}
                  disabled={isImporting}
                  aria-label={t('library.openFileAriaLabel')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.625rem 1.25rem',
                    borderRadius: '0.75rem',
                    border: '1.5px solid var(--md-sys-color-outline-variant, #c5c4d4)',
                    background: 'var(--md-sys-color-surface-container-low, #f3f4f5)',
                    color: 'var(--md-sys-color-on-surface-variant, #464555)',
                    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: isImporting ? 'not-allowed' : 'pointer',
                    opacity: isImporting ? 0.6 : 1,
                    transition: 'all 300ms',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>upload_file</span>
                  <span>{isImporting ? t('library.import.importing') : t('library.openFile')}</span>
                </button>
              </div>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: '1.125rem',
                color: 'var(--md-sys-color-on-surface-variant, #464555)',
                fontFamily: 'var(--font-family-content, Newsreader, serif)',
              }}
            >
              {t('library.subtitle')}
            </p>
          </div>

          {/* ── Prominent Search ── */}
          <div style={{ maxWidth: '56rem', margin: '0 auto 2.5rem' }} role="search" aria-label={t('library.searchPlaceholder')}>
            <LibrarySearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={handleClearSearch}
              autoFocus
            />
          </div>

          {/* ── Filter Chips ── */}
          <div style={{ marginBottom: '3rem' }}>
            <LibraryFilterChips
              activeFilter={activeFilter}
              onChange={setActiveFilter}
            />
          </div>

          {/* ── Content ── */}
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

          {/* ── Document sections ── */}
          {displayedIntents.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
              {/* Section: Recently Used */}
              <section>
                <h2
                  style={{
                    fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                    fontWeight: 700,
                    fontSize: '1.25rem',
                    color: 'var(--md-sys-color-on-background, #191c1d)',
                    marginBottom: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {t('library.sections.recentlyUsed', 'Recently Used')}
                  <span
                    style={{
                      marginLeft: '0.75rem',
                      height: '1px',
                      flex: 1,
                      background: 'linear-gradient(to right, rgba(199, 196, 215, 0.3), transparent)',
                    }}
                  />
                </h2>
                <div
                  data-testid="library-grid"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '1.5rem',
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
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ── ReplaceConfirmationDialog for import conflict (Req 6.6) ── */}
      <ReplaceConfirmationDialog
        isOpen={conflictState !== null}
        intentName={conflictState?.intentName ?? ''}
        auraIntentId={conflictState?.auraIntentId ?? ''}
        onUpdateIntent={() => conflictState?.resolve('update')}
        onCreateNew={() => conflictState?.resolve('create_new')}
        onCancel={() => conflictState?.resolve('cancel')}
      />

      {/* ── ConfirmationDialog for delete (Req 9.2, 9.5) ── */}
      <ConfirmationDialog
        isOpen={deleteTargetId !== null}
        title={t('library.delete.confirmTitle')}
        message={t('library.delete.confirmMessage', {
          name: intents.find((s) => s.id === deleteTargetId)?.intent_name ?? '',
        })}
        confirmLabel={t('library.delete.confirmButton')}
        cancelLabel={t('library.delete.cancelButton')}
        isDangerous
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
