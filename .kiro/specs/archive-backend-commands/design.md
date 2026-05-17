# Archive Backend Commands Bugfix Design

## Overview

The frontend `ArchiveView.tsx` invokes 10 Tauri IPC commands (`list_archived_intents`, `get_archived_intent`, `archive_intent`, `restore_intent`, `delete_archived_intent`, `update_memory_access`, `get_archive_suggestions`, `generate_archive_summary`, `list_paused_projects`, `get_project_documents`) that have no corresponding implementation in the Rust backend. The `invoke_handler` in `lib.rs` does not register any archive-related commands, and no archive persistence module exists. This causes runtime errors whenever the user navigates to the Archive tab.

The fix involves:
1. Extending the SQLite schema with `archived_intents` and `paused_projects` tables
2. Implementing archive CRUD methods on `SqliteStore`
3. Adding 10 new `#[tauri::command]` functions in `lib.rs`
4. Registering all commands in the `invoke_handler` macro
5. Adding new model structs for archive data types

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — any frontend `invoke()` call to one of the 10 missing archive IPC commands
- **Property (P)**: The desired behavior — each command executes its intended database or AI operation and returns the correct result type
- **Preservation**: Existing IPC commands (`sync_intent`, `get_intent`, `list_intents`, `save_document`, `load_document`, AI commands, export/import commands) must continue to work identically
- **SqliteStore**: The managed Tauri state struct in `sqlite_store.rs` that wraps an `Arc<Mutex<Connection>>` for the AuraBrain SQLite database
- **AIServiceConnector**: The struct in `ai_service.rs` that interfaces with external LLM APIs for AI-powered features
- **IPCError**: The standard error type `{ code: String, message: String }` returned by all Tauri commands on failure
- **ArchivedIntentSummary**: Lightweight archived item metadata (no raw_content) for list views
- **ArchivedIntentDocument**: Full archived document including raw_content for detail views

## Bug Details

### Bug Condition

The bug manifests when the frontend calls any of the 10 archive-related Tauri IPC commands. The Rust backend has no registered handlers for these command names, so Tauri's IPC layer returns a "command not found" error immediately.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type TauriIPCInvocation
  OUTPUT: boolean
  
  RETURN input.commandName IN [
    'list_archived_intents',
    'get_archived_intent',
    'archive_intent',
    'restore_intent',
    'delete_archived_intent',
    'update_memory_access',
    'get_archive_suggestions',
    'generate_archive_summary',
    'list_paused_projects',
    'get_project_documents'
  ]
END FUNCTION
```

### Examples

- User navigates to Archive tab → frontend calls `invoke('list_archived_intents')` → error "Command list_archived_intents not found" → Archive tab shows error state
- User clicks an archived item → frontend calls `invoke('get_archived_intent', { id: 'abc-123' })` → error "Command get_archived_intent not found" → Detail drawer shows error
- User clicks "Archive" on an active document → frontend calls `invoke('archive_intent', { id: 'doc-1', reason: 'Completed' })` → error "Command archive_intent not found" → action fails silently
- User toggles memory access → frontend calls `invoke('update_memory_access', { id: 'arc-1', enabled: false })` → error "Command update_memory_access not found" → toggle reverts

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `sync_intent` must continue to upsert AuraDocuments into the `intents` table and return the new version number
- `get_intent` must continue to retrieve a single AuraDocument by id from the `intents` table
- `list_intents` must continue to return lightweight IntentSummary records without raw_content
- `save_document`, `load_document`, `create_document` must continue to perform file-based document operations
- `request_ai_suggestion`, `send_chat_message`, `check_ai_health` must continue to communicate with the AI service
- `export_markdown`, `export_docx`, `import_file`, `cancel_export`, `cancel_import` must continue to handle file format conversions
- The existing `intents` and `intent_chunks` tables must remain unmodified in schema and data

**Scope:**
All IPC invocations that do NOT target the 10 new archive commands should be completely unaffected by this fix. This includes:
- All existing document CRUD commands
- All AI service commands
- All export/import commands
- All preference and notification commands
- The SQLite schema migration must be additive only (new tables, no ALTER on existing tables)

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Missing Command Implementations**: The 10 archive IPC commands have no corresponding `#[tauri::command]` functions in the Rust backend. The frontend was built against a design spec that defined these commands, but the backend implementation was never created.

2. **Missing Schema Tables**: The `archived_intents` and `paused_projects` tables do not exist in the SQLite schema (`SCHEMA_SQL` constant in `sqlite_store.rs`). Even if commands existed, they would have no tables to query.

3. **Missing Model Structs**: The `models.rs` file does not define `ArchivedIntentSummary`, `ArchivedIntentDocument`, `ArchiveSuggestion`, or `PausedProject` structs needed for serialization/deserialization.

4. **Missing invoke_handler Registration**: Even after implementing the commands, they must be added to the `tauri::generate_handler![]` macro in the `run()` function.

## Correctness Properties

Property 1: Bug Condition - Archive Commands Return Valid Results

_For any_ IPC invocation where the command name is one of the 10 archive commands and the parameters are valid (correct types, existing IDs for read operations), the fixed backend SHALL execute the corresponding database or AI operation and return a result matching the expected return type without error.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10**

Property 2: Preservation - Existing Commands Unchanged

_For any_ IPC invocation where the command name is NOT one of the 10 new archive commands (i.e., any existing command like `sync_intent`, `get_intent`, `list_intents`, `save_document`, etc.), the fixed backend SHALL produce exactly the same behavior as the original unfixed backend, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `src-tauri/src/models.rs`

**Specific Changes**:
1. **Add ArchivedIntentSummary struct**: Lightweight summary with fields: `id`, `intent_name`, `archived_at`, `archive_reason`, `archive_type`, `related_current_id`, `memory_access_enabled`, `created_at`, `updated_at`, `version`, `project_id`
2. **Add ArchivedIntentDocument struct**: Extends summary with `content: Vec<DocumentBlock>` (raw_content deserialized)
3. **Add ArchiveSuggestion struct**: Fields: `id`, `archive_item_id`, `category`, `title`, `description`, `archived_at`, `relevance_score`
4. **Add PausedProject struct**: Fields: `id`, `name`, `description`, `document_count`, `paused_at`, `created_at`

**File**: `src-tauri/src/sqlite_store.rs`

**Specific Changes**:
1. **Extend SCHEMA_SQL**: Add `CREATE TABLE IF NOT EXISTS archived_intents (...)` and `CREATE TABLE IF NOT EXISTS paused_projects (...)` with indexes
2. **Add `list_archived_intents` method**: Query `archived_intents` table with optional category filter, return `Vec<ArchivedIntentSummary>`
3. **Add `get_archived_intent` method**: Query single row by id, deserialize raw_content, return `Option<ArchivedIntentDocument>`
4. **Add `archive_intent` method**: In a transaction — read from `intents`, insert into `archived_intents`, delete from `intents`, return `ArchivedIntentSummary`
5. **Add `restore_intent` method**: In a transaction — read from `archived_intents`, insert into `intents`, delete from `archived_intents`, return `AuraDocument`
6. **Add `delete_archived_intent` method**: Delete row from `archived_intents` by id
7. **Add `update_memory_access` method**: Update `memory_access_enabled` field by id
8. **Add `list_paused_projects` method**: Query `paused_projects` table with document count subquery
9. **Add `get_project_documents` method**: Query `archived_intents` filtered by `project_id`

**File**: `src-tauri/src/lib.rs`

**Specific Changes**:
1. **Add 8 CRUD command functions**: `list_archived_intents`, `get_archived_intent`, `archive_intent`, `restore_intent`, `delete_archived_intent`, `update_memory_access`, `list_paused_projects`, `get_project_documents` — all using `tauri::State<'_, SqliteStore>`
2. **Add 2 AI command functions**: `get_archive_suggestions` and `generate_archive_summary` — using the `AIServiceConnector` pattern (accept `api_key` and optional `endpoint` parameters)
3. **Register all 10 commands** in the `tauri::generate_handler![]` macro

**File**: `src-tauri/src/ai_service.rs`

**Specific Changes**:
1. **Add `get_archive_suggestions` method** on `AIServiceConnector`: Takes document context, returns parsed `Vec<ArchiveSuggestion>` from LLM response
2. **Add `generate_archive_summary` method** on `AIServiceConnector`: Takes archived document content, returns summary string from LLM response

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that all 10 commands are truly missing from the backend.

**Test Plan**: Write integration tests that attempt to invoke each of the 10 archive commands through the Tauri command handler. Run these tests on the UNFIXED code to observe "command not found" failures.

**Test Cases**:
1. **List Archived Intents Test**: Invoke `list_archived_intents` with no params (will fail on unfixed code — command not found)
2. **Get Archived Intent Test**: Invoke `get_archived_intent` with `{ id: "test-id" }` (will fail on unfixed code)
3. **Archive Intent Test**: Invoke `archive_intent` with `{ id: "doc-1", reason: "test" }` (will fail on unfixed code)
4. **Restore Intent Test**: Invoke `restore_intent` with `{ id: "arc-1" }` (will fail on unfixed code)
5. **Delete Archived Intent Test**: Invoke `delete_archived_intent` with `{ id: "arc-1" }` (will fail on unfixed code)
6. **Update Memory Access Test**: Invoke `update_memory_access` with `{ id: "arc-1", enabled: false }` (will fail on unfixed code)
7. **Get Archive Suggestions Test**: Invoke `get_archive_suggestions` with `{ active_doc_id: "doc-1" }` (will fail on unfixed code)
8. **Generate Archive Summary Test**: Invoke `generate_archive_summary` with `{ id: "arc-1" }` (will fail on unfixed code)
9. **List Paused Projects Test**: Invoke `list_paused_projects` with no params (will fail on unfixed code)
10. **Get Project Documents Test**: Invoke `get_project_documents` with `{ project_id: "proj-1" }` (will fail on unfixed code)

**Expected Counterexamples**:
- All 10 invocations return error with message containing "not found"
- Confirms root cause: commands are simply not registered in the backend

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := invokeCommand_fixed(input.commandName, input.params)
  ASSERT result IS NOT Error("command not found")
  ASSERT result MATCHES expectedReturnType(input.commandName)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT invokeCommand_original(input) = invokeCommand_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random document states and verifies existing CRUD operations still work
- It catches edge cases where schema migration might corrupt existing data
- It provides strong guarantees that `sync_intent`, `get_intent`, `list_intents` behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for existing commands, then write property-based tests capturing that behavior.

**Test Cases**:
1. **sync_intent Preservation**: Verify upsert of random AuraDocuments continues to work correctly after schema migration
2. **get_intent Preservation**: Verify retrieval by id returns identical results after schema migration
3. **list_intents Preservation**: Verify listing returns identical summaries after schema migration
4. **Schema Additivity**: Verify existing tables (`intents`, `intent_chunks`) are unmodified after migration

### Unit Tests

- Test each SqliteStore archive method in isolation with an in-memory or temp-file SQLite database
- Test `archive_intent` transactional behavior: if insert into `archived_intents` fails, the original intent must not be deleted
- Test `restore_intent` transactional behavior: if insert into `intents` fails, the archived intent must not be deleted
- Test `list_archived_intents` with and without category filter
- Test `get_archived_intent` with valid id (returns document) and invalid id (returns None)
- Test `delete_archived_intent` with valid id (succeeds) and invalid id (returns error or no-op)
- Test `update_memory_access` toggles the field correctly
- Test `list_paused_projects` returns correct document counts
- Test `get_project_documents` filters by project_id correctly

### Property-Based Tests

- Generate random AuraDocuments → archive them → verify they appear in `list_archived_intents` and can be retrieved via `get_archived_intent`
- Generate random archived intents → restore them → verify they reappear in `list_intents` with correct data
- Generate random archive/restore cycles → verify no data loss (round-trip property)
- Generate random `memory_access_enabled` toggles → verify the field persists correctly
- Generate random existing intents → verify `sync_intent` and `get_intent` still work after schema migration (preservation)

### Integration Tests

- Test full archive flow: create document → sync to AuraBrain → archive → verify in archive list → restore → verify back in active list
- Test archive with project association: archive intent with project_id → list_paused_projects → get_project_documents
- Test AI commands with mocked AIServiceConnector: verify `get_archive_suggestions` and `generate_archive_summary` call the LLM with correct prompts and parse responses
- Test error handling: invoke commands with invalid IDs, verify appropriate IPCError codes are returned
