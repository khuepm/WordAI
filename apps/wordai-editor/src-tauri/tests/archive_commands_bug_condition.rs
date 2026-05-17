/// Bug Condition Exploration Test — Archive Commands Not Found
///
/// This test verifies that the 10 archive backend commands exist and are callable.
/// On UNFIXED code, this test MUST FAIL (compilation errors prove the bug exists).
/// After the fix is applied, this test should PASS.
///
/// **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
///
/// Bug Condition: `isBugCondition(input)` where `input.commandName IN [10 archive commands]`
/// — missing `#[tauri::command]` functions, no schema tables, no model structs.

use tempfile::tempdir;
use wordai_editor_lib::models::{
    ArchivedIntentDocument, ArchivedIntentSummary, ArchiveSuggestion, PausedProject,
};
use wordai_editor_lib::sqlite_store::SqliteStore;

/// Helper: create a SqliteStore backed by a temp directory.
fn create_test_store() -> SqliteStore {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("bug_condition_test.db");
    SqliteStore::new_with_path(&db_path).unwrap()
}

// ── Test 1: list_archived_intents command handler exists ──────────────────────
// Requirement 1.1: WHEN the frontend invokes `list_archived_intents` via Tauri IPC
// THEN the system should NOT return "Command list_archived_intents not found"
#[test]
fn test_list_archived_intents_callable() {
    let store = create_test_store();
    // Call with no category filter — should return empty Vec, not an error
    let result: Result<Vec<ArchivedIntentSummary>, _> = store.list_archived_intents(None);
    assert!(
        result.is_ok(),
        "list_archived_intents should be callable without error, got: {:?}",
        result.err()
    );
    assert_eq!(result.unwrap().len(), 0, "Empty DB should return empty list");
}

// ── Test 2: get_archived_intent command handler exists ────────────────────────
// Requirement 1.2: WHEN the frontend invokes `get_archived_intent` via Tauri IPC
// THEN the system should NOT return "Command get_archived_intent not found"
#[test]
fn test_get_archived_intent_callable() {
    let store = create_test_store();
    let result: Result<Option<ArchivedIntentDocument>, _> =
        store.get_archived_intent("nonexistent-id");
    assert!(
        result.is_ok(),
        "get_archived_intent should be callable without error, got: {:?}",
        result.err()
    );
    assert_eq!(
        result.unwrap(),
        None,
        "Non-existent id should return None"
    );
}

// ── Test 3: archive_intent command handler exists ─────────────────────────────
// Requirement 1.3: WHEN the frontend invokes `archive_intent` via Tauri IPC
// THEN the system should NOT return "Command archive_intent not found"
#[test]
fn test_archive_intent_callable() {
    let store = create_test_store();
    // First, insert a document to archive
    use wordai_editor_lib::models::{AuraDocument, DocumentBlock};
    let doc = AuraDocument {
        id: "test-doc-1".to_string(),
        intent_name: "Test Document".to_string(),
        content: vec![DocumentBlock::Paragraph {
            text: "Hello world".to_string(),
            inline: vec![],
        }],
        version: None,
        created_at: None,
        updated_at: None,
    };
    store.upsert_intent(&doc).unwrap();

    // Now archive it
    let result: Result<ArchivedIntentSummary, _> =
        store.archive_intent("test-doc-1", "Completed project");
    assert!(
        result.is_ok(),
        "archive_intent should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 4: restore_intent command handler exists ─────────────────────────────
// Requirement 1.4: WHEN the frontend invokes `restore_intent` via Tauri IPC
// THEN the system should NOT return "Command restore_intent not found"
#[test]
fn test_restore_intent_callable() {
    let store = create_test_store();
    // Insert and archive a document first
    use wordai_editor_lib::models::{AuraDocument, DocumentBlock};
    let doc = AuraDocument {
        id: "test-doc-2".to_string(),
        intent_name: "Restore Test".to_string(),
        content: vec![DocumentBlock::Paragraph {
            text: "Content to restore".to_string(),
            inline: vec![],
        }],
        version: None,
        created_at: None,
        updated_at: None,
    };
    store.upsert_intent(&doc).unwrap();
    store.archive_intent("test-doc-2", "Temporary archive").unwrap();

    // Now restore it
    let result: Result<AuraDocument, _> = store.restore_intent("test-doc-2");
    assert!(
        result.is_ok(),
        "restore_intent should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 5: delete_archived_intent command handler exists ─────────────────────
// Requirement 1.5: WHEN the frontend invokes `delete_archived_intent` via Tauri IPC
// THEN the system should NOT return "Command delete_archived_intent not found"
#[test]
fn test_delete_archived_intent_callable() {
    let store = create_test_store();
    // Insert and archive a document first
    use wordai_editor_lib::models::{AuraDocument, DocumentBlock};
    let doc = AuraDocument {
        id: "test-doc-3".to_string(),
        intent_name: "Delete Test".to_string(),
        content: vec![DocumentBlock::Paragraph {
            text: "Content to delete".to_string(),
            inline: vec![],
        }],
        version: None,
        created_at: None,
        updated_at: None,
    };
    store.upsert_intent(&doc).unwrap();
    store.archive_intent("test-doc-3", "Will be deleted").unwrap();

    // Now delete it
    let result: Result<(), _> = store.delete_archived_intent("test-doc-3");
    assert!(
        result.is_ok(),
        "delete_archived_intent should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 6: update_memory_access command handler exists ───────────────────────
// Requirement 1.6: WHEN the frontend invokes `update_memory_access` via Tauri IPC
// THEN the system should NOT return "Command update_memory_access not found"
#[test]
fn test_update_memory_access_callable() {
    let store = create_test_store();
    // Insert and archive a document first
    use wordai_editor_lib::models::{AuraDocument, DocumentBlock};
    let doc = AuraDocument {
        id: "test-doc-4".to_string(),
        intent_name: "Memory Access Test".to_string(),
        content: vec![DocumentBlock::Paragraph {
            text: "Content".to_string(),
            inline: vec![],
        }],
        version: None,
        created_at: None,
        updated_at: None,
    };
    store.upsert_intent(&doc).unwrap();
    store.archive_intent("test-doc-4", "Archived").unwrap();

    // Toggle memory access
    let result: Result<(), _> = store.update_memory_access("test-doc-4", false);
    assert!(
        result.is_ok(),
        "update_memory_access should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 7: get_archive_suggestions command handler exists ────────────────────
// Requirement 1.7: WHEN the frontend invokes `get_archive_suggestions` via Tauri IPC
// THEN the system should NOT return "Command get_archive_suggestions not found"
#[test]
fn test_get_archive_suggestions_callable() {
    let store = create_test_store();
    // get_archive_suggestions returns suggestions for a given active document
    let result: Result<Vec<ArchiveSuggestion>, _> =
        store.get_archive_suggestions("active-doc-1");
    assert!(
        result.is_ok(),
        "get_archive_suggestions should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 8: generate_archive_summary command handler exists ───────────────────
// Requirement 1.8: WHEN the frontend invokes `generate_archive_summary` via Tauri IPC
// THEN the system should NOT return "Command generate_archive_summary not found"
#[test]
fn test_generate_archive_summary_callable() {
    let store = create_test_store();
    // generate_archive_summary returns a text summary for an archived intent
    let result: Result<String, _> = store.generate_archive_summary("some-archived-id");
    assert!(
        result.is_ok(),
        "generate_archive_summary should be callable without error, got: {:?}",
        result.err()
    );
}

// ── Test 9: list_paused_projects command handler exists ───────────────────────
// Requirement 1.9: WHEN the frontend invokes `list_paused_projects` via Tauri IPC
// THEN the system should NOT return "Command list_paused_projects not found"
#[test]
fn test_list_paused_projects_callable() {
    let store = create_test_store();
    let result: Result<Vec<PausedProject>, _> = store.list_paused_projects();
    assert!(
        result.is_ok(),
        "list_paused_projects should be callable without error, got: {:?}",
        result.err()
    );
    assert_eq!(result.unwrap().len(), 0, "Empty DB should return empty list");
}

// ── Test 10: get_project_documents command handler exists ─────────────────────
// Requirement 1.10: WHEN the frontend invokes `get_project_documents` via Tauri IPC
// THEN the system should NOT return "Command get_project_documents not found"
#[test]
fn test_get_project_documents_callable() {
    let store = create_test_store();
    let result: Result<Vec<ArchivedIntentSummary>, _> =
        store.get_project_documents("project-1");
    assert!(
        result.is_ok(),
        "get_project_documents should be callable without error, got: {:?}",
        result.err()
    );
    assert_eq!(result.unwrap().len(), 0, "Empty DB should return empty list");
}

// ── Test 11: Schema tables exist ─────────────────────────────────────────────
// Verifies that `archived_intents` and `paused_projects` tables exist in the schema
#[test]
fn test_archive_schema_tables_exist() {
    let store = create_test_store();
    // Access the connection to check schema directly
    // The store should have created the tables during initialization
    // We verify by attempting operations that require the tables
    let result: Result<Vec<ArchivedIntentSummary>, _> = store.list_archived_intents(None);
    assert!(
        result.is_ok(),
        "archived_intents table should exist (list query should not fail)"
    );

    let result: Result<Vec<PausedProject>, _> = store.list_paused_projects();
    assert!(
        result.is_ok(),
        "paused_projects table should exist (list query should not fail)"
    );
}

// ── Test 12: SqliteStore has archive CRUD methods ─────────────────────────────
// Verifies that SqliteStore exposes all required archive methods
#[test]
fn test_sqlite_store_has_archive_methods() {
    let store = create_test_store();

    // Verify all methods exist by calling them (they should compile and be callable)
    let _ = store.list_archived_intents(None);
    let _ = store.list_archived_intents(Some("manual"));
    let _ = store.get_archived_intent("id");
    let _ = store.delete_archived_intent("id");
    let _ = store.update_memory_access("id", true);
    let _ = store.get_archive_suggestions("id");
    let _ = store.generate_archive_summary("id");
    let _ = store.list_paused_projects();
    let _ = store.get_project_documents("project-id");
}
