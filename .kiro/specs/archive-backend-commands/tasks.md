# Implementation Plan

## Overview

This plan implements the missing archive backend commands for the WordAI editor. The bug is that 10 Tauri IPC commands invoked by the frontend `ArchiveView.tsx` have no corresponding Rust backend implementation, causing "command not found" errors. The fix adds model structs, SQLite schema tables, CRUD methods, AI service methods, command functions, and registers them in the invoke_handler.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Archive Commands Not Found
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases — invoking each of the 10 archive commands on the current backend
  - Write a Rust integration test that attempts to call each archive command handler function directly:
    - `list_archived_intents` with optional category filter → should return `Vec<ArchivedIntentSummary>` without error
    - `get_archived_intent` with a valid id → should return `Option<ArchivedIntentDocument>` without error
    - `archive_intent` with id and reason → should return `ArchivedIntentSummary` without error
    - `restore_intent` with a valid archived id → should return `AuraDocument` without error
    - `delete_archived_intent` with a valid id → should succeed without error
    - `update_memory_access` with id and enabled boolean → should succeed without error
    - `get_archive_suggestions` with active_doc_id → should return `Vec<ArchiveSuggestion>` without error
    - `generate_archive_summary` with id → should return a String without error
    - `list_paused_projects` → should return `Vec<PausedProject>` without error
    - `get_project_documents` with project_id → should return `Vec<ArchivedIntentSummary>` without error
  - Test that the `archived_intents` and `paused_projects` tables exist in the schema (from Bug Condition in design: `isBugCondition(input)` where `input.commandName IN [10 archive commands]`)
  - Test that SqliteStore has archive CRUD methods available
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (compilation errors — functions/structs don't exist yet, confirming the bug)
  - Document counterexamples: "Commands not found because no `#[tauri::command]` functions exist, no schema tables, no model structs"
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Intent CRUD Unchanged After Schema Migration
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `SqliteStore::new_with_path` creates DB with `intents` and `intent_chunks` tables
  - Observe on UNFIXED code: `upsert_intent` with random AuraDocuments returns incrementing version numbers
  - Observe on UNFIXED code: `get_intent` retrieves the exact document that was upserted (round-trip)
  - Observe on UNFIXED code: `list_intents` returns IntentSummary records ordered by `updated_at DESC`
  - Write property-based tests using `proptest`:
    - For all random AuraDocuments, `upsert_intent` followed by `get_intent` returns the same document data (round-trip preservation)
    - For all random AuraDocuments upserted, `list_intents` includes a matching IntentSummary
    - Schema tables `intents` and `intent_chunks` exist with unchanged column definitions after initialization
  - Verify tests pass on UNFIXED code (existing behavior is captured correctly)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [ ] 3. Fix for missing archive backend commands

  - [x] 3.1 Add archive model structs to `models.rs`
    - Add `ArchivedIntentSummary` struct with fields: `id`, `intent_name`, `archived_at`, `archive_reason`, `archive_type`, `related_current_id`, `memory_access_enabled`, `created_at`, `updated_at`, `version`, `project_id`
    - Add `ArchivedIntentDocument` struct extending summary with `content: Vec<DocumentBlock>`
    - Add `ArchiveSuggestion` struct with fields: `id`, `archive_item_id`, `category`, `title`, `description`, `archived_at`, `relevance_score`
    - Add `PausedProject` struct with fields: `id`, `name`, `description`, `document_count`, `paused_at`, `created_at`
    - All structs derive `Debug, Clone, Serialize, Deserialize`
    - _Bug_Condition: isBugCondition(input) where input.commandName IN [10 archive commands] — missing model structs prevent compilation_
    - _Expected_Behavior: Each command returns the correct typed result (ArchivedIntentSummary, ArchivedIntentDocument, etc.)_
    - _Preservation: Existing model structs (AuraDocument, IntentSummary, IPCError, etc.) remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [x] 3.2 Extend SQLite schema in `sqlite_store.rs`
    - Add `CREATE TABLE IF NOT EXISTS archived_intents` with columns: `id TEXT PRIMARY KEY`, `intent_name TEXT NOT NULL`, `raw_content TEXT NOT NULL`, `archived_at INTEGER NOT NULL`, `archive_reason TEXT NOT NULL DEFAULT ''`, `archive_type TEXT NOT NULL DEFAULT 'manual'`, `related_current_id TEXT`, `memory_access_enabled INTEGER NOT NULL DEFAULT 1`, `created_at INTEGER NOT NULL`, `updated_at INTEGER NOT NULL`, `version INTEGER NOT NULL DEFAULT 1`, `project_id TEXT`
    - Add `CREATE TABLE IF NOT EXISTS paused_projects` with columns: `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `description TEXT NOT NULL DEFAULT ''`, `paused_at INTEGER NOT NULL`, `created_at INTEGER NOT NULL`
    - Add indexes: `idx_archived_intents_project_id`, `idx_archived_intents_archive_type`
    - Schema migration is additive only — no ALTER on existing `intents` or `intent_chunks` tables
    - _Bug_Condition: isBugCondition(input) — no tables exist for archive data persistence_
    - _Expected_Behavior: Tables exist and support CRUD operations for all 10 commands_
    - _Preservation: Existing `intents` and `intent_chunks` tables remain unmodified in schema and data_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 3.1, 3.2, 3.3_

  - [x] 3.3 Implement archive CRUD methods on `SqliteStore`
    - `list_archived_intents(category: Option<&str>) -> Result<Vec<ArchivedIntentSummary>, IPCError>` — query with optional category filter
    - `get_archived_intent(id: &str) -> Result<Option<ArchivedIntentDocument>, IPCError>` — full document retrieval with raw_content deserialization
    - `archive_intent(id: &str, reason: &str) -> Result<ArchivedIntentSummary, IPCError>` — transactional move from `intents` to `archived_intents`
    - `restore_intent(id: &str) -> Result<AuraDocument, IPCError>` — transactional move from `archived_intents` back to `intents`
    - `delete_archived_intent(id: &str) -> Result<(), IPCError>` — permanent removal
    - `update_memory_access(id: &str, enabled: bool) -> Result<(), IPCError>` — toggle field
    - `list_paused_projects() -> Result<Vec<PausedProject>, IPCError>` — with document count subquery
    - `get_project_documents(project_id: &str) -> Result<Vec<ArchivedIntentSummary>, IPCError>` — filter by project_id
    - Ensure `archive_intent` and `restore_intent` use transactions: if insert fails, original record must not be deleted
    - _Bug_Condition: isBugCondition(input) — no methods exist to handle archive operations_
    - _Expected_Behavior: Each method performs correct DB operation and returns typed result_
    - _Preservation: Existing methods (upsert_intent, get_intent, list_intents) remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.9, 2.10, 3.1, 3.2, 3.3_

  - [x] 3.4 Add AI service methods to `ai_service.rs`
    - `get_archive_suggestions(doc_context: &str) -> Result<Vec<ArchiveSuggestion>, IPCError>` — calls LLM with document context, parses response into suggestions
    - `generate_archive_summary(content: &str) -> Result<String, IPCError>` — calls LLM with archived content, returns summary text
    - Follow existing `AIServiceConnector` pattern (accept `api_key` and optional `endpoint`)
    - _Bug_Condition: isBugCondition(input) where commandName IN ['get_archive_suggestions', 'generate_archive_summary']_
    - _Expected_Behavior: AI methods return parsed suggestions/summary from LLM response_
    - _Preservation: Existing AI methods (request_suggestion, send_chat_message, check_health) remain unchanged_
    - _Requirements: 2.7, 2.8, 3.5_

  - [~] 3.5 Add 10 `#[tauri::command]` functions in `lib.rs`
    - `list_archived_intents(category: Option<String>, state: tauri::State<'_, SqliteStore>) -> Result<Vec<ArchivedIntentSummary>, IPCError>`
    - `get_archived_intent(id: String, state: tauri::State<'_, SqliteStore>) -> Result<Option<ArchivedIntentDocument>, IPCError>`
    - `archive_intent(id: String, reason: String, state: tauri::State<'_, SqliteStore>) -> Result<ArchivedIntentSummary, IPCError>`
    - `restore_intent(id: String, state: tauri::State<'_, SqliteStore>) -> Result<AuraDocument, IPCError>`
    - `delete_archived_intent(id: String, state: tauri::State<'_, SqliteStore>) -> Result<(), IPCError>`
    - `update_memory_access(id: String, enabled: bool, state: tauri::State<'_, SqliteStore>) -> Result<(), IPCError>`
    - `get_archive_suggestions(active_doc_id: String, api_key: String, endpoint: Option<String>, state: tauri::State<'_, SqliteStore>) -> Result<Vec<ArchiveSuggestion>, IPCError>`
    - `generate_archive_summary(id: String, api_key: String, endpoint: Option<String>, state: tauri::State<'_, SqliteStore>) -> Result<String, IPCError>`
    - `list_paused_projects(state: tauri::State<'_, SqliteStore>) -> Result<Vec<PausedProject>, IPCError>`
    - `get_project_documents(project_id: String, state: tauri::State<'_, SqliteStore>) -> Result<Vec<ArchivedIntentSummary>, IPCError>`
    - _Bug_Condition: isBugCondition(input) — no command handler functions registered_
    - _Expected_Behavior: Each command delegates to SqliteStore or AIServiceConnector and returns correct result_
    - _Preservation: Existing command functions remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 3.6 Register all 10 commands in the `invoke_handler` macro
    - Add all 10 new command function names to the `tauri::generate_handler![]` array in the `run()` function
    - Place after existing commands for clarity
    - _Bug_Condition: isBugCondition(input) — commands not in invoke_handler means Tauri returns "command not found"_
    - _Expected_Behavior: All 10 commands are discoverable by Tauri IPC layer_
    - _Preservation: All existing commands remain registered in the same handler_
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 3.7 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Archive Commands Return Valid Results
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — all 10 commands compile and execute correctly)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10_

  - [~] 3.8 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Intent CRUD Unchanged After Schema Migration
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all existing intent CRUD operations still work identically after schema migration
    - Confirm `intents` and `intent_chunks` tables are unmodified

- [~] 4. Checkpoint - Ensure all tests pass
  - Run full `cargo test` in `src-tauri` to verify all existing and new tests pass
  - Verify no compilation warnings related to archive modules
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.4"] },
    { "id": 3, "tasks": ["3.3"] },
    { "id": 4, "tasks": ["3.5"] },
    { "id": 5, "tasks": ["3.6"] },
    { "id": 6, "tasks": ["3.7", "3.8"] },
    { "id": 7, "tasks": ["4"] }
  ]
}
```

## Notes

- The fix is purely additive: new structs, new tables, new methods, new commands. No existing code is modified except appending to the `invoke_handler` macro.
- Schema uses `CREATE TABLE IF NOT EXISTS` for idempotent migration — safe to run on existing databases.
- `archive_intent` and `restore_intent` must be transactional to prevent data loss if the operation fails midway.
- AI commands (`get_archive_suggestions`, `generate_archive_summary`) follow the existing `AIServiceConnector` pattern with `api_key` and optional `endpoint` parameters.
- Property-based tests use `proptest` crate which is already a dev-dependency in the project.
