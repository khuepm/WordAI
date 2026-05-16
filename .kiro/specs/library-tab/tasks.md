# Implementation Plan: Library Tab

## Overview

Implement the Library Tab feature for the WordAI desktop editor — a full-screen document management view that replaces the static "Library" nav link with a navigable tab. The implementation follows the existing patterns: no router, no new npm packages, inline styles with CSS variables, React Context + useReducer for global state, and Tauri IPC for all backend communication.

## Tasks

- [x] 1. Extend global state with `activeTab`
  - [x] 1.1 Add `activeTab: 'editor' | 'library'` field to `AppState` interface and `initialState` in `stateManager.tsx`
    - Add `activeTab: 'editor' | 'library'` to the `AppState` interface
    - Set `activeTab: 'editor'` in `initialState`
    - Add `{ type: 'SET_ACTIVE_TAB'; payload: 'editor' | 'library' }` to the `Action` union type
    - Add the `SET_ACTIVE_TAB` case to `appReducer` returning `{ ...state, activeTab: action.payload }`
    - Add `setActiveTab: (tab: 'editor' | 'library') => void` to `AppContextValue`
    - Implement `setActiveTab` callback in `AppStateProvider` and expose it via context
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create `formatRelativeTime` utility
  - [x] 2.1 Implement `formatRelativeTime(updatedAt: number): string` in `src/utils/formatRelativeTime.ts`
    - Implement the pure function exactly as specified in the design: `< 1 min → 'Just now'`, `< 60 min → '{n}m ago'`, `< 24 h → '{n}h ago'`, `< 7 d → '{n}d ago'`, else `toLocaleDateString()`
    - Export the function as a named export
    - _Requirements: 2.6_
  - [x] 2.2 Write property tests for `formatRelativeTime` in `src/utils/formatRelativeTime.test.ts`
    - Test that any timestamp within the last minute returns `'Just now'`
    - Test that any timestamp 1–59 minutes ago returns a string ending in `'m ago'`
    - Test that any timestamp 1–23 hours ago returns a string ending in `'h ago'`
    - Test that any timestamp 1–6 days ago returns a string ending in `'d ago'`
    - Test that any timestamp ≥ 7 days ago returns a non-empty string (locale date)
    - Use `fc.assert(fc.property(...), { numRuns: 100 })`
    - _Requirements: 2.6_

- [x] 3. Create `ConfirmationDialog` component
  - [x] 3.1 Implement `ConfirmationDialog` in `src/components/ConfirmationDialog.tsx`
    - Accept props: `isOpen`, `title`, `message`, `confirmLabel`, `cancelLabel`, `isDangerous?`, `onConfirm`, `onCancel`
    - Render a modal overlay with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `data-testid="confirmation-dialog"`
    - Use `t('confirmationDialog.ariaLabel')` for the dialog's `aria-label`
    - Apply `isDangerous` flag to render the confirm button in `var(--md-sys-color-error)` color
    - Use inline styles with CSS variables (`--md-sys-color-*`, `--font-family-ui`, `--radius-*`)
    - Close on backdrop click (same pattern as `ReplaceConfirmationDialog`)
    - _Requirements: 9.2, 9.5_
  - [x] 3.2 Write unit tests for `ConfirmationDialog` in `src/components/ConfirmationDialog.test.tsx`
    - Test that `isOpen=false` renders nothing
    - Test that `isOpen=true` renders the title, message, confirmLabel, and cancelLabel
    - Test that clicking confirm calls `onConfirm`
    - Test that clicking cancel calls `onCancel`
    - Test that `isDangerous=true` applies error color to the confirm button
    - _Requirements: 9.2, 9.5_

- [x] 4. Create `LibrarySearchBar` component
  - [x] 4.1 Implement `LibrarySearchBar` in `src/components/LibrarySearchBar.tsx`
    - Accept props: `value`, `onChange`, `onClear`, `autoFocus?`
    - Render a controlled `<input>` with `role="searchbox"`, `aria-label={t('library.searchPlaceholder')}`, and `placeholder={t('library.searchPlaceholder')}`
    - Show a clear `<button>` with `aria-label={t('library.searchClearAriaLabel')}` only when `value` is non-empty
    - Pass `autoFocus` to the `<input>` element
    - Use inline styles with CSS variables
    - _Requirements: 7.1, 7.5, 10.2, 10.4, 10.5_
  - [x] 4.2 Write unit tests for `LibrarySearchBar` in `src/components/LibrarySearchBar.test.tsx`
    - Test that the clear button is absent when `value` is empty
    - Test that the clear button is present when `value` is non-empty
    - Test that clicking the clear button calls `onClear`
    - Test that typing calls `onChange` with the new value
    - _Requirements: 7.1, 7.5_

- [x] 5. Create `LibraryFilterChips` component
  - [x] 5.1 Implement `LibraryFilterChips` in `src/components/LibraryFilterChips.tsx`
    - Accept props: `activeFilter: 'all' | 'documents' | 'ai-ready'`, `onChange`
    - Render three `<button>` chips: "All" (`t('library.filters.all')`), "Documents" (`t('library.filters.documents')`), "AI-ready" (`t('library.filters.aiReady')`)
    - Apply active visual style (primary color background and border) to the chip matching `activeFilter`
    - Use inline styles with CSS variables
    - _Requirements: 8.1, 8.4, 8.5_
  - [x] 5.2 Write unit tests for `LibraryFilterChips` in `src/components/LibraryFilterChips.test.tsx`
    - Test that the "All" chip has active style when `activeFilter='all'`
    - Test that clicking "Documents" calls `onChange('documents')`
    - Test that clicking "AI-ready" calls `onChange('ai-ready')`
    - Test that clicking "All" calls `onChange('all')`
    - _Requirements: 8.1, 8.2, 8.5_

- [x] 6. Create `LibraryEmptyState` component
  - [x] 6.1 Implement `LibraryEmptyState` in `src/components/LibraryEmptyState.tsx`
    - Accept props: `reason: 'no-documents' | 'no-results'`, `searchQuery?`, `onCreateNew`
    - For `'no-documents'`: render `t('library.emptyState.noDocuments.title')`, `t('library.emptyState.noDocuments.message')`, and a CTA button calling `onCreateNew`
    - For `'no-results'`: render `t('library.emptyState.noResults.title')`, `t('library.emptyState.noResults.message', { query: searchQuery })`, and a clear-search CTA
    - Use inline styles with CSS variables
    - _Requirements: 2.3, 7.4_
  - [x] 6.2 Write unit tests for `LibraryEmptyState` in `src/components/LibraryEmptyState.test.tsx`
    - Test that `reason='no-documents'` renders the correct heading and CTA
    - Test that `reason='no-results'` renders the correct heading with the query interpolated
    - Test that clicking the CTA in `'no-documents'` mode calls `onCreateNew`
    - _Requirements: 2.3, 7.4_

- [x] 7. Create `LibraryCard` component
  - [x] 7.1 Implement `LibraryCard` in `src/components/LibraryCard.tsx`
    - Accept props: `summary: AuraIntentSummary`, `isLoading`, `hasError`, `onOpen`, `onDelete`
    - Render: document icon (`description` material symbol), `intent_name` (single-line truncated), relative timestamp via `formatRelativeTime(summary.updated_at)` prefixed with `t('library.card.updatedAt', { time })`, version badge via `t('library.card.version', { version: summary.version })`
    - Render a delete `<button>` with `aria-label={t('library.card.deleteAriaLabel', { name: summary.intent_name })}` visible on hover/focus
    - Show a loading spinner overlay when `isLoading` is true; use `aria-label={t('library.card.loadingAriaLabel', { name: summary.intent_name })}`
    - Show inline error text `t('library.card.errorMessage')` when `hasError` is true
    - Make the card itself a `<button>` (or use `role="button"`) with `aria-label={t('library.card.openAriaLabel', { name: summary.intent_name })}` that calls `onOpen(summary.id)`
    - Provide a visible focus indicator (outline) for keyboard navigation
    - Use inline styles with CSS variables
    - _Requirements: 2.6, 2.7, 4.1, 4.5, 4.6, 9.1, 10.2, 10.3_
  - [x] 7.2 Write property test for `LibraryCard` metadata rendering in `src/components/LibraryCard.property.test.tsx`
    - **Property 8: Library_Card always renders all required metadata fields**
    - **Validates: Requirements 2.6**
    - For any `AuraIntentSummary`, assert the rendered card contains `intent_name`, a non-empty timestamp string, and the `version` number
    - Use `fc.assert(fc.property(arbitraryAuraIntentSummary(), ...), { numRuns: 100 })`
  - [x] 7.3 Write unit tests for `LibraryCard` in `src/components/LibraryCard.test.tsx`
    - Test that clicking the card calls `onOpen` with the correct `id`
    - Test that clicking the delete button calls `onDelete` with the correct `id`
    - Test that `isLoading=true` shows the loading spinner
    - Test that `hasError=true` shows the error message
    - _Requirements: 4.1, 4.5, 4.6, 9.1_

- [x] 8. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create `LibraryView` component
  - [x] 9.1 Implement `LibraryView` in `src/components/LibraryView.tsx` — data fetching and local state
    - Accept props: `onOpenDocument: (doc: Document) => void`, `onTabChange: (tab: 'editor' | 'library') => void`, `currentDocumentId: string | null`
    - On mount, invoke `list_intents` IPC and store results in local state; show loading indicator while pending (Req 2.4); show error state with retry button on failure (Req 2.5)
    - Manage local state: `intents`, `isLoading`, `loadError`, `searchQuery`, `activeFilter`, `cardLoadingId`, `cardErrorId`, `isImporting`, `importError`, `importWarnings`, `deleteTargetId`, `isDeleting`, `deleteError`, `conflictState`
    - Implement `applySearchFilter(intents, query)` — case-insensitive substring match on `intent_name`
    - Implement `applyFilterChip(intents, filter)` — `'all'` returns all; `'documents'` returns all; `'ai-ready'` returns intents with `version >= 2`
    - Compose both filters to produce the displayed list; sort by `updated_at` descending
    - Use a 300ms debounce via `useEffect` for the search query (Req 7.2)
    - Auto-focus the `LibrarySearchBar` on mount via `autoFocus` prop (Req 10.4)
    - Apply ARIA landmark roles: `role="main"` on the view root, `role="search"` on the search region, `role="region"` on the grid area
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 7.2, 7.3, 8.6, 10.4, 10.5_
  - [x] 9.2 Implement card open flow in `LibraryView`
    - On card click, set `cardLoadingId` to the card's `id`, invoke `get_intent`, convert result via `auraIntentToDocument`, call `onOpenDocument(doc)` and `onTabChange('editor')`, store `id` in `localStorage` under `wordai_last_intent_id`
    - On `get_intent` failure, set `cardErrorId` and display inline error on the card; do not navigate
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [-] 9.3 Implement new document flow in `LibraryView`
    - Render a "New Document" button (`t('library.newDocument')`) always visible
    - On click, create an in-memory `Document` with `crypto.randomUUID()`, `title: 'Untitled Intent'`, empty content, `version: 1`, call `onOpenDocument(doc)` and `onTabChange('editor')`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [-] 9.4 Implement import (Open File) flow in `LibraryView`
    - Render an "Open File" button (`t('library.openFile')`) with `aria-label={t('library.openFileAriaLabel')}`; disable it while `isImporting` is true
    - Call `importFile({ onConflict, onOpenIntent })` from `exportService.ts`
    - Wire `onConflict` to store a `ConflictState` (with `resolve` function) in local state, which renders `ReplaceConfirmationDialog`
    - Wire `onOpenIntent` to call `onOpenDocument(doc)` and `onTabChange('editor')`
    - On `status: 'error'`, set `importError`; on `status: 'opened'` with warnings, set `importWarnings`
    - Show a non-blocking warning notification when `importWarnings` is non-empty (Req 6.5)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9_
  - [-] 9.5 Implement delete flow in `LibraryView`
    - On delete button click on a card, set `deleteTargetId` to show `ConfirmationDialog` with title `t('library.delete.confirmTitle')`, message `t('library.delete.confirmMessage', { name })`, `isDangerous=true`
    - On confirm, invoke `delete_intent` IPC; on success, remove the card from `intents` state without a full reload; if the deleted id matches `currentDocumentId`, call `onOpenDocument` with a new blank document
    - On `delete_intent` failure, set `deleteError` and display error message; retain the card
    - On cancel, clear `deleteTargetId` without invoking IPC
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_
  - [-] 9.6 Implement `LibraryView` layout and grid
    - Render the Document_Grid as a CSS grid with `repeat(auto-fill, minmax(240px, 1fr))` for responsive 1–3 column layout
    - Render `LibrarySearchBar`, `LibraryFilterChips`, and the grid of `LibraryCard` components
    - Render `LibraryEmptyState` with `reason='no-documents'` when `intents` is empty after load, or `reason='no-results'` when the filtered list is empty but `intents` is not
    - Apply `var(--md-sys-color-*)`, `var(--font-family-ui)`, `var(--radius-*)` CSS variables throughout
    - _Requirements: 2.3, 7.4, 10.1, 10.5, 10.6_

- [x] 10. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Modify `TopNavBar` to support tab switching
  - [x] 11.1 Add `activeTab` and `onTabChange` props to `TopNavBar` and convert nav links to buttons
    - Add `activeTab?: 'editor' | 'library'` and `onTabChange?: (tab: 'editor' | 'library') => void` to `TopNavBarProps`
    - Replace the three `<a>` nav links with `<button>` elements
    - "Drafts" and "Archive" buttons call `onTabChange?.('editor')`; "Library" button calls `onTabChange?.('library')`
    - Apply active style (bold weight, primary color, underline) to the button matching `activeTab`; apply inactive style to others
    - Default `activeTab` to `'editor'` when prop is not provided (backward-compatible)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x] 11.2 Write unit tests for `TopNavBar` tab switching in `src/components/TopNavBar.test.tsx`
    - Test that `activeTab='editor'` applies active style to "Drafts" and inactive style to "Library"
    - Test that `activeTab='library'` applies active style to "Library" and inactive style to "Drafts"
    - Test that clicking "Library" calls `onTabChange('library')`
    - Test that clicking "Drafts" calls `onTabChange('editor')`
    - _Requirements: 1.3, 1.4_

- [x] 12. Modify `App.tsx` to wire `activeTab` and render `LibraryView`
  - [x] 12.1 Destructure `activeTab` and `setActiveTab` from `useAppState()` and wire to `TopNavBar`
    - Destructure `activeTab` and `setActiveTab` from `useAppState()`
    - Pass `activeTab={activeTab}` and `onTabChange={setActiveTab}` to `<TopNavBar>`
    - _Requirements: 1.1, 1.2_
  - [x] 12.2 Add `handleOpenDocumentFromLibrary` and conditionally render `LibraryView` vs editor stack
    - Implement `handleOpenDocumentFromLibrary(doc: Document)`: normalize content with `ensureBlockValue`, call `setDocument`, call `auraBrainManager.initializeSyncedBaseline`, store id in `localStorage`, call `setActiveTab('editor')`
    - Replace the unconditional editor stack render with a conditional: when `activeTab === 'library'` render `<LibraryView onOpenDocument={handleOpenDocumentFromLibrary} onTabChange={setActiveTab} currentDocumentId={document?.id ?? null} />`; otherwise render the existing editor stack
    - Keep the `<aside>` sidebar outside the conditional so it remains visible in both views (Req 1.5)
    - _Requirements: 1.1, 1.2, 1.5, 3.3, 3.4, 4.2, 4.3, 4.4_

- [x] 13. Add i18n translation keys
  - [x] 13.1 Add all new `library.*` and `confirmationDialog.*` keys to `src/i18n/locales/vi.json`
    - Add the complete `library` object with all keys listed in the design document (Vietnamese values)
    - Add `confirmationDialog.ariaLabel` key
    - _Requirements: 10.5_
  - [x] 13.2 Add all new `library.*` and `confirmationDialog.*` keys to `src/i18n/locales/en.json`
    - Add the complete `library` object with all keys listed in the design document (English values)
    - Add `confirmationDialog.ariaLabel` key
    - _Requirements: 10.5_

- [ ] 14. Write property-based tests for the 8 correctness properties
  - [x] 14.1 Write property test for Property 1 (document list sorted by recency) in `src/components/LibraryView.property.test.tsx`
    - **Property 1: Document list renders cards sorted by recency**
    - **Validates: Requirements 2.2**
    - For any non-empty array of `AuraIntentSummary` records, mock `list_intents` to return them, render `LibraryView`, assert card count equals array length and cards appear in descending `updated_at` order
    - Use `fc.assert(fc.property(fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }), ...), { numRuns: 100 })`
  - [x] 14.2 Write property test for Property 2 (open document switches to editor tab) in `src/components/LibraryView.property.test.tsx`
    - **Property 2: Opening a document from the library always switches to the editor tab**
    - **Validates: Requirements 4.2, 4.3, 4.4**
    - For any valid `AuraIntentDocument`, mock `get_intent` to return it, click the corresponding card, assert `onTabChange` was called with `'editor'` and `localStorage` contains the document's `id` under `wordai_last_intent_id`
    - Use `fc.assert(fc.property(arbitraryAuraIntentDocument(), ...), { numRuns: 100 })`
  - [-] 14.3 Write property test for Property 3 (search filter correctness) in `src/utils/libraryFilters.property.test.ts`
    - **Property 3: Search filter is a correct case-insensitive substring match**
    - **Validates: Requirements 7.2, 7.3**
    - Extract `applySearchFilter` as a pure exported function from `src/utils/libraryFilters.ts`
    - For any array of `AuraIntentSummary` and any query string, assert the filtered set equals the subset whose `intent_name` contains the query as a case-insensitive substring; assert empty query returns all
    - Use `fc.assert(fc.property(fc.array(...), fc.string(), ...), { numRuns: 100 })`
  - [x] 14.4 Write property test for Property 4 (search + filter chip composition) in `src/utils/libraryFilters.property.test.ts`
    - **Property 4: Search and filter chip composition is idempotent and correct**
    - **Validates: Requirements 8.2, 8.3, 8.6**
    - Extract `applyFilters(intents, query, filter)` as a pure exported function from `src/utils/libraryFilters.ts`
    - For any array, query, and filter value, assert applying filters twice produces the same result (idempotence) and all results satisfy both predicates
    - Use `fc.assert(fc.property(fc.array(...), fc.string(), fc.constantFrom('all', 'documents', 'ai-ready'), ...), { numRuns: 100 })`
  - [x] 14.5 Write property test for Property 5 (successful import opens editor) in `src/components/LibraryView.property.test.tsx`
    - **Property 5: Successful import always opens the document in the editor**
    - **Validates: Requirements 6.2, 6.3, 6.4**
    - For any `AuraIntentDocument` returned by a successful import, mock `importFile` to call `onOpenIntent` with the document, assert `onTabChange` was called with `'editor'`
    - Use `fc.assert(fc.property(arbitraryAuraIntentDocument(), ...), { numRuns: 100 })`
  - [x] 14.6 Write property test for Property 6 (delete calls correct id and removes card) in `src/components/LibraryView.property.test.tsx`
    - **Property 6: Delete confirmation calls delete_intent with the correct id and removes the card**
    - **Validates: Requirements 9.3, 9.4**
    - For any non-empty array of summaries and a target index, render `LibraryView`, click delete on the target card, confirm, assert `delete_intent` was called exactly once with the target `id`, assert the card is no longer in the rendered output
    - Use `fc.assert(fc.property(fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }), fc.nat(), ...), { numRuns: 100 })`
  - [x] 14.7 Write property test for Property 7 (cancel never persists changes) in `src/components/LibraryView.property.test.tsx`
    - **Property 7: Cancelling any destructive action never persists changes**
    - **Validates: Requirements 6.9, 9.5**
    - For any non-empty array of summaries and a target index, render `LibraryView`, click delete on the target card, cancel, assert `delete_intent` was never called and the card is still present in the grid
    - Use `fc.assert(fc.property(fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }), fc.nat(), ...), { numRuns: 100 })`
  - [x] 14.8 Write property test for Property 8 (LibraryCard renders all metadata) — already covered in task 7.2
    - This property is implemented as part of task 7.2 (`LibraryCard.property.test.tsx`)
    - Verify the test file exists and covers `intent_name`, timestamp, and `version` for any `AuraIntentSummary`
    - **Property 8: Library_Card always renders all required metadata fields**
    - **Validates: Requirements 2.6**

- [~] 15. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- `LibraryView` is mounted/unmounted on tab switch — never hidden with CSS — so `list_intents` is always fresh
- The `<aside>` sidebar in `App.tsx` must remain outside the conditional render block (Req 1.5)
- `importFile()` from `exportService.ts` already handles the file picker, IPC, and conflict resolution — `LibraryView` only wires the callbacks
- Property tests use `fast-check` (already in `devDependencies`) with `fc.assert(fc.property(...), { numRuns: 100 })`
- Pure filter functions (`applySearchFilter`, `applyFilters`) should be extracted to `src/utils/libraryFilters.ts` so they can be tested independently of the React component
- All new components use inline styles with CSS variables — no new CSS files

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1"] },
    { "id": 3, "tasks": ["4.2", "5.1", "6.1"] },
    { "id": 4, "tasks": ["5.2", "6.2", "7.1"] },
    { "id": 5, "tasks": ["7.2", "7.3", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "9.5", "9.6", "14.3", "14.4"] },
    { "id": 7, "tasks": ["11.1", "14.1", "14.2", "14.5", "14.6", "14.7", "14.8"] },
    { "id": 8, "tasks": ["11.2", "12.1"] },
    { "id": 9, "tasks": ["12.2"] },
    { "id": 10, "tasks": ["13.1", "13.2"] }
  ]
}
```
