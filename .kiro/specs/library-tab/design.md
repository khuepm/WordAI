# Design Document: Library Tab

## Overview

The Library Tab adds a fully functional document management view to the WordAI desktop editor. It replaces the currently static "Library" `<a>` link in `TopNavBar` with a navigable tab that renders `LibraryView` — a full-screen panel for browsing, searching, filtering, creating, importing, and deleting AuraSphere intent documents stored in AuraBrain.

The implementation follows the existing patterns in the codebase: no router, no new npm packages, inline styles with CSS variables, React Context + useReducer for global state, and Tauri IPC for all backend communication.

### Key Design Decisions

- **Mount/unmount on tab switch** — `LibraryView` is conditionally rendered (not hidden with CSS) so it always fetches fresh data when the user navigates to it. This avoids stale-list bugs without needing a manual refresh mechanism.
- **Local state in `LibraryView`** — loading, error, search query, active filter, and per-card loading states are all local to `LibraryView`. They do not belong in global `AppState` because they are ephemeral UI state that resets naturally on unmount.
- **`activeTab` in global state** — the active tab (`'editor' | 'library'`) is global because `TopNavBar` and `App.tsx` both need to read and write it.
- **Reuse `importFile` from `exportService.ts`** — the import flow (file picker, IPC, conflict resolution) is already fully implemented. `LibraryView` wires the `onConflict` callback to `ReplaceConfirmationDialog` and the `onOpenIntent` callback to the tab-switch action.
- **New `ConfirmationDialog`** — a minimal generic confirmation dialog is introduced for the delete flow. `ReplaceConfirmationDialog` is import-specific (three choices, specific copy) and cannot be reused for a two-choice delete confirmation.

---

## Architecture

### View-Switching Model

`App.tsx` holds a single `activeTab: 'editor' | 'library'` state value (sourced from global `AppState`). The main content area renders either the editor stack or `LibraryView` based on this value:

```
App.tsx
├── TopNavBar (activeTab, onTabChange)
├── Left Sidebar (always visible)
├── [activeTab === 'editor'] → Editor stack (EditorCanvas, panels, StatusBar)
└── [activeTab === 'library'] → LibraryView (onOpenDocument, onTabChange)
```

`LibraryView` is mounted when `activeTab === 'library'` and unmounted when the user switches back to the editor. This guarantees a fresh `list_intents` call on every visit.

### IPC Data Flow

```
LibraryView
  │  mount → invoke('list_intents')
  │  card click → invoke('get_intent', { id })
  │  delete confirm → invoke('delete_intent', { id })
  │  import → importFile({ onConflict, onOpenIntent })
  │              └─ internally calls invoke('import_file')
  │              └─ internally calls syncDocument() → invoke('sync_intent')
  └─ new doc → createInMemoryDocument() → onOpenDocument(doc)
```

---

## Components and Interfaces

### `TopNavBar` (modified)

Add `activeTab` and `onTabChange` props. Convert the three `<a>` nav links to `<button>` elements.

```typescript
interface TopNavBarProps {
  // ... existing props unchanged ...
  /** Currently active top-level tab */
  activeTab?: 'editor' | 'library';
  /** Called when the user clicks a nav tab button */
  onTabChange?: (tab: 'editor' | 'library') => void;
}
```

The "Drafts" and "Archive" buttons both map to `'editor'` (Archive is not yet implemented; clicking it switches to the editor view). The "Library" button maps to `'library'`.

Active style (primary color, bold, underline) is applied to the button matching `activeTab`. Inactive buttons use the muted style.

### `LibraryView`

Main container component. Fetches `list_intents` on mount, manages all local UI state.

```typescript
interface LibraryViewProps {
  /** Called when the user opens a document (card click or new doc or import) */
  onOpenDocument: (doc: Document) => void;
  /** Called to switch the active tab (e.g. after opening a document) */
  onTabChange: (tab: 'editor' | 'library') => void;
  /** The id of the document currently loaded in the editor (for delete-active-doc logic) */
  currentDocumentId: string | null;
}

// Local state shape (useState inside LibraryView)
interface LibraryViewState {
  intents: AuraIntentSummary[];
  isLoading: boolean;
  loadError: string | null;
  searchQuery: string;
  activeFilter: 'all' | 'documents' | 'ai-ready';
  cardLoadingId: string | null;   // id of card currently being opened
  cardErrorId: string | null;     // id of card that failed to open
  isImporting: boolean;
  importError: string | null;
  importWarnings: string[];
  deleteTargetId: string | null;  // id of card pending delete confirmation
  isDeleting: boolean;
  deleteError: string | null;
  conflictState: ConflictState | null;
}

interface ConflictState {
  intentName: string;
  auraIntentId: string;
  resolve: (choice: 'update' | 'create_new' | 'cancel') => void;
}
```

### `LibraryCard`

Displays one `AuraIntentSummary`. Handles open and delete actions.

```typescript
interface LibraryCardProps {
  summary: AuraIntentSummary;
  isLoading: boolean;   // true while get_intent is in progress for this card
  hasError: boolean;    // true if get_intent failed for this card
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}
```

The card renders:
- Document type icon (`description` material symbol)
- `intent_name` (truncated to one line)
- Relative timestamp derived from `updated_at` (e.g. "Updated 2h ago")
- Version badge (`v{version}`)
- Delete button (visible on hover/focus)
- Loading spinner overlay when `isLoading` is true
- Inline error message when `hasError` is true

### `LibrarySearchBar`

Controlled text input with a clear button. Debouncing is handled by the parent (`LibraryView`) via a `useEffect` with a 300ms timeout — no new hook needed.

```typescript
interface LibrarySearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Passed as autoFocus when LibraryView mounts (Req 10.4) */
  autoFocus?: boolean;
}
```

### `LibraryFilterChips`

Row of filter chip buttons.

```typescript
type LibraryFilter = 'all' | 'documents' | 'ai-ready';

interface LibraryFilterChipsProps {
  activeFilter: LibraryFilter;
  onChange: (filter: LibraryFilter) => void;
}
```

Chips: "All" → `'all'`, "Documents" → `'documents'`, "AI-ready" → `'ai-ready'`.

### `LibraryEmptyState`

Shown when the filtered list is empty.

```typescript
interface LibraryEmptyStateProps {
  /** 'no-documents' when list_intents returns [], 'no-results' when search/filter yields nothing */
  reason: 'no-documents' | 'no-results';
  searchQuery?: string;
  onCreateNew: () => void;
}
```

### `ConfirmationDialog`

A minimal two-button modal for destructive confirmations. Separate from `ReplaceConfirmationDialog` (which has three choices and import-specific copy).

```typescript
interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  isDangerous?: boolean;  // renders confirm button in error color
  onConfirm: () => void;
  onCancel: () => void;
}
```

---

## Data Models

No new persistent data models are introduced. The feature consumes existing types:

- `AuraIntentSummary` — used for the document grid (from `list_intents`)
- `AuraIntentDocument` — used when opening a document (from `get_intent`)
- `Document` — the editor's internal format (converted via `auraIntentToDocument`)

### Filter Classification Logic

The "AI-ready" filter maps to documents whose `content` array (when fetched via `get_intent`) contains at least one structured block beyond plain paragraphs. However, since `list_intents` only returns `AuraIntentSummary` (no content), the filter is applied client-side using a heuristic based on `version`:

- `'documents'` — all intents (same as "All" in v1; reserved for future sub-type tagging)
- `'ai-ready'` — intents with `version >= 2` (documents that have been synced at least once after initial creation, indicating they have been processed by AuraBrain)

This heuristic is intentionally simple and can be replaced with a proper content-type field in a future AuraBrain schema update.

### Relative Timestamp Utility

A pure function `formatRelativeTime(updatedAt: number): string` converts a Unix timestamp (milliseconds) to a human-readable relative string:

```typescript
function formatRelativeTime(updatedAt: number): string {
  const diffMs = Date.now() - updatedAt;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}
```

---

## State Management

### Changes to `AppState` (`stateManager.tsx`)

Add one field and two actions:

```typescript
// AppState addition
activeTab: 'editor' | 'library';

// initialState addition
activeTab: 'editor',

// New action types
| { type: 'SET_ACTIVE_TAB'; payload: 'editor' | 'library' }

// Reducer case
case 'SET_ACTIVE_TAB':
  return { ...state, activeTab: action.payload };
```

Add to `AppContextValue`:

```typescript
setActiveTab: (tab: 'editor' | 'library') => void;
```

Add to provider:

```typescript
const setActiveTab = useCallback((tab: 'editor' | 'library') => {
  dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
}, []);
```

### `App.tsx` Changes

1. Destructure `activeTab` and `setActiveTab` from `useAppState()`.
2. Pass `activeTab` and `onTabChange={setActiveTab}` to `TopNavBar`.
3. Replace the unconditional editor stack render with a conditional:

```tsx
{activeTab === 'library' ? (
  <LibraryView
    onOpenDocument={handleOpenDocumentFromLibrary}
    onTabChange={setActiveTab}
    currentDocumentId={document?.id ?? null}
  />
) : (
  <div style={{ /* existing editor layout styles */ }}>
    <EditorCanvas ... />
    {/* panels, status bar */}
  </div>
)}
```

4. Add `handleOpenDocumentFromLibrary`:

```typescript
const handleOpenDocumentFromLibrary = useCallback((doc: Document) => {
  const normalized = { ...doc, content: ensureBlockValue(doc.content) };
  setDocument(normalized, '', true);
  void auraBrainManager.initializeSyncedBaseline(normalized);
  localStorage.setItem(LAST_INTENT_KEY, normalized.id);
  setActiveTab('editor');
}, [setDocument, setActiveTab]);
```

The left sidebar `<aside>` remains outside the conditional so it is always visible regardless of active tab (Req 1.5).

---

## Import Flow

`LibraryView` calls `importFile` from `exportService.ts` with two callbacks:

```typescript
async function handleOpenFile() {
  setIsImporting(true);
  setImportError(null);

  const result = await importFile({
    onConflict: (intentName, auraIntentId) =>
      new Promise((resolve) => {
        setConflictState({ intentName, auraIntentId, resolve });
      }),
    onOpenIntent: (doc) => {
      onOpenDocument(doc);
      onTabChange('editor');
    },
  });

  setIsImporting(false);

  if (result.status === 'error') {
    setImportError(result.message);
  } else if (result.status === 'opened' && result.warnings.length > 0) {
    setImportWarnings(result.warnings);
  }
}
```

The `onConflict` callback suspends the import flow by storing a `resolve` function in state. `ReplaceConfirmationDialog` is rendered when `conflictState !== null`. When the user makes a choice, `conflictState.resolve(choice)` is called, which resumes the `importFile` promise chain.

After a successful import, `importFile` internally calls `syncDocument` (via `auraBrainManager`), so `LibraryView` does not need to call `sync_intent` directly. The document grid is refreshed by re-fetching `list_intents` after `onOpenIntent` is called.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `list_intents` fails on mount | Full-view error state with retry button; no cards rendered |
| `list_intents` returns `[]` | `LibraryEmptyState` with "no-documents" reason |
| `get_intent` fails for a card | Inline error on that card; no navigation; other cards unaffected |
| `delete_intent` fails | Toast/inline error; card remains in grid |
| `importFile` returns `{ status: 'error' }` | Inline error banner in LibraryView; no navigation |
| `importFile` returns `{ status: 'cancelled' }` | No-op; no error shown |
| Import with warnings | Non-blocking warning notification shown before navigating to editor |
| Delete of currently active document | After successful delete, call `handleNew()` to reset editor to blank document |

All error messages use `error instanceof Error ? error.message : String(error)` for consistency with the rest of the codebase.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

The project already uses `fast-check` (v4.6.0, listed in `devDependencies`) with Vitest. All property tests use `fc.assert(fc.property(...))` with a minimum of 100 runs.

**Property Reflection:** After reviewing all testable criteria, the following consolidations were made:
- Requirements 4.2, 4.3, and 4.4 (open document → switch tab, switch nav indicator, store in localStorage) are all consequences of the same "open document" action and are combined into Property 2.
- Requirements 7.2 and 7.3 (search filters correctly, empty query shows all) are both instances of the same filter predicate and are combined into Property 3.
- Requirements 8.2, 8.3, and 8.6 (filter chip filters correctly, All shows all, search+filter compose) are combined into Property 4 (the composition property subsumes the individual filter properties).
- Requirements 6.2, 6.3, and 6.4 (import success → card appears, tab switches, nav switches) are combined into Property 5.
- Requirements 9.3, 9.4, and 9.5 (delete with correct id, card removed, cancel does not delete) are split into two focused properties (Properties 6 and 7).

### Property 1: Document list renders cards sorted by recency

*For any* non-empty array of `AuraIntentSummary` records with distinct `updated_at` values, when `LibraryView` renders the document grid, the number of rendered cards equals the array length and the cards appear in descending `updated_at` order (most recently updated first).

**Validates: Requirements 2.2**

### Property 2: Opening a document from the library always switches to the editor tab

*For any* valid `AuraIntentDocument` returned by `get_intent`, after the open action completes: the `activeTab` is `'editor'`, and `localStorage` contains the document's `id` under `wordai_last_intent_id`.

**Validates: Requirements 4.2, 4.3, 4.4**

### Property 3: Search filter is a correct case-insensitive substring match

*For any* array of `AuraIntentSummary` records and any search query string (including empty string), the set of displayed cards is exactly the subset whose `intent_name` contains the query as a case-insensitive substring. When the query is empty, all cards are displayed.

**Validates: Requirements 7.2, 7.3**

### Property 4: Search and filter chip composition is idempotent and correct

*For any* array of `AuraIntentSummary` records, any search query, and any active filter chip value, the set of displayed cards satisfies both the search predicate AND the filter predicate simultaneously. Applying the same search query and filter a second time produces the same result (idempotence).

**Validates: Requirements 8.2, 8.3, 8.6**

### Property 5: Successful import always opens the document in the editor

*For any* `AuraIntentDocument` that results from a successful import (no conflict, or conflict resolved as update/create_new), after the import flow completes: the document appears in the refreshed document grid AND `activeTab` is `'editor'`.

**Validates: Requirements 6.2, 6.3, 6.4**

### Property 6: Delete confirmation calls delete_intent with the correct id and removes the card

*For any* document `id` in the library grid, when the user confirms deletion: `delete_intent` is called exactly once with that `id`, and after the IPC call succeeds, the card with that `id` is no longer present in the rendered grid.

**Validates: Requirements 9.3, 9.4**

### Property 7: Cancelling any destructive action never persists changes

*For any* document `id` and any destructive action (delete or import with conflict), when the user cancels the confirmation dialog: the relevant IPC command (`delete_intent` or `sync_intent`) is never called, and the document grid state is unchanged from before the action was initiated.

**Validates: Requirements 6.9, 9.5**

### Property 8: Library_Card always renders all required metadata fields

*For any* `AuraIntentSummary`, the rendered `LibraryCard` contains the `intent_name`, a non-empty relative timestamp string derived from `updated_at`, and the `version` number.

**Validates: Requirements 2.6**

---

## Testing Strategy

### Unit Tests (example-based)

Focus on specific behaviors and edge cases:

- `TopNavBar` renders active style on the correct tab button for each `activeTab` value
- `LibraryView` shows loading indicator while `list_intents` is pending
- `LibraryView` shows error state and retry button when `list_intents` rejects
- `LibraryView` shows `LibraryEmptyState` when `list_intents` returns `[]`
- `LibraryCard` shows inline error when `get_intent` fails
- `LibraryCard` shows loading spinner while `get_intent` is in progress
- `ConfirmationDialog` renders confirm and cancel buttons with correct labels
- `LibraryEmptyState` renders correct message for `'no-documents'` vs `'no-results'`
- `LibrarySearchBar` shows clear button only when value is non-empty
- `LibraryView` auto-focuses the search bar on mount (Req 10.4)
- `LibraryView` resets editor to blank document when the currently active document is deleted (Req 9.7)
- Import with warnings shows non-blocking notification (Req 6.5)
- `ReplaceConfirmationDialog` is shown when `onConflict` is triggered during import (Req 6.6)

### Property Tests (fast-check)

Each property test uses `fc.assert(fc.property(...), { numRuns: 100 })`.

**Tag format:** `// Feature: library-tab, Property {N}: {property_text}`

```typescript
// Feature: library-tab, Property 1: Document list renders cards sorted by recency
fc.assert(fc.property(
  fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }),
  (summaries) => {
    // render LibraryView with mocked list_intents returning summaries
    // assert card count === summaries.length
    // assert cards are in descending updated_at order
  }
), { numRuns: 100 });

// Feature: library-tab, Property 2: Opening a document always switches to editor tab
fc.assert(fc.property(
  arbitraryAuraIntentDocument(),
  async (doc) => {
    // mock get_intent to return doc
    // click the corresponding card
    // assert activeTab === 'editor'
    // assert localStorage.getItem('wordai_last_intent_id') === doc.id
  }
), { numRuns: 100 });

// Feature: library-tab, Property 3: Search filter is correct case-insensitive substring match
fc.assert(fc.property(
  fc.array(arbitraryAuraIntentSummary(), { minLength: 0, maxLength: 20 }),
  fc.string(),
  (summaries, query) => {
    const filtered = applySearchFilter(summaries, query);
    const expected = summaries.filter(s =>
      s.intent_name.toLowerCase().includes(query.toLowerCase())
    );
    return filtered.length === expected.length &&
      filtered.every(s => expected.some(e => e.id === s.id));
  }
), { numRuns: 100 });

// Feature: library-tab, Property 4: Search and filter chip composition is idempotent and correct
fc.assert(fc.property(
  fc.array(arbitraryAuraIntentSummary(), { minLength: 0, maxLength: 20 }),
  fc.string(),
  fc.constantFrom('all', 'documents', 'ai-ready'),
  (summaries, query, filter) => {
    const result1 = applyFilters(summaries, query, filter);
    const result2 = applyFilters(summaries, query, filter);
    // idempotence: same inputs produce same outputs
    return JSON.stringify(result1) === JSON.stringify(result2) &&
      // correctness: all results satisfy both predicates
      result1.every(s =>
        s.intent_name.toLowerCase().includes(query.toLowerCase()) &&
        matchesFilter(s, filter)
      );
  }
), { numRuns: 100 });

// Feature: library-tab, Property 6: Delete confirmation calls delete_intent with correct id
fc.assert(fc.property(
  fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }),
  fc.nat(),
  async (summaries, indexSeed) => {
    const target = summaries[indexSeed % summaries.length];
    // render LibraryView, click delete on target card, confirm
    // assert delete_intent called with target.id
    // assert target card not in rendered output
  }
), { numRuns: 100 });

// Feature: library-tab, Property 7: Cancelling destructive actions never persists changes
fc.assert(fc.property(
  fc.array(arbitraryAuraIntentSummary(), { minLength: 1 }),
  fc.nat(),
  async (summaries, indexSeed) => {
    const target = summaries[indexSeed % summaries.length];
    // render LibraryView, click delete on target card, cancel
    // assert delete_intent was never called
    // assert grid still contains target card
  }
), { numRuns: 100 });

// Feature: library-tab, Property 8: LibraryCard renders all required metadata fields
fc.assert(fc.property(
  arbitraryAuraIntentSummary(),
  (summary) => {
    // render LibraryCard with summary
    // assert intent_name is present in output
    // assert a non-empty timestamp string is present
    // assert version number is present
  }
), { numRuns: 100 });
```

### Arbitraries

```typescript
function arbitraryAuraIntentSummary(): fc.Arbitrary<AuraIntentSummary> {
  return fc.record({
    id: fc.uuid(),
    intent_name: fc.string({ minLength: 1, maxLength: 100 }),
    created_at: fc.integer({ min: 0, max: Date.now() }),
    updated_at: fc.integer({ min: 0, max: Date.now() }),
    version: fc.integer({ min: 1, max: 100 }),
  });
}

function arbitraryAuraIntentDocument(): fc.Arbitrary<AuraIntentDocument> {
  return fc.record({
    id: fc.uuid(),
    intent_name: fc.string({ minLength: 1, maxLength: 100 }),
    content: fc.array(fc.record({
      type: fc.constant('paragraph'),
      text: fc.string(),
      inline: fc.constant([]),
    })),
    version: fc.option(fc.integer({ min: 1, max: 100 })),
    created_at: fc.option(fc.integer({ min: 0, max: Date.now() })),
    updated_at: fc.option(fc.integer({ min: 0, max: Date.now() })),
  });
}
```

---

## i18n — New Translation Keys

All new keys follow the existing structure in `vi.json` / `en.json`.

```json
{
  "library": {
    "title": "Thư viện",
    "subtitle": "Tác phẩm hoàn chỉnh, mẫu và kiến thức tái sử dụng của bạn.",
    "newDocument": "Tài liệu mới",
    "openFile": "Mở file",
    "openFileAriaLabel": "Mở file từ hệ thống",
    "searchPlaceholder": "Tìm kiếm thư viện...",
    "searchClearAriaLabel": "Xóa tìm kiếm",
    "filters": {
      "all": "Tất cả",
      "documents": "Tài liệu",
      "aiReady": "AI-ready"
    },
    "card": {
      "updatedAt": "Cập nhật {{time}}",
      "version": "v{{version}}",
      "openAriaLabel": "Mở {{name}}",
      "deleteAriaLabel": "Xóa {{name}}",
      "loadingAriaLabel": "Đang tải {{name}}...",
      "errorMessage": "Không thể mở tài liệu"
    },
    "loading": "Đang tải thư viện...",
    "loadError": "Không thể tải thư viện: {{message}}",
    "retry": "Thử lại",
    "emptyState": {
      "noDocuments": {
        "title": "Thư viện trống",
        "message": "Tạo tài liệu mới hoặc nhập file để bắt đầu.",
        "createButton": "Tạo tài liệu"
      },
      "noResults": {
        "title": "Không tìm thấy kết quả",
        "message": "Không có tài liệu nào khớp với \"{{query}}\".",
        "clearButton": "Xóa tìm kiếm"
      }
    },
    "delete": {
      "confirmTitle": "Xóa tài liệu",
      "confirmMessage": "Bạn có chắc muốn xóa \"{{name}}\" không? Hành động này không thể hoàn tác.",
      "confirmButton": "Xóa",
      "cancelButton": "Hủy",
      "errorMessage": "Không thể xóa tài liệu: {{message}}"
    },
    "import": {
      "importing": "Đang nhập...",
      "errorMessage": "Nhập thất bại: {{message}}",
      "warningsTitle": "Cảnh báo nhập",
      "warningsMessage": "File đã được nhập với {{count}} cảnh báo."
    }
  },
  "confirmationDialog": {
    "ariaLabel": "Hộp thoại xác nhận"
  }
}
```

**Complete list of new i18n keys:**

| Key | Purpose |
|---|---|
| `library.title` | Page heading |
| `library.subtitle` | Page subheading |
| `library.newDocument` | "New Document" button label |
| `library.openFile` | "Open File" button label |
| `library.openFileAriaLabel` | ARIA label for Open File button |
| `library.searchPlaceholder` | Search bar placeholder |
| `library.searchClearAriaLabel` | ARIA label for clear button |
| `library.filters.all` | "All" chip label |
| `library.filters.documents` | "Documents" chip label |
| `library.filters.aiReady` | "AI-ready" chip label |
| `library.card.updatedAt` | Relative timestamp (interpolated) |
| `library.card.version` | Version badge (interpolated) |
| `library.card.openAriaLabel` | ARIA label for card open action |
| `library.card.deleteAriaLabel` | ARIA label for card delete button |
| `library.card.loadingAriaLabel` | ARIA label for card loading state |
| `library.card.errorMessage` | Inline card error text |
| `library.loading` | Loading indicator label |
| `library.loadError` | Error state message (interpolated) |
| `library.retry` | Retry button label |
| `library.emptyState.noDocuments.title` | Empty library heading |
| `library.emptyState.noDocuments.message` | Empty library body |
| `library.emptyState.noDocuments.createButton` | CTA button in empty state |
| `library.emptyState.noResults.title` | No search results heading |
| `library.emptyState.noResults.message` | No search results body (interpolated) |
| `library.emptyState.noResults.clearButton` | Clear search CTA |
| `library.delete.confirmTitle` | Delete confirmation dialog title |
| `library.delete.confirmMessage` | Delete confirmation dialog body (interpolated) |
| `library.delete.confirmButton` | Delete confirm button label |
| `library.delete.cancelButton` | Delete cancel button label |
| `library.delete.errorMessage` | Delete error message (interpolated) |
| `library.import.importing` | Import in-progress label |
| `library.import.errorMessage` | Import error message (interpolated) |
| `library.import.warningsTitle` | Import warnings notification title |
| `library.import.warningsMessage` | Import warnings body (interpolated) |
| `confirmationDialog.ariaLabel` | ARIA label for `ConfirmationDialog` |
