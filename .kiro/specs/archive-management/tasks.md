# Implementation Plan: Archive Management

## Overview

Implement the Archive Management feature for the WordAI desktop editor — a full-screen view for managing archived documents, old versions, paused projects, and AI-powered review suggestions. The implementation extends the existing navigation model (`activeTab`), follows the same patterns as LibraryView (local state via React hooks, Tauri IPC for backend, inline styles with CSS variables), and introduces a new `archived_intents` SQLite table in the Rust backend.

## Tasks

- [x] 1. Define archive types and extend global state
  - [x] 1.1 Create archive type definitions in `src/types/archive.ts`
    - Define `ArchivedIntentSummary`, `ArchivedIntentDocument`, `ArchiveSuggestion`, `PausedProject`, `ArchivedVersion`, `ArchiveFilters`, `AISummaryState` interfaces
    - Define `ArchiveCategory` type as `'drafts' | 'projects' | 'versions' | 'trash'`
    - Export all types as named exports
    - _Requirements: 2.1, 3.5, 4.1, 5.1, 6.1, 7.1_

  - [x] 1.2 Extend `activeTab` in `stateManager.tsx` to include `'archive'`
    - Update `AppState.activeTab` type from `'editor' | 'library'` to `'editor' | 'library' | 'archive'`
    - Update `SET_ACTIVE_TAB` action payload type to include `'archive'`
    - Ensure `setActiveTab` callback accepts the new union type
    - _Requirements: 1.1, 1.2, 1.7_

  - [x] 1.3 Add i18n keys for archive feature in `en.json` and `vi.json`
    - Add `archive.*` namespace with keys for all labels, placeholders, error messages, empty states, ARIA labels, and action button text
    - _Requirements: 12.1, 14.4_

- [ ] 2. Implement archive utility functions
  - [x] 2.1 Create `src/utils/archiveFilters.ts` with pure filter/sort/truncate functions
    - Implement `applyArchiveFilters(items, query, filters)` — case-insensitive substring match on `intent_name` and `archive_reason`, type filter mapping, date range cutoff, sorted by `archived_at` descending
    - Implement `sortAndLimitVersions(versions, maxCount?)` — sort by `archived_at` descending, return at most `maxCount` (default 5)
    - Implement `truncateReason(reason, placeholder?)` — return placeholder if null/undefined/empty, return unchanged if ≤200 chars, else first 200 chars + "…"
    - Implement `isCompareDisabled(relatedCurrentId)` — return `true` if null or undefined
    - _Requirements: 3.3, 3.6, 3.7, 5.3, 8.3, 11.6_

  - [~] 2.2 Write property test for `applyArchiveFilters`
    - **Property 2: Archive filter correctness**
    - **Validates: Requirements 3.3, 3.6, 3.7**

  - [~] 2.3 Write property test for `sortAndLimitVersions`
    - **Property 3: Version list sorting and limit invariant**
    - **Validates: Requirements 5.3**

  - [~] 2.4 Write property test for `truncateReason`
    - **Property 4: Archive reason truncation correctness**
    - **Validates: Requirements 8.3**

  - [~] 2.5 Write property test for `isCompareDisabled`
    - **Property 5: Compare button disabled state derivation**
    - **Validates: Requirements 11.6**

- [~] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement ArchiveSidebar component
  - [x] 4.1 Create `src/components/ArchiveSidebar.tsx`
    - Accept props: `activeCategory`, `onCategoryChange`, `onNewEntry`
    - Render `role="navigation"` container with fixed 288px width
    - Display category links (Drafts, Projects, Versions, Trash) with active/inactive styling per design tokens
    - Display "New Entry" button with primary background, add icon, and centered text
    - Support vertical scroll overflow
    - Use inline styles with CSS variables (`--md-sys-color-*`, `--font-family-ui`, `--radius-*`, `--shadow-*`)
    - _Requirements: 2.1, 2.2, 2.3, 2.9, 2.10, 12.1, 12.2, 12.5_

  - [~] 4.2 Write unit tests for `ArchiveSidebar` in `src/components/ArchiveSidebar.test.tsx`
    - Test active category highlighting
    - Test "New Entry" button click calls `onNewEntry`
    - Test category link click calls `onCategoryChange` with correct category
    - Test ARIA navigation role
    - _Requirements: 2.1, 2.2, 2.3, 14.4_

- [ ] 5. Implement ArchiveSearchBar and ArchiveFilterPanel
  - [x] 5.1 Create `src/components/ArchiveSearchBar.tsx`
    - Accept props: `value`, `onChange`, `onClear`, `onToggleFilters`, `isFilterPanelOpen`
    - Render `role="search"` container with glass-panel effect (white bg + backdrop blur), rounded-xl, outline-variant border, search icon
    - Show clear button when value is non-empty
    - Show "Filters" button on right side
    - Max width 768px, minimum touch target height 48px
    - _Requirements: 3.1, 3.2, 3.4, 3.9, 13.6, 14.4_

  - [x] 5.2 Create `src/components/ArchiveFilterPanel.tsx`
    - Accept props: `filters`, `onChange`, `onClear`
    - Render filter options for item type (Suggestions, Versions, Paused Projects) as toggleable chips/checkboxes
    - Render date range options (Last 7 days, Last 30 days, Last 90 days, All time) as radio-style selection
    - _Requirements: 3.5, 3.6_

  - [~] 5.3 Write unit tests for `ArchiveSearchBar` and `ArchiveFilterPanel`
    - Test clear button visibility based on value
    - Test filter panel toggle
    - Test filter selection callbacks
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.9_

- [ ] 6. Implement SuggestionCard component
  - [~] 6.1 Create `src/components/SuggestionCard.tsx`
    - Accept props: `suggestion`, `isPrimary`, `onReview`, `onCompare?`, `onRestore?`
    - Render category badge, title, description (max 3 lines with ellipsis), archived-date (relative time), and action link
    - Primary variant: glass-panel, `--shadow-ambient-strong`, primary/10 border
    - Secondary variant: glass-panel, `--shadow-ambient`, outline-variant/10 border
    - "Referenced Work" category: show "Compare" and "Restore" buttons instead of "Review" link
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 12.6, 12.7_

  - [~] 6.2 Write unit tests for `SuggestionCard`
    - Test primary vs secondary styling
    - Test "Referenced Work" variant renders Compare/Restore buttons
    - Test default variant renders Review link
    - Test click handlers
    - _Requirements: 4.2, 4.4, 4.5_

- [ ] 7. Implement VersionListItem component
  - [~] 7.1 Create `src/components/VersionListItem.tsx`
    - Accept props: `version`, `onOpen`, `onCompare`, `onRestore`
    - Render document icon in rounded container, title (font-headline, semibold), relative timestamp, archival reason
    - Show "Compare" and "Restore" circular action buttons on hover/focus
    - Handle click on title/body to open detail drawer
    - Display inline error if related document unavailable on compare
    - _Requirements: 5.3, 5.4, 5.5, 5.6, 5.7, 12.2, 12.5_

  - [~] 7.2 Write unit tests for `VersionListItem`
    - Test action buttons visible on hover
    - Test click on body calls `onOpen`
    - Test Compare/Restore button click handlers
    - _Requirements: 5.4, 5.5, 5.6_

- [ ] 8. Implement PausedProjectCard component
  - [~] 8.1 Create `src/components/PausedProjectCard.tsx`
    - Accept props: `project`, `onOpen`
    - Render folder icon (48px rounded), project name (truncated at 60 chars), document count, description (max 2 lines), relative timestamp, "Open Folder" link
    - Apply surface-container-lowest background, rounded-xl, outline-variant/10 border, ambient-shadow
    - Decorative 64px circle in top-right, scales to 1.1x on hover (300ms ease-in-out)
    - _Requirements: 6.2, 6.3, 6.5, 12.1, 12.8_

  - [~] 8.2 Write unit tests for `PausedProjectCard`
    - Test project name truncation at 60 characters
    - Test "Open Folder" click calls `onOpen`
    - Test document count display
    - _Requirements: 6.3, 6.4_

- [~] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Implement DetailDrawer with metadata and AI summary
  - [~] 10.1 Create `src/hooks/useFocusTrap.ts` custom hook
    - Implement focus trapping: Tab/Shift+Tab cycle within container
    - Move focus to first focusable element on activation
    - Return focus to trigger element on deactivation
    - Handle Escape key to close
    - _Requirements: 7.1, 7.5, 7.6, 7.8, 14.2, 14.3_

  - [~] 10.2 Create `src/hooks/useAISummary.ts` custom hook
    - Accept `itemId: string | null`
    - Invoke `generate_archive_summary` with 30s timeout
    - Track loading/success/error state and retry count (max 3)
    - Return `{ state: AISummaryState, retry: () => void }`
    - _Requirements: 9.4, 9.5, 9.6, 9.7_

  - [~] 10.3 Create `src/components/DetailDrawer.tsx`
    - Accept props per `DetailDrawerProps` interface from design
    - Slide in from right with 500ms ease-out, max-width 672px
    - Full-screen on mobile (< 768px)
    - Render Scrim overlay (inverse-surface/10, 2px backdrop blur)
    - Close on Escape, Scrim click, or close button (X icon at top-right)
    - Apply `role="dialog"`, `aria-modal="true"`
    - Use `useFocusTrap` hook for keyboard focus management
    - Render header with archive type badge and document title
    - Render metadata section (archived date, reason, related current file link)
    - Render AI summary section using `useAISummary` hook
    - Scrollable content area independent of main view
    - Display error state with retry if item data fails to load
    - _Requirements: 7.1–7.10, 8.1–8.6, 9.1–9.7, 13.5, 14.2, 14.3, 14.5_

  - [~] 10.4 Write unit tests for `DetailDrawer`
    - Test drawer opens with slide animation
    - Test Escape key closes drawer
    - Test Scrim click closes drawer
    - Test focus trap behavior
    - Test focus restoration to trigger element
    - Test error state rendering
    - Test metadata section displays correctly
    - Test AI summary loading/success/error states
    - _Requirements: 7.1, 7.5, 7.6, 7.8, 9.4, 9.5, 14.2, 14.3_

- [ ] 11. Implement MemoryAccessToggle component
  - [~] 11.1 Create `src/components/MemoryAccessToggle.tsx`
    - Accept props: `enabled`, `isUpdating`, `error`, `onChange`
    - Render section with surface-container-lowest background, rounded-xl, border transitioning to primary/30 on hover
    - Display memory icon, title, description, and toggle switch aligned right
    - Toggle operable via click and Space key
    - Announce state via `aria-live="polite"`
    - Display inline error message on persistence failure
    - _Requirements: 10.1–10.8, 14.6_

  - [~] 11.2 Write property test for MemoryAccessToggle state revert
    - **Property 6: Toggle state revert on persistence failure**
    - **Validates: Requirements 10.7**

- [ ] 12. Implement DrawerActionBar component
  - [~] 12.1 Create `src/components/DrawerActionBar.tsx`
    - Accept props: `itemId`, `hasRelatedFile`, `onRestore`, `onCompare`, `onOpenReadOnly`, `onSaveToLibrary`, `onDelete`
    - Render sticky footer with frosted-glass background (surface-container-lowest/90, 12px backdrop blur, top border)
    - Primary row: "Restore to Drafts" (primary bg, flex-1), "Compare with Current" (surface bg, flex-1, disabled if no related file), "Open Read-only" (bordered, fixed width)
    - Secondary row: "Save to Library" (left, bookmark_add icon), "Delete Permanently" (right, error color, delete_forever icon)
    - _Requirements: 11.1–11.3, 11.6_

  - [~] 12.2 Write unit tests for `DrawerActionBar`
    - Test "Compare with Current" disabled when `hasRelatedFile` is false
    - Test all button click handlers
    - Test button labels and icons
    - _Requirements: 11.1–11.3, 11.6_

- [~] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement ArchiveView main container and wire components
  - [~] 14.1 Create `src/components/ArchiveView.tsx`
    - Accept props: `onOpenDocument`, `onTabChange`, `currentDocumentId`
    - Manage local state: `archivedItems`, `suggestions`, `pausedProjects`, `isLoading`, `loadError`, `searchInput`, `searchQuery` (debounced 300ms), `activeCategory`, `activeFilters`, `selectedItemId`, `isDrawerOpen`
    - Fetch data on mount via `Promise.all` (list_archived_intents, get_archive_suggestions, list_paused_projects)
    - Render header with "Archive" title (3rem, extrabold) and subtitle
    - Render ArchiveSidebar (hidden below md breakpoint, show mobile bottom nav instead)
    - Render ArchiveSearchBar and ArchiveFilterPanel
    - Render BentoGrid layout: 4-column left (Suggested to Review section) + 8-column right (Old Versions + Paused Projects)
    - Apply `applyArchiveFilters` via `useMemo` for filtered display
    - Show empty state when no results match
    - Show loading skeletons during data fetch
    - Show error state with retry on load failure
    - Coordinate DetailDrawer open/close with selected item
    - Handle restore, delete, save-to-library, compare, and open-read-only actions via Tauri IPC
    - Show ConfirmationDialog for restore and delete actions
    - Display non-blocking success notifications for restore, save, and delete
    - Responsive: 12-column grid at lg (1024px+), single-column below lg, sidebar hidden below md (768px)
    - Apply `role="main"` on content area
    - _Requirements: 1.1, 2.1–2.10, 3.1–3.9, 4.1–4.8, 5.1–5.10, 6.1–6.8, 11.4–11.12, 12.1–12.8, 13.1–13.7, 14.1, 14.4_

  - [~] 14.2 Wire ArchiveView into `App.tsx`
    - Conditionally render `<ArchiveView>` when `state.activeTab === 'archive'`
    - Pass `onOpenDocument`, `onTabChange`, and `currentDocumentId` props
    - Ensure TopNavBar shows "Archive" tab with active styling when archive is active
    - Preserve unsaved document state when switching to archive tab
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [~] 14.3 Write property test for document state preservation across tab switches
    - **Property 1: Document state preservation across tab switches**
    - **Validates: Requirements 1.6**

  - [~] 14.4 Write integration tests for ArchiveView
    - Test data fetching on mount
    - Test search filtering with debounce
    - Test filter panel interaction
    - Test drawer open/close flow
    - Test restore action flow (confirmation → IPC → UI update)
    - Test delete action flow (confirmation → IPC → UI removal)
    - Test empty states for each section
    - _Requirements: 1.1, 3.3, 3.6, 4.3, 5.5, 11.4, 11.10_

- [~] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All styling uses existing CSS design tokens — no hardcoded values
- The feature follows the same patterns as LibraryView (local state, Tauri IPC, inline styles)
- `fast-check` and `vitest` are already in devDependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "4.1", "5.1", "5.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2", "5.3", "6.1", "7.1", "8.1"] },
    { "id": 3, "tasks": ["6.2", "7.2", "8.2", "10.1", "10.2"] },
    { "id": 4, "tasks": ["10.3", "11.1", "12.1"] },
    { "id": 5, "tasks": ["10.4", "11.2", "12.2"] },
    { "id": 6, "tasks": ["14.1"] },
    { "id": 7, "tasks": ["14.2"] },
    { "id": 8, "tasks": ["14.3", "14.4"] }
  ]
}
```
