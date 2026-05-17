# Implementation Plan: Archive Management

## Overview

Implement the Archive Management feature for the WordAI desktop editor — a dedicated full-screen view accessible via the "Archive" tab in the TopNavBar for managing archived documents, old versions, paused projects, and inactive drafts. The implementation follows existing patterns: no router, inline styles with CSS variables, React hooks for local state, Tauri IPC for backend communication, and react-i18next for all user-facing strings. The view features a bento-grid layout with AI-powered suggestions, a chronological versions list, paused project folders, and a right-side Detail Drawer.

## Tasks

- [x] 1. Extend global state and types for archive tab
  - [x] 1.1 Extend `activeTab` type in `stateManager.tsx` to include `'archive'`
    - Change `activeTab` type from `'editor' | 'library'` to `'editor' | 'library' | 'archive'` in `AppState` interface
    - Update `SET_ACTIVE_TAB` action payload type to `'editor' | 'library' | 'archive'`
    - Update `setActiveTab` callback type in `AppContextValue`
    - Update all type references in `TopNavBarProps` and `LibraryViewProps` to include `'archive'`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Create archive data types in `src/types/archiveTypes.ts`
    - Define `ArchivedIntentSummary` interface (id, intent_name, archived_at, archive_reason, archive_type, related_current_id, memory_access_enabled, created_at, updated_at, version)
    - Define `ArchivedIntentDocument` interface extending `ArchivedIntentSummary` with content and description
    - Define `ArchiveSuggestion` interface (id, archive_item_id, category, title, description, archived_at, relevance_score)
    - Define `PausedProject` interface (id, name, description, document_count, paused_at, document_ids)
    - Define `ArchivedVersion` interface (id, intent_name, version, archived_at, archive_reason, related_current_id)
    - Define `ArchiveFilters` interface (types array, dateRange)
    - Define `ArchiveCategory` type ('drafts' | 'projects' | 'versions' | 'trash')
    - Define `AISummaryState` interface (status, text, retryCount, maxRetries)
    - _Requirements: 3.5, 3.6, 4.1, 4.2, 5.3, 6.3, 7.9, 10.3_

- [ ] 2. Implement archive utility functions
  - [ ] 2.1 Create `src/utils/archiveFilters.ts` with filtering and sorting logic
    - Implement `applyArchiveFilters(items, query, filters)` — case-insensitive substring match on title/reason, type filter, date range filter
    - Implement `sortVersionsByDate(versions)` — sort by `archived_at` descending
    - Implement `truncateReason(reason, maxLength)` — truncate at 200 chars with ellipsis, return placeholder for empty/null
    - Export all functions as named exports
    - _Requirements: 3.3, 3.6, 3.7, 5.3, 8.3_

  - [ ] 2.2 Write property test for archive filtering (Property 1) in `src/utils/archiveFilters.property.test.ts`
    - **Property 1: Archive filtering returns only matching items**
    - **Validates: Requirements 3.3, 3.6, 3.7**
    - For any set of archived items, any search query, and any filter combination, all items in the result contain the query as a case-insensitive substring of title or reason AND match all filter criteria
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

  - [ ] 2.3 Write property test for version sorting (Property 2) in `src/utils/archiveFilters.property.test.ts`
    - **Property 2: Version list items are sorted by archival date descending**
    - **Validates: Requirements 5.3**
    - For any set of archived versions, each item's `archived_at` is >= the next item's `archived_at`
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

  - [ ] 2.4 Write property test for reason truncation (Property 6) in `src/utils/archiveFilters.property.test.ts`
    - **Property 6: Archive reason truncation**
    - **Validates: Requirements 8.3**
    - For any string > 200 chars, result is first 200 chars + ellipsis; for <= 200 chars, result is the full string; for empty/null, result is placeholder text
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement ArchiveSidebar component
  - [ ] 4.1 Create `src/components/ArchiveSidebar.tsx`
    - Accept props: `activeCategory`, `onCategoryChange`, `onNewEntry`
    - Render fixed-width 288px panel with `role="navigation"`
    - Display category links (Drafts, Projects, Versions, Trash) with active/inactive styling
    - Display "New Entry" button with primary background and add icon
    - Highlight active category with white background, primary color, bold weight, box-shadow
    - Use CSS variables for all colors, fonts, and spacing
    - Support vertical scroll for overflow content
    - _Requirements: 2.1, 2.2, 2.3, 2.9, 2.10_

  - [ ] 4.2 Write unit tests for `ArchiveSidebar` in `src/components/ArchiveSidebar.test.tsx`
    - Test that active category has correct styling
    - Test that clicking a category calls `onCategoryChange` with correct value
    - Test that clicking "New Entry" calls `onNewEntry`
    - Test that `role="navigation"` is present
    - _Requirements: 2.1, 2.3, 14.4_

- [ ] 5. Implement ArchiveSearchBar component
  - [ ] 5.1 Create `src/components/ArchiveSearchBar.tsx`
    - Accept props: `value`, `onChange`, `onClear`, `onToggleFilters`, `isFilterPanelOpen`
    - Render glass-panel styled input with search icon, max-width 768px
    - Show clear button when value is non-empty
    - Show "Filters" button on right side with toggle state
    - Use `role="search"` on container, `role="searchbox"` on input
    - Minimum touch target height of 48px
    - _Requirements: 3.1, 3.2, 3.4, 3.9, 13.6, 14.1_

  - [ ] 5.2 Write unit tests for `ArchiveSearchBar` in `src/components/ArchiveSearchBar.test.tsx`
    - Test clear button visibility based on value
    - Test that typing calls `onChange`
    - Test that clear button calls `onClear`
    - Test that filters button calls `onToggleFilters`
    - _Requirements: 3.1, 3.9_

- [ ] 6. Implement SuggestionCard component
  - [ ] 6.1 Create `src/components/SuggestionCard.tsx`
    - Accept props: `suggestion`, `isPrimary`, `onReview`, `onCompare`, `onRestore`
    - Render category badge, title, description (max 3 lines truncated), relative time, action link
    - Primary card: glass-panel + aura-shadow + primary/10 border
    - Secondary cards: glass-panel + ambient-shadow + outline-variant/10 border
    - "Referenced Work" category: show "Compare" and "Restore" buttons instead of "Review"
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.2 Write property test for SuggestionCard (Property 3) in `src/components/SuggestionCard.property.test.tsx`
    - **Property 3: Suggestion card renders all required fields**
    - **Validates: Requirements 4.2**
    - For any valid `ArchiveSuggestion`, rendered output contains category badge, title, description excerpt, relative time, and action element
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

- [ ] 7. Implement VersionListItem component
  - [ ] 7.1 Create `src/components/VersionListItem.tsx`
    - Accept props: `version`, `onOpen`, `onCompare`, `onRestore`
    - Render horizontal row with document icon, title, relative timestamp, reason
    - Show "Compare" and "Restore" circular action buttons on hover/focus
    - Clicking title/body area calls `onOpen`
    - _Requirements: 5.3, 5.4, 5.5_

  - [ ] 7.2 Write unit tests for `VersionListItem` in `src/components/VersionListItem.test.tsx`
    - Test that clicking title calls `onOpen`
    - Test that Compare button calls `onCompare`
    - Test that Restore button calls `onRestore`
    - Test that all metadata fields are rendered
    - _Requirements: 5.3, 5.4, 5.5_

- [ ] 8. Implement PausedProjectCard component
  - [ ] 8.1 Create `src/components/PausedProjectCard.tsx`
    - Accept props: `project`, `onOpen`
    - Render folder icon (48px), project name (truncated at 60 chars), document count, description (max 2 lines), relative timestamp, "Open Folder" link
    - Apply surface-container-lowest background, rounded-xl, outline-variant/10 border, ambient-shadow
    - Decorative circle element (64px) in top-right that scales 1.1x on hover
    - _Requirements: 6.3, 6.5_

  - [ ] 8.2 Write property test for PausedProjectCard (Property 4) in `src/components/PausedProjectCard.property.test.tsx`
    - **Property 4: Paused project card renders all required fields**
    - **Validates: Requirements 6.3**
    - For any valid `PausedProject`, rendered output contains folder icon, name (truncated at 60), document count, description (max 2 lines), timestamp, and "Open Folder" link
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

- [ ] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement DetailDrawer component
  - [ ] 10.1 Create `src/components/DetailDrawer.tsx` with layout and focus management
    - Accept props: `isOpen`, `item`, `isLoading`, `loadError`, `onClose`, `onRestore`, `onCompare`, `onOpenReadOnly`, `onSaveToLibrary`, `onDelete`, `onToggleMemoryAccess`, `onRetryLoad`, `triggerRef`
    - Render right-side overlay panel with max-width 672px, 500ms ease-out slide-in transition
    - Implement focus trap (Tab/Shift+Tab cycle within drawer)
    - Close on Escape key, Scrim click, or close button
    - Return focus to trigger element on close
    - Render Scrim with inverse-surface/10 background and 2px backdrop blur
    - Use `role="dialog"`, `aria-modal="true"`, `role="complementary"` on container
    - Full-screen on viewports < 768px
    - _Requirements: 7.1, 7.2, 7.4, 7.5, 7.6, 7.7, 7.8, 13.5, 14.2, 14.3, 14.5_

  - [ ] 10.2 Implement DetailDrawer content sections (metadata, AI summary, actions)
    - Render header with archive type badge (inventory_2 icon) and document title
    - Render metadata section: archived date, reason (truncated via `truncateReason`), related current file link
    - Render AI Summary section with loading/success/error states and retry logic (max 3 attempts, 30s timeout)
    - Render Memory Access Toggle section
    - Render sticky footer action bar with frosted-glass background
    - Primary actions: "Restore to Drafts", "Compare with Current", "Open Read-only"
    - Secondary actions: "Save to Library", "Delete Permanently"
    - Disable "Compare with Current" when no related current file
    - Show error state with retry button when item data fails to load
    - _Requirements: 7.3, 7.9, 7.10, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 11.1, 11.2, 11.3, 11.6, 11.7_

  - [ ] 10.3 Write property test for focus trap (Property 5) in `src/components/DetailDrawer.property.test.tsx`
    - **Property 5: Detail Drawer focus trap contains focus**
    - **Validates: Requirements 7.8, 14.2**
    - For any sequence of Tab/Shift+Tab presses while drawer is open, focused element is always within the drawer container
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

- [ ] 11. Implement MemoryAccessToggle component
  - [ ] 11.1 Create `src/components/MemoryAccessToggle.tsx`
    - Accept props: `enabled`, `isUpdating`, `error`, `onChange`
    - Render toggle switch with memory icon, title, description
    - Optimistic UI update on toggle
    - Announce state to screen readers via aria-live
    - Operable via Space key
    - Surface-container-lowest background, rounded-xl, border transitions to primary/30 on hover
    - _Requirements: 10.1, 10.2, 10.3, 10.6, 10.8_

  - [ ] 11.2 Write property test for memory access toggle revert (Property 7) in `src/components/MemoryAccessToggle.property.test.tsx`
    - **Property 7: Memory access toggle reverts on persistence failure**
    - **Validates: Requirements 10.7**
    - For any initial state, when toggle changes and persistence fails, toggle reverts to prior value and error message is displayed
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`

- [ ] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Implement ArchiveView root component
  - [ ] 13.1 Create `src/components/ArchiveView.tsx` — data fetching and local state
    - Accept props: `onOpenDocument`, `onTabChange`, `currentDocumentId`
    - On mount, invoke `list_archived_intents` IPC and store results
    - Request AI suggestions via `invoke('get_archive_suggestions', { active_doc_id })` if active document exists
    - Fetch paused projects via `invoke('list_paused_projects')`
    - Manage local state: archivedItems, suggestions, pausedProjects, isLoading, loadError, searchInput, searchQuery (debounced 300ms), activeCategory, activeFilters, selectedItemId, isDrawerOpen
    - Show loading state while fetching, error state with retry on failure
    - _Requirements: 1.1, 2.4, 2.5, 3.3, 4.8, 6.7, 6.8_

  - [ ] 13.2 Implement ArchiveView layout and bento grid
    - Render ArchiveSidebar (hidden below md breakpoint, show mobile bottom nav instead)
    - Render header with "Archive" title (3rem, extrabold) and subtitle
    - Render ArchiveSearchBar below header
    - Render 12-column bento grid: 4-col left (suggestions), 8-col right (versions + paused projects)
    - Collapse to single column below lg breakpoint (1024px)
    - Render "Suggested to Review" section with SuggestionCards (max 5)
    - Render "Old Versions" section with VersionListItems (max 5) and "View All" link
    - Render "Paused Projects" section with PausedProjectCards (max 6, 2-col grid) and "View All" link
    - Show empty states for each section when no data
    - Show filter panel when toggled with type and date range options
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8, 3.5, 3.7, 3.8, 4.1, 4.5, 4.6, 4.7, 5.1, 5.2, 5.10, 6.1, 6.2, 6.6, 13.1, 13.2, 13.3, 13.4, 13.7_

  - [ ] 13.3 Implement ArchiveView actions (restore, delete, compare, drawer coordination)
    - Wire Detail Drawer open/close with selected item
    - Implement restore flow: confirmation dialog → `invoke('restore_intent')` → remove from list → success notification
    - Implement delete flow: confirmation dialog → `invoke('delete_intent')` → remove from list → close drawer
    - Implement compare flow: open side-by-side view, handle missing related document error
    - Implement save-to-library flow: `invoke('sync_intent')` → success notification
    - Implement memory access toggle: optimistic update → `invoke('update_memory_access')` → revert on failure
    - Implement AI summary generation with 30s timeout and max 3 retries
    - _Requirements: 4.3, 4.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.4, 11.4, 11.5, 11.8, 11.9, 11.10, 11.11, 11.12, 10.4, 10.5, 10.6, 10.7_

- [ ] 14. Modify TopNavBar to support archive tab
  - [ ] 14.1 Update `TopNavBar` to wire the "Archive" button to `onTabChange('archive')`
    - Change the Archive button's `onClick` from `onTabChange?.('editor')` to `onTabChange?.('archive')`
    - Apply active styling when `activeTab === 'archive'` (primary color, bold, underline)
    - Apply inactive styling to Archive button when other tabs are active
    - Update `activeTab` prop type to `'editor' | 'library' | 'archive'`
    - _Requirements: 1.1, 1.3, 1.4_

  - [ ] 14.2 Write unit tests for TopNavBar archive tab in `src/components/TopNavBar.test.tsx`
    - Test that `activeTab='archive'` applies active style to "Archive" and inactive to others
    - Test that clicking "Archive" calls `onTabChange('archive')`
    - Test that clicking "Drafts" while on archive calls `onTabChange('editor')`
    - _Requirements: 1.3, 1.4_

- [ ] 15. Modify App.tsx to wire ArchiveView
  - [ ] 15.1 Add conditional rendering for ArchiveView in `App.tsx`
    - Import `ArchiveView` component
    - Add `activeTab === 'archive'` condition to render `ArchiveView` (same wrapper pattern as LibraryView)
    - Pass `onOpenDocument={handleOpenDocumentFromLibrary}`, `onTabChange={setActiveTab}`, `currentDocumentId={document?.id ?? null}`
    - Ensure unsaved document state is preserved in memory when navigating to archive
    - Keep `<aside>` sidebar visible in archive view
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_

- [ ] 16. Add i18n translation keys
  - [ ] 16.1 Add all `archive.*` translation keys to `src/i18n/locales/en.json`
    - Add keys for: archive title, subtitle, sidebar categories, search placeholder, filter labels, section titles, empty states, drawer labels, action buttons, error messages, loading states, confirmation dialogs, accessibility labels
    - _Requirements: 12.1, 14.4_

  - [ ] 16.2 Add all `archive.*` translation keys to `src/i18n/locales/vi.json`
    - Add Vietnamese translations for all keys added in 16.1
    - _Requirements: 12.1, 14.4_

- [ ] 17. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 18. Add archive styles and responsive behavior
  - [ ] 18.1 Implement responsive layout and visual polish
    - Ensure bento grid collapses to single column below lg breakpoint
    - Ensure sidebar hides and mobile bottom nav shows below md breakpoint
    - Ensure Detail Drawer goes full-screen below md breakpoint
    - Verify all CSS custom properties are used (no hardcoded colors/fonts)
    - Verify glass-panel effects, shadows, and transitions match design tokens
    - Verify Material Symbols icons use correct FILL values (0 default, 1 active)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_

  - [ ] 18.2 Write accessibility integration tests in `src/components/ArchiveView.test.tsx`
    - Test ARIA landmark roles (main, navigation, search, complementary, dialog)
    - Test keyboard navigation (Tab, Shift+Tab, Enter, Space, Escape)
    - Test focus management (drawer focus trap, focus return on close)
    - Test screen reader announcements for Memory Access Toggle
    - Test visible focus indicators on all interactive elements
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [ ] 19. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `ArchiveView` follows the same mount/unmount pattern as `LibraryView` — never hidden with CSS
- All components use inline styles with CSS variables — no new CSS files
- The `<aside>` sidebar in `App.tsx` must remain outside the conditional render block
- Pure filter/sort functions are extracted to `src/utils/archiveFilters.ts` for independent testing
- AI summary generation uses a 30-second timeout with max 3 retry attempts
- Memory access toggle uses optimistic UI with revert on failure

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "4.1", "5.1"] },
    { "id": 3, "tasks": ["4.2", "5.2", "6.1", "7.1", "8.1"] },
    { "id": 4, "tasks": ["6.2", "7.2", "8.2", "11.1"] },
    { "id": 5, "tasks": ["10.1", "11.2"] },
    { "id": 6, "tasks": ["10.2", "10.3"] },
    { "id": 7, "tasks": ["13.1"] },
    { "id": 8, "tasks": ["13.2", "13.3"] },
    { "id": 9, "tasks": ["14.1", "15.1"] },
    { "id": 10, "tasks": ["14.2", "16.1", "16.2"] },
    { "id": 11, "tasks": ["18.1", "18.2"] }
  ]
}
```
