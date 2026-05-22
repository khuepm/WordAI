/**
 * ArchiveView — Full-screen archive management view.
 *
 * Fetches archived items, AI suggestions, and paused projects on mount.
 * Manages search/filter state, detail drawer, and all archive actions.
 *
 * Requirements: 1.1, 2.1–2.10, 3.1–3.9, 4.1–4.8, 5.1–5.10, 6.1–6.8,
 *   11.4–11.12, 12.1–12.8, 13.1–13.7, 14.1, 14.4
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import type { Document } from '../types/document';
import type {
  ArchivedIntentSummary,
  ArchivedIntentDocument,
  ArchiveSuggestion,
  PausedProject,
  ArchiveCategory,
  ArchiveFilters,
} from '../types/archive';
import { applyArchiveFilters, sortAndLimitVersions } from '../utils/archiveFilters';
import { auraIntentToDocument } from '../services/auraDocumentAdapter';
import { ArchiveSidebar } from './ArchiveSidebar';
import { ArchiveSearchBar } from './ArchiveSearchBar';
import { ArchiveFilterPanel } from './ArchiveFilterPanel';
import { SuggestionCard } from './SuggestionCard';
import { VersionListItem } from './VersionListItem';
import { PausedProjectCard } from './PausedProjectCard';
import { DetailDrawer } from './DetailDrawer';
import { ConfirmationDialog } from './ConfirmationDialog';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ArchiveViewProps {
  onOpenDocument: (doc: Document) => void;
  onTabChange: (tab: 'editor' | 'library' | 'archive') => void;
  currentDocumentId: string | null;
}

// ─── Notification type ────────────────────────────────────────────────────────

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'error';
}

// ─── Confirmation dialog state ────────────────────────────────────────────────

interface ConfirmAction {
  type: 'restore' | 'delete';
  itemId: string;
  itemName: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Extract a human-readable message from Tauri IPC errors (which are objects, not Error instances). */
function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && err !== null) {
    if ('message' in err && typeof (err as { message: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    return JSON.stringify(err);
  }
  return String(err);
}

export function ArchiveView({ onOpenDocument, onTabChange, currentDocumentId }: ArchiveViewProps) {
  const { t } = useTranslation();

  // ── Local state ──────────────────────────────────────────────────────────
  const [archivedItems, setArchivedItems] = useState<ArchivedIntentSummary[]>([]);
  const [suggestions, setSuggestions] = useState<ArchiveSuggestion[]>([]);
  const [pausedProjects, setPausedProjects] = useState<PausedProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hasFetchedOnce = useRef(false);

  // Search: raw input (immediate) and debounced query (300ms)
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Sidebar & filters
  const [activeCategory, setActiveCategory] = useState<ArchiveCategory>('drafts');
  const [activeFilters, setActiveFilters] = useState<ArchiveFilters>({ types: [], dateRange: 'all' });
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Detail drawer
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<ArchivedIntentDocument | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);

  // Confirmation dialog
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // ── Data fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    // Only show full-page loading on initial mount
    if (!hasFetchedOnce.current) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setLoadError(null);
    try {
      const [items, sug, projects] = await Promise.all([
        invoke<ArchivedIntentSummary[]>('list_archived_intents', { category: activeCategory }),
        // AI suggestions are optional — skip if no document is open
        // and gracefully handle failures (missing API key, etc.)
        currentDocumentId
          ? invoke<ArchiveSuggestion[]>('get_archive_suggestions', { active_doc_id: currentDocumentId, api_key: '', endpoint: null })
            .catch(() => [] as ArchiveSuggestion[])
          : Promise.resolve([] as ArchiveSuggestion[]),
        invoke<PausedProject[]>('list_paused_projects'),
      ]);
      setArchivedItems(Array.isArray(items) ? items : []);
      setSuggestions(Array.isArray(sug) ? sug : []);
      setPausedProjects(Array.isArray(projects) ? projects : []);
      hasFetchedOnce.current = true;
    } catch (err) {
      const message = extractErrorMessage(err);
      setLoadError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeCategory, currentDocumentId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ── Debounced search (300ms) ─────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Filtered items via useMemo ───────────────────────────────────────────

  const filteredItems = useMemo(
    () => applyArchiveFilters(archivedItems, searchQuery, activeFilters),
    [archivedItems, searchQuery, activeFilters],
  );

  // ── Versions (sorted, max 5) ────────────────────────────────────────────

  const displayedVersions = useMemo(() => {
    const versionItems = filteredItems
      .filter((item) => item.archive_type === 'version')
      .map((item) => ({
        id: item.id,
        intent_name: item.intent_name,
        version: item.version,
        archived_at: item.archived_at,
        archive_reason: item.archive_reason,
        related_current_id: item.related_current_id,
      }));
    return sortAndLimitVersions(versionItems, 5);
  }, [filteredItems]);

  // ── Notification helpers ─────────────────────────────────────────────────

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  // ── Detail Drawer handlers ───────────────────────────────────────────────

  const openDrawer = useCallback(async (itemId: string) => {
    setSelectedItemId(itemId);
    setIsDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError(null);
    setDrawerItem(null);
    try {
      const item = await invoke<ArchivedIntentDocument>('get_archived_intent', { id: itemId });
      setDrawerItem(item);
    } catch (err) {
      const message = extractErrorMessage(err);
      setDrawerError(message);
    } finally {
      setDrawerLoading(false);
    }
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setSelectedItemId(null);
    setDrawerItem(null);
    setDrawerError(null);
  }, []);

  const retryDrawerLoad = useCallback(() => {
    if (selectedItemId) {
      void openDrawer(selectedItemId);
    }
  }, [selectedItemId, openDrawer]);

  // ── Action handlers ──────────────────────────────────────────────────────

  const handleRestore = useCallback((itemId: string) => {
    const item = archivedItems.find((i) => i.id === itemId);
    setConfirmAction({
      type: 'restore',
      itemId,
      itemName: item?.intent_name ?? '',
    });
  }, [archivedItems]);

  const handleDelete = useCallback((itemId: string) => {
    const item = archivedItems.find((i) => i.id === itemId);
    setConfirmAction({
      type: 'delete',
      itemId,
      itemName: item?.intent_name ?? '',
    });
  }, [archivedItems]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction) return;
    const { type, itemId } = confirmAction;
    setConfirmAction(null);

    if (type === 'restore') {
      try {
        const restored = await invoke<ArchivedIntentDocument>('restore_intent', { id: itemId });
        const doc = auraIntentToDocument(restored as never).value;
        setArchivedItems((prev) => prev.filter((i) => i.id !== itemId));
        closeDrawer();
        showNotification(t('archive.notifications.restored'), 'success');
        onOpenDocument(doc);
        onTabChange('editor');
      } catch (err) {
        const message = extractErrorMessage(err);
        showNotification(t('archive.notifications.restoreFailed', { message }), 'error');
      }
    } else if (type === 'delete') {
      try {
        await invoke('delete_archived_intent', { id: itemId });
        setArchivedItems((prev) => prev.filter((i) => i.id !== itemId));
        closeDrawer();
        showNotification(t('archive.notifications.deleted'), 'success');
      } catch (err) {
        const message = extractErrorMessage(err);
        showNotification(t('archive.notifications.deleteFailed', { message }), 'error');
      }
    }
  }, [confirmAction, closeDrawer, showNotification, t, onOpenDocument, onTabChange]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmAction(null);
  }, []);

  const handleSaveToLibrary = useCallback(async (itemId: string) => {
    try {
      await invoke('sync_intent', { id: itemId });
      showNotification(t('archive.notifications.savedToLibrary'), 'success');
    } catch (err) {
      const message = extractErrorMessage(err);
      showNotification(t('archive.notifications.saveFailed', { message }), 'error');
    }
  }, [showNotification, t]);

  const handleCompare = useCallback(async (itemId: string) => {
    try {
      await invoke('compare_with_current', { id: itemId });
    } catch (err) {
      const message = extractErrorMessage(err);
      showNotification(t('archive.notifications.compareFailed', { message }), 'error');
    }
  }, [showNotification, t]);

  const handleOpenReadOnly = useCallback(async (itemId: string) => {
    try {
      await invoke('open_read_only', { id: itemId });
    } catch (err) {
      const message = extractErrorMessage(err);
      showNotification(t('archive.notifications.openFailed', { message }), 'error');
    }
  }, [showNotification, t]);

  const handleToggleMemoryAccess = useCallback(async (itemId: string, enabled: boolean) => {
    try {
      await invoke('update_memory_access', { id: itemId, enabled });
    } catch {
      // DetailDrawer handles optimistic revert internally
    }
  }, []);

  const handleNewEntry = useCallback(() => {
    // Navigate to editor with a new document
    onTabChange('editor');
  }, [onTabChange]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters({ types: [], dateRange: 'all' });
  }, []);

  // ── Render: loading state ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        role="main"
        aria-label={t('archive.title')}
        data-testid="archive-view"
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
          data-testid="archive-loading"
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
        <span>{t('archive.loading')}</span>
      </div>
    );
  }

  // ── Render: error state ──────────────────────────────────────────────────

  if (loadError) {
    return (
      <div
        role="main"
        aria-label={t('archive.title')}
        data-testid="archive-view"
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
        <span
          className="material-symbols-outlined"
          aria-hidden="true"
          style={{ fontSize: '3rem', color: 'var(--md-sys-color-error)' }}
        >
          error_outline
        </span>
        <p
          data-testid="archive-load-error"
          style={{
            margin: 0,
            color: 'var(--md-sys-color-error, #ba1a1a)',
            maxWidth: '32rem',
          }}
        >
          {t('archive.errors.loadFailed', { message: loadError })}
        </p>
        <button
          type="button"
          data-testid="archive-retry-button"
          onClick={() => void fetchData()}
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
          {t('archive.retry')}
        </button>
      </div>
    );
  }

  // ── Render: main view ────────────────────────────────────────────────────

  const hasNoResults = filteredItems.length === 0 && (searchQuery || activeFilters.types.length > 0 || activeFilters.dateRange !== 'all');

  return (
    <div
      data-testid="archive-view"
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
      }}
    >
      {/* ── Sidebar (hidden below md) ── */}
      <div
        data-testid="archive-sidebar-container"
        style={{
          display: 'var(--archive-sidebar-display, flex)',
          flexShrink: 0,
        }}
      >
        <ArchiveSidebar
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
          onNewEntry={handleNewEntry}
        />
      </div>

      {/* ── Main content area ── */}
      <div
        role="main"
        aria-label={t('archive.title')}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '3rem 2rem 4rem',
        }}
      >
        <div style={{ maxWidth: '80rem', margin: '0 auto' }}>
          {/* ── Header ── */}
          <div style={{ marginBottom: '2rem' }}>
            <h1
              style={{
                margin: 0,
                fontSize: '3rem',
                fontWeight: 800,
                fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                letterSpacing: '-0.02em',
                color: 'var(--md-sys-color-on-background, #191c1d)',
                lineHeight: 'var(--line-height-tight, 1.25)',
              }}
            >
              {t('archive.title')}
            </h1>
            <p
              style={{
                margin: '0.5rem 0 0',
                fontSize: '1.25rem',
                color: 'var(--md-sys-color-on-surface-variant, #464555)',
                fontFamily: 'var(--font-family-content, Newsreader, serif)',
                maxWidth: '40rem',
              }}
            >
              {t('archive.subtitle')}
            </p>
          </div>

          {/* ── Search Bar ── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <ArchiveSearchBar
              value={searchInput}
              onChange={setSearchInput}
              onClear={handleClearSearch}
              onToggleFilters={() => setIsFilterPanelOpen((prev) => !prev)}
              isFilterPanelOpen={isFilterPanelOpen}
            />
          </div>

          {/* ── Filter Panel ── */}
          {isFilterPanelOpen && (
            <div style={{ marginBottom: '1.5rem', maxWidth: '768px' }}>
              <ArchiveFilterPanel
                filters={activeFilters}
                onChange={setActiveFilters}
                onClear={handleClearFilters}
              />
            </div>
          )}

          {/* ── Empty state ── */}
          {hasNoResults && (
            <div
              data-testid="archive-empty-state"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                textAlign: 'center',
                gap: '1rem',
              }}
            >
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
                style={{ fontSize: '3rem', color: 'var(--md-sys-color-on-surface-variant)' }}
              >
                search_off
              </span>
              <p style={{
                margin: 0,
                fontSize: 'var(--font-size-base, 1rem)',
                color: 'var(--md-sys-color-on-surface-variant)',
              }}>
                {t('archive.emptyState.noResults.title')}
              </p>
              <button
                type="button"
                onClick={() => {
                  handleClearSearch();
                  handleClearFilters();
                }}
                style={{
                  padding: '0.625rem 1.25rem',
                  borderRadius: 'var(--radius-md, 0.625rem)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  background: 'var(--md-sys-color-surface-container-low)',
                  color: 'var(--md-sys-color-primary)',
                  fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('archive.filters.clearAll')}
              </button>
            </div>
          )}

          {/* ── Bento Grid Layout ── */}
          {!hasNoResults && (
            <div
              data-testid="archive-bento-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)',
                gap: '8px',
              }}
            >
              {/* ── Left column: Suggested to Review (4 cols) ── */}
              <div
                style={{
                  gridColumn: 'span 4',
                }}
                data-testid="archive-suggestions-column"
              >
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}>
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{
                        fontSize: '1.5rem',
                        color: 'var(--md-sys-color-primary, #4343d5)',
                        fontVariationSettings: "'FILL' 1",
                      }}
                    >
                      auto_awesome
                    </span>
                    <h2 style={{
                      margin: 0,
                      fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-on-background, #191c1d)',
                    }}>
                      {t('archive.sections.suggestedToReview')}
                    </h2>
                  </div>

                  {/* Suggestion cards (max 5) */}
                  {suggestions.length === 0 ? (
                    <p style={{
                      fontFamily: 'var(--font-family-content, Newsreader, serif)',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontStyle: 'italic',
                    }}>
                      {t('archive.suggestions.placeholder')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {suggestions.slice(0, 5).map((suggestion, index) => (
                        <SuggestionCard
                          key={suggestion.id}
                          suggestion={suggestion}
                          isPrimary={index === 0}
                          onReview={(id) => void openDrawer(id)}
                          onCompare={(id) => void handleCompare(id)}
                          onRestore={(id) => handleRestore(id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Right column: Old Versions + Paused Projects (8 cols) ── */}
              <div
                style={{
                  gridColumn: 'span 8',
                }}
                data-testid="archive-content-column"
              >
                {/* ── Old Versions section ── */}
                <section style={{ marginBottom: '2.5rem' }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className="material-symbols-outlined"
                        aria-hidden="true"
                        style={{
                          fontSize: '1.5rem',
                          color: 'var(--md-sys-color-on-surface-variant)',
                        }}
                      >
                        history
                      </span>
                      <h2 style={{
                        margin: 0,
                        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                        fontSize: '1.25rem',
                        fontWeight: 700,
                        color: 'var(--md-sys-color-on-background, #191c1d)',
                      }}>
                        {t('archive.sections.oldVersions')}
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveCategory('versions')}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                        fontSize: 'var(--font-size-sm, 0.875rem)',
                        fontWeight: 500,
                        color: 'var(--md-sys-color-primary, #4343d5)',
                        cursor: 'pointer',
                      }}
                    >
                      {t('archive.viewAll')}
                    </button>
                  </div>

                  {displayedVersions.length === 0 ? (
                    <p style={{
                      fontFamily: 'var(--font-family-content, Newsreader, serif)',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontStyle: 'italic',
                    }}>
                      {t('archive.versions.empty')}
                    </p>
                  ) : (
                    <div role="list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {displayedVersions.map((version) => (
                        <VersionListItem
                          key={version.id}
                          version={version}
                          onOpen={(id) => void openDrawer(id)}
                          onCompare={(id) => void handleCompare(id)}
                          onRestore={(id) => handleRestore(id)}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {/* ── Paused Projects section ── */}
                <section>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1rem',
                  }}>
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                      style={{
                        fontSize: '1.5rem',
                        color: 'var(--md-sys-color-on-surface-variant)',
                      }}
                    >
                      pause_circle
                    </span>
                    <h2 style={{
                      margin: 0,
                      fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                      fontSize: '1.25rem',
                      fontWeight: 700,
                      color: 'var(--md-sys-color-on-background, #191c1d)',
                    }}>
                      {t('archive.sections.pausedProjects')}
                    </h2>
                  </div>

                  {pausedProjects.length === 0 ? (
                    <p style={{
                      fontFamily: 'var(--font-family-content, Newsreader, serif)',
                      fontSize: 'var(--font-size-sm, 0.875rem)',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      fontStyle: 'italic',
                    }}>
                      {t('archive.pausedProjects.empty')}
                    </p>
                  ) : (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: '1rem',
                    }}>
                      {pausedProjects.slice(0, 6).map((project) => (
                        <PausedProjectCard
                          key={project.id}
                          project={project}
                          onOpen={(id) => void openDrawer(id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile bottom nav (shown below md) ── */}
      <nav
        data-testid="archive-mobile-nav"
        aria-label={t('archive.title')}
        style={{
          display: 'var(--archive-mobile-nav-display, none)',
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
          borderTop: '1px solid var(--md-sys-color-outline-variant, #c7c4d7)',
          padding: '0.5rem 1rem',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 50,
        }}
      >
        {(['drafts', 'projects', 'versions', 'trash'] as ArchiveCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.5rem',
              minWidth: '48px',
              minHeight: '48px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeCategory === cat
                ? 'var(--md-sys-color-primary, #4343d5)'
                : 'var(--md-sys-color-on-surface-variant, #464555)',
              fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
              fontSize: 'var(--font-size-xs, 0.75rem)',
              fontWeight: activeCategory === cat ? 600 : 400,
            }}
          >
            <span
              className="material-symbols-outlined"
              aria-hidden="true"
              style={{
                fontSize: '1.25rem',
                fontVariationSettings: activeCategory === cat ? "'FILL' 1" : "'FILL' 0",
              }}
            >
              {cat === 'drafts' ? 'draft' : cat === 'projects' ? 'folder' : cat === 'versions' ? 'history' : 'delete'}
            </span>
            <span>{t(`archive.sidebar.${cat}`)}</span>
          </button>
        ))}
      </nav>

      {/* ── Detail Drawer ── */}
      <DetailDrawer
        isOpen={isDrawerOpen}
        item={drawerItem}
        isLoading={drawerLoading}
        loadError={drawerError}
        onClose={closeDrawer}
        onRestore={handleRestore}
        onCompare={(id) => void handleCompare(id)}
        onOpenReadOnly={(id) => void handleOpenReadOnly(id)}
        onSaveToLibrary={(id) => void handleSaveToLibrary(id)}
        onDelete={handleDelete}
        onToggleMemoryAccess={(id, enabled) => void handleToggleMemoryAccess(id, enabled)}
        onRetryLoad={retryDrawerLoad}
        triggerRef={drawerTriggerRef as React.RefObject<HTMLElement>}
      />

      {/* ── Confirmation Dialog ── */}
      <ConfirmationDialog
        isOpen={confirmAction !== null}
        title={
          confirmAction?.type === 'restore'
            ? t('archive.confirm.restoreTitle')
            : t('archive.confirm.deleteTitle')
        }
        message={
          confirmAction?.type === 'restore'
            ? t('archive.confirm.restoreMessage', { name: confirmAction?.itemName ?? '' })
            : t('archive.confirm.deleteMessage', { name: confirmAction?.itemName ?? '' })
        }
        confirmLabel={
          confirmAction?.type === 'restore'
            ? t('archive.actions.restore')
            : t('archive.actions.deletePermanently')
        }
        cancelLabel={t('archive.confirm.cancel')}
        isDangerous={confirmAction?.type === 'delete'}
        onConfirm={() => void handleConfirmAction()}
        onCancel={handleCancelConfirm}
      />

      {/* ── Notifications ── */}
      {notifications.length > 0 && (
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          {notifications.map((notification) => (
            <div
              key={notification.id}
              role="status"
              style={{
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-lg, 0.75rem)',
                backgroundColor: notification.type === 'success'
                  ? 'var(--md-sys-color-primary, #4343d5)'
                  : 'var(--md-sys-color-error, #ba1a1a)',
                color: '#ffffff',
                fontFamily: 'var(--font-family-ui, Manrope, sans-serif)',
                fontSize: 'var(--font-size-sm, 0.875rem)',
                fontWeight: 500,
                boxShadow: 'var(--shadow-ambient-strong)',
                animation: 'slideInFromRight 300ms ease-out',
              }}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 767px) {
          [data-testid="archive-sidebar-container"] {
            display: none !important;
          }
          [data-testid="archive-mobile-nav"] {
            display: flex !important;
          }
          [data-testid="archive-bento-grid"] {
            grid-template-columns: 1fr !important;
          }
          [data-testid="archive-suggestions-column"],
          [data-testid="archive-content-column"] {
            grid-column: span 1 !important;
          }
        }
        @media (min-width: 768px) {
          [data-testid="archive-mobile-nav"] {
            display: none !important;
          }
        }
        @media (max-width: 1023px) {
          [data-testid="archive-bento-grid"] {
            grid-template-columns: 1fr !important;
          }
          [data-testid="archive-suggestions-column"],
          [data-testid="archive-content-column"] {
            grid-column: span 1 !important;
          }
        }
      `}</style>
    </div>
  );
}
