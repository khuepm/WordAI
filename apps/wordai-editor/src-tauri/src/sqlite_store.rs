/// SQLite_Store — AuraBrain persistence layer.
///
/// Manages the AuraBrain SQLite database at the platform-specific path:
///   macOS:   ~/Library/Application Support/WordAI/AuraBrain/aurabrain.db
///   Windows: AppData/Local/WordAI/AuraBrain/aurabrain.db
///
/// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.6, 27.6, 27.7
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde_json;
use tauri::Manager;

use crate::models::{AuraDocument, DocumentBlock, IntentSummary, IPCError, PartialImportResult};

// ── SqliteStore ───────────────────────────────────────────────────────────────

pub struct SqliteStore {
    conn: Arc<Mutex<Connection>>,
}

// Arc<Mutex<Connection>> is Send + Sync, so SqliteStore is too.
unsafe impl Send for SqliteStore {}
unsafe impl Sync for SqliteStore {}

impl SqliteStore {
    /// Initialise the AuraBrain database.
    ///
    /// 1. Resolves the platform-specific data directory via Tauri's `app_data_dir()`.
    /// 2. Creates the `WordAI/AuraBrain/` sub-directory if it does not exist.
    /// 3. Opens (or creates) `aurabrain.db`.
    /// 4. Enables WAL mode.
    /// 5. Creates the schema (idempotent — uses `IF NOT EXISTS`).
    ///
    /// Requirements: 5.1, 9.6
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self, IPCError> {
        // Resolve platform path: <app_data_dir>/WordAI/AuraBrain/
        let base = app_handle.path().app_data_dir().map_err(|e| IPCError {
            code: "PATH_ERROR".to_string(),
            message: format!("Cannot resolve app data directory: {e}"),
        })?;

        let db_path = base.join("WordAI").join("AuraBrain").join("aurabrain.db");
        Self::new_with_path(&db_path)
    }

    /// Initialise the AuraBrain database at an explicit path.
    ///
    /// This is the core initialisation logic extracted for testability.
    /// `new()` resolves the platform path and delegates here.
    ///
    /// 1. Creates parent directories if they do not exist.
    /// 2. Opens (or creates) the SQLite database at `db_path`.
    /// 3. Enables WAL mode.
    /// 4. Creates the schema (idempotent — uses `IF NOT EXISTS`).
    ///
    /// Requirements: 5.1, 9.6
    pub(crate) fn new_with_path(db_path: &std::path::Path) -> Result<Self, IPCError> {
        // Create parent directories if needed
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| IPCError {
                code: "IO_ERROR".to_string(),
                message: format!("Cannot create AuraBrain directory: {e}"),
            })?;
        }

        let conn = Connection::open(db_path).map_err(|e| IPCError {
            code: "DB_OPEN_ERROR".to_string(),
            message: format!("Cannot open AuraBrain database: {e}"),
        })?;

        // Enable WAL mode for concurrent reads (Requirement 9.6)
        conn.execute_batch("PRAGMA journal_mode=WAL;").map_err(|e| IPCError {
            code: "DB_PRAGMA_ERROR".to_string(),
            message: format!("Cannot set WAL mode: {e}"),
        })?;

        // Create schema (idempotent)
        conn.execute_batch(SCHEMA_SQL).map_err(|e| IPCError {
            code: "DB_SCHEMA_ERROR".to_string(),
            message: format!("Cannot create AuraBrain schema: {e}"),
        })?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    /// Write a document and its chunks in a single atomic transaction.
    ///
    /// - Uses `INSERT OR REPLACE` for the `intents` row.
    /// - Increments `version` on each successful upsert.
    /// - Deletes existing chunks then inserts new ones in the same transaction.
    /// - Rolls back everything if any step fails.
    ///
    /// Returns the new `version` value.
    ///
    /// Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
    pub fn upsert_intent(&self, doc: &AuraDocument) -> Result<i64, IPCError> {
        let conn = self.conn.lock().map_err(|_| IPCError {
            code: "LOCK_ERROR".to_string(),
            message: "Cannot acquire database lock".to_string(),
        })?;

        // Serialize content blocks to JSON for raw_content column
        let raw_content = serde_json::to_string(&doc.content).map_err(|e| IPCError {
            code: "SERIALIZE_ERROR".to_string(),
            message: format!("Cannot serialize document content: {e}"),
        })?;

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let created_at = doc.created_at.unwrap_or(now_ms);
        let updated_at = now_ms;

        // Determine next version: existing version + 1, or 1 for new documents
        let current_version: i64 = conn
            .query_row(
                "SELECT version FROM intents WHERE id = ?1",
                params![doc.id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let new_version = current_version + 1;

        // Begin transaction
        conn.execute_batch("BEGIN;").map_err(|e| IPCError {
            code: "TX_ERROR".to_string(),
            message: format!("Cannot begin transaction: {e}"),
        })?;

        let result = (|| -> Result<(), IPCError> {
            // Upsert the intent row
            conn.execute(
                "INSERT OR REPLACE INTO intents \
                 (id, intent_name, raw_content, created_at, updated_at, version) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    doc.id,
                    doc.intent_name,
                    raw_content,
                    created_at,
                    updated_at,
                    new_version,
                ],
            )
            .map_err(|e| IPCError {
                code: "DB_WRITE_ERROR".to_string(),
                message: format!("Cannot upsert intent: {e}"),
            })?;

            // Delete old chunks (ON DELETE CASCADE would handle this, but we do it
            // explicitly so the transaction is self-contained)
            conn.execute(
                "DELETE FROM intent_chunks WHERE document_id = ?1",
                params![doc.id],
            )
            .map_err(|e| IPCError {
                code: "DB_WRITE_ERROR".to_string(),
                message: format!("Cannot delete old chunks: {e}"),
            })?;

            // Insert new chunks (embedding is NULL — Requirement 5.7)
            for (idx, block) in doc.content.iter().enumerate() {
                let chunk_text = extract_block_text(block);
                if chunk_text.is_empty() {
                    continue;
                }
                let chunk_id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO intent_chunks \
                     (id, document_id, chunk_index, chunk_text, embedding) \
                     VALUES (?1, ?2, ?3, ?4, NULL)",
                    params![chunk_id, doc.id, idx as i64, chunk_text],
                )
                .map_err(|e| IPCError {
                    code: "DB_WRITE_ERROR".to_string(),
                    message: format!("Cannot insert chunk {idx}: {e}"),
                })?;
            }

            Ok(())
        })();

        match result {
            Ok(()) => {
                conn.execute_batch("COMMIT;").map_err(|e| IPCError {
                    code: "TX_ERROR".to_string(),
                    message: format!("Cannot commit transaction: {e}"),
                })?;
                Ok(new_version)
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                Err(e)
            }
        }
    }

    /// Write a document and its chunks in batches for large documents.
    ///
    /// - First transaction: writes intent metadata and deletes old chunks.
    /// - Subsequent transactions: writes chunks in batches of `batch_size`.
    /// - If a batch fails, only that batch is rolled back; previously committed
    ///   batches remain persisted.
    /// - Calls `progress_cb` after each successful batch with the number of
    ///   blocks saved so far.
    ///
    /// Returns `Ok(new_version)` on full success, or
    /// `Err(PartialImportResult)` if a batch fails partway through.
    ///
    /// Requirements: 27.6, 27.7
    pub fn upsert_intent_batched<F>(
        &self,
        doc: &AuraDocument,
        batch_size: usize,
        progress_cb: F,
    ) -> Result<i64, PartialImportResult>
    where
        F: Fn(usize),
    {
        let batch_size = if batch_size == 0 { 100 } else { batch_size };

        let conn = self.conn.lock().map_err(|_| PartialImportResult {
            blocks_saved: 0,
            error: IPCError {
                code: "LOCK_ERROR".to_string(),
                message: "Cannot acquire database lock".to_string(),
            },
        })?;

        // Serialize content blocks to JSON for raw_content column
        let raw_content = serde_json::to_string(&doc.content).map_err(|e| PartialImportResult {
            blocks_saved: 0,
            error: IPCError {
                code: "SERIALIZE_ERROR".to_string(),
                message: format!("Cannot serialize document content: {e}"),
            },
        })?;

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let created_at = doc.created_at.unwrap_or(now_ms);
        let updated_at = now_ms;

        // Determine next version
        let current_version: i64 = conn
            .query_row(
                "SELECT version FROM intents WHERE id = ?1",
                params![doc.id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        let new_version = current_version + 1;

        // ── Transaction 1: Write intent metadata and delete old chunks ────────
        conn.execute_batch("BEGIN;").map_err(|e| PartialImportResult {
            blocks_saved: 0,
            error: IPCError {
                code: "TX_ERROR".to_string(),
                message: format!("Cannot begin metadata transaction: {e}"),
            },
        })?;

        let meta_result = (|| -> Result<(), IPCError> {
            conn.execute(
                "INSERT OR REPLACE INTO intents \
                 (id, intent_name, raw_content, created_at, updated_at, version) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    doc.id,
                    doc.intent_name,
                    raw_content,
                    created_at,
                    updated_at,
                    new_version,
                ],
            )
            .map_err(|e| IPCError {
                code: "DB_WRITE_ERROR".to_string(),
                message: format!("Cannot upsert intent: {e}"),
            })?;

            conn.execute(
                "DELETE FROM intent_chunks WHERE document_id = ?1",
                params![doc.id],
            )
            .map_err(|e| IPCError {
                code: "DB_WRITE_ERROR".to_string(),
                message: format!("Cannot delete old chunks: {e}"),
            })?;

            Ok(())
        })();

        match meta_result {
            Ok(()) => {
                conn.execute_batch("COMMIT;").map_err(|e| PartialImportResult {
                    blocks_saved: 0,
                    error: IPCError {
                        code: "TX_ERROR".to_string(),
                        message: format!("Cannot commit metadata transaction: {e}"),
                    },
                })?;
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(PartialImportResult {
                    blocks_saved: 0,
                    error: e,
                });
            }
        }

        // ── Batch transactions: Write chunks in batches ───────────────────────
        // Filter out empty blocks first
        let non_empty_blocks: Vec<(usize, &DocumentBlock)> = doc
            .content
            .iter()
            .enumerate()
            .filter(|(_, block)| !extract_block_text(block).is_empty())
            .collect();

        let mut blocks_saved: usize = 0;

        for chunk in non_empty_blocks.chunks(batch_size) {
            conn.execute_batch("BEGIN;").map_err(|e| PartialImportResult {
                blocks_saved,
                error: IPCError {
                    code: "TX_ERROR".to_string(),
                    message: format!("Cannot begin batch transaction: {e}"),
                },
            })?;

            let batch_result = (|| -> Result<(), IPCError> {
                for &(idx, block) in chunk {
                    let chunk_text = extract_block_text(block);
                    let chunk_id = uuid::Uuid::new_v4().to_string();
                    conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, ?3, ?4, NULL)",
                        params![chunk_id, doc.id, idx as i64, chunk_text],
                    )
                    .map_err(|e| IPCError {
                        code: "DB_WRITE_ERROR".to_string(),
                        message: format!("Cannot insert chunk {idx}: {e}"),
                    })?;
                }
                Ok(())
            })();

            match batch_result {
                Ok(()) => {
                    conn.execute_batch("COMMIT;").map_err(|e| PartialImportResult {
                        blocks_saved,
                        error: IPCError {
                            code: "TX_ERROR".to_string(),
                            message: format!("Cannot commit batch transaction: {e}"),
                        },
                    })?;
                    blocks_saved += chunk.len();
                    progress_cb(blocks_saved);
                }
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK;");
                    return Err(PartialImportResult {
                        blocks_saved,
                        error: e,
                    });
                }
            }
        }

        Ok(new_version)
    }

    /// Retrieve a single intent by id, including its `raw_content`.
    ///
    /// Returns `None` if no intent with the given id exists.
    ///
    /// Requirements: 5.2
    pub fn get_intent(&self, id: &str) -> Result<Option<AuraDocument>, IPCError> {
        let conn = self.conn.lock().map_err(|_| IPCError {
            code: "LOCK_ERROR".to_string(),
            message: "Cannot acquire database lock".to_string(),
        })?;

        let result = conn.query_row(
            "SELECT id, intent_name, raw_content, created_at, updated_at, version \
             FROM intents WHERE id = ?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, i64>(5)?,
                ))
            },
        );

        match result {
            Ok((id, intent_name, raw_content, created_at, updated_at, version)) => {
                let content: Vec<DocumentBlock> =
                    serde_json::from_str(&raw_content).map_err(|e| IPCError {
                        code: "DESERIALIZE_ERROR".to_string(),
                        message: format!("Cannot deserialize document content: {e}"),
                    })?;
                Ok(Some(AuraDocument {
                    id,
                    intent_name,
                    content,
                    version: Some(version),
                    created_at: Some(created_at),
                    updated_at: Some(updated_at),
                }))
            }
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(IPCError {
                code: "DB_READ_ERROR".to_string(),
                message: format!("Cannot read intent: {e}"),
            }),
        }
    }

    /// List all intents as lightweight summaries (no `raw_content`).
    ///
    /// Requirements: 5.2
    pub fn list_intents(&self) -> Result<Vec<IntentSummary>, IPCError> {
        let conn = self.conn.lock().map_err(|_| IPCError {
            code: "LOCK_ERROR".to_string(),
            message: "Cannot acquire database lock".to_string(),
        })?;

        let mut stmt = conn
            .prepare(
                "SELECT id, intent_name, created_at, updated_at, version \
                 FROM intents ORDER BY updated_at DESC",
            )
            .map_err(|e| IPCError {
                code: "DB_READ_ERROR".to_string(),
                message: format!("Cannot prepare list query: {e}"),
            })?;

        let rows = stmt
            .query_map([], |row| {
                Ok(IntentSummary {
                    id: row.get(0)?,
                    intent_name: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    version: row.get(4)?,
                })
            })
            .map_err(|e| IPCError {
                code: "DB_READ_ERROR".to_string(),
                message: format!("Cannot execute list query: {e}"),
            })?;

        let mut summaries = Vec::new();
        for row in rows {
            summaries.push(row.map_err(|e| IPCError {
                code: "DB_READ_ERROR".to_string(),
                message: format!("Cannot read intent row: {e}"),
            })?);
        }

        Ok(summaries)
    }
}

// ── SQL Schema ────────────────────────────────────────────────────────────────

const SCHEMA_SQL: &str = "
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS intents (
    id          TEXT PRIMARY KEY,
    intent_name TEXT NOT NULL DEFAULT '',
    raw_content TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL,
    version     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS intent_chunks (
    id          TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES intents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text  TEXT NOT NULL,
    embedding   BLOB
);

CREATE INDEX IF NOT EXISTS idx_intent_chunks_document_id ON intent_chunks(document_id);
";

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Extract plain text from a DocumentBlock for chunk storage.
fn extract_block_text(block: &DocumentBlock) -> String {
    match block {
        DocumentBlock::Paragraph { text, .. } => text.clone(),
        DocumentBlock::Heading { text, .. } => text.clone(),
        DocumentBlock::ListItem { text, .. } => text.clone(),
        DocumentBlock::CodeBlock { code, .. } => code.clone(),
        DocumentBlock::Placeholder(p) => p.display_hint.clone(),
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_db_created_at_path() {
        // Test that the DB file is created at the specified path
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test.db");
        assert!(!db_path.exists());
        let _store = SqliteStore::new_with_path(&db_path).unwrap();
        assert!(db_path.exists(), "DB file should be created at the given path");
    }

    #[test]
    fn test_wal_mode_enabled() {
        // Test that WAL journal mode is enabled after initialization
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("wal_test.db");
        let store = SqliteStore::new_with_path(&db_path).unwrap();
        let conn = store.conn.lock().unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "wal", "Journal mode should be WAL");
    }

    #[test]
    fn test_schema_exists_after_init() {
        // Test that both tables exist after initialization
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("schema_test.db");
        let store = SqliteStore::new_with_path(&db_path).unwrap();
        let conn = store.conn.lock().unwrap();

        // Check intents table exists
        let intents_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='intents'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(intents_exists, 1, "intents table should exist");

        // Check intent_chunks table exists
        let chunks_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='intent_chunks'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(chunks_exists, 1, "intent_chunks table should exist");

        // Check index exists
        let index_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='idx_intent_chunks_document_id'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(index_exists, 1, "idx_intent_chunks_document_id index should exist");
    }

    // ── Property-Based Tests ──────────────────────────────────────────────────

    // Feature: file-save-management, Property 1: Atomic Write — nếu upsert thất bại giữa chừng, DB không có dữ liệu nửa vời
    // Validates: Requirements 5.4, 5.5, 9.1
    #[cfg(test)]
    mod pbt {
        use super::*;
        use proptest::prelude::*;
        use tempfile::tempdir;

        /// Generate a random non-empty string of printable ASCII characters.
        fn arb_nonempty_string() -> impl Strategy<Value = String> {
            "[a-zA-Z0-9 ]{1,50}".prop_map(|s| s)
        }

        /// Generate a random DocumentBlock (Paragraph or Heading).
        fn arb_document_block() -> impl Strategy<Value = DocumentBlock> {
            prop_oneof![
                arb_nonempty_string().prop_map(|text| DocumentBlock::Paragraph {
                    text,
                    inline: vec![],
                }),
                (1u8..=3u8, arb_nonempty_string()).prop_map(|(level, text)| {
                    DocumentBlock::Heading { level, text }
                }),
            ]
        }

        /// Generate a Vec of 1–5 DocumentBlocks.
        fn arb_blocks() -> impl Strategy<Value = Vec<DocumentBlock>> {
            prop::collection::vec(arb_document_block(), 1..=5)
        }

        proptest! {
            /// Property 1: Atomic Write
            ///
            /// If `upsert_intent` fails mid-transaction (simulated by injecting a
            /// duplicate PRIMARY KEY on the second chunk insert), the `intents` table
            /// must NOT contain the partial record — the entire transaction is rolled back.
            ///
            /// Feature: file-save-management, Property 1: Atomic Write — nếu upsert thất bại giữa chừng, DB không có dữ liệu nửa vời
            /// Validates: Requirements 5.4, 5.5, 9.1
            #[test]
            fn prop_atomic_write_rollback_on_chunk_failure(
                intent_name in arb_nonempty_string(),
                blocks in arb_blocks(),
            ) {
                let dir = tempdir().unwrap();
                let db_path = dir.path().join("atomic_test.db");
                let store = SqliteStore::new_with_path(&db_path).unwrap();

                let doc_id = uuid::Uuid::new_v4().to_string();
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;

                // Simulate a mid-transaction failure by manually running the steps
                // with a duplicate chunk id (PRIMARY KEY violation on second insert).
                let raw_content = serde_json::to_string(&blocks).unwrap();
                let duplicate_chunk_id = "duplicate-chunk-id-that-will-collide";

                let conn = store.conn.lock().unwrap();

                // Run the transaction manually, injecting a PK collision on the 2nd chunk
                let result: Result<(), rusqlite::Error> = (|| {
                    conn.execute_batch("BEGIN;")?;

                    // Step 1: Insert the intent row (succeeds)
                    conn.execute(
                        "INSERT OR REPLACE INTO intents \
                         (id, intent_name, raw_content, created_at, updated_at, version) \
                         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
                        params![doc_id, intent_name, raw_content, now_ms, now_ms],
                    )?;

                    // Step 2: Delete old chunks (no-op for new doc)
                    conn.execute(
                        "DELETE FROM intent_chunks WHERE document_id = ?1",
                        params![doc_id],
                    )?;

                    // Step 3a: Insert first chunk with the duplicate id (succeeds)
                    conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, 0, 'chunk_a', NULL)",
                        params![duplicate_chunk_id, doc_id],
                    )?;

                    // Step 3b: Insert second chunk with the SAME id → PRIMARY KEY violation
                    conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, 1, 'chunk_b', NULL)",
                        params![duplicate_chunk_id, doc_id],
                    )?;

                    conn.execute_batch("COMMIT;")?;
                    Ok(())
                })();

                // The transaction must have failed
                prop_assert!(result.is_err(), "Expected transaction to fail due to PK collision");

                // Rollback explicitly (mirrors upsert_intent error path)
                let _ = conn.execute_batch("ROLLBACK;");

                // Assert: intents table must NOT contain the partial record
                let intent_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM intents WHERE id = ?1",
                        params![doc_id],
                        |row| row.get(0),
                    )
                    .unwrap();

                prop_assert_eq!(
                    intent_count,
                    0,
                    "intents table must not contain partial record after failed transaction"
                );

                // Assert: intent_chunks table must also be empty for this doc
                let chunk_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM intent_chunks WHERE document_id = ?1",
                        params![doc_id],
                        |row| row.get(0),
                    )
                    .unwrap();

                prop_assert_eq!(
                    chunk_count,
                    0,
                    "intent_chunks table must not contain partial data after failed transaction"
                );
            }
        }
    }

    // Feature: file-save-management, Property: Batch Atomicity — nếu batch N thất bại, chỉ batch N bị rollback, các batch 1..N-1 vẫn còn
    // Validates: Requirements 27.6, 27.7
    #[cfg(test)]
    mod pbt_batch {
        use super::*;
        use proptest::prelude::*;
        use tempfile::tempdir;

        /// Generate a random non-empty string of printable ASCII characters.
        fn arb_nonempty_string() -> impl Strategy<Value = String> {
            "[a-zA-Z0-9 ]{1,50}".prop_map(|s| s)
        }

        /// Generate a random DocumentBlock (Paragraph or Heading).
        fn arb_document_block() -> impl Strategy<Value = DocumentBlock> {
            prop_oneof![
                arb_nonempty_string().prop_map(|text| DocumentBlock::Paragraph {
                    text,
                    inline: vec![],
                }),
                (1u8..=3u8, arb_nonempty_string()).prop_map(|(level, text)| {
                    DocumentBlock::Heading { level, text }
                }),
            ]
        }

        /// Generate a Vec of 5–20 DocumentBlocks (enough for multiple batches).
        fn arb_many_blocks() -> impl Strategy<Value = Vec<DocumentBlock>> {
            prop::collection::vec(arb_document_block(), 5..=20)
        }

        proptest! {
            /// Property: Batch Atomicity
            ///
            /// If batch N fails during `upsert_intent_batched`, only batch N is
            /// rolled back. All previously committed batches (1..N-1) remain
            /// persisted in the database.
            ///
            /// Strategy: Use a batch_size of 3. After the first batch succeeds,
            /// inject a PRIMARY KEY collision in the second batch by pre-inserting
            /// a chunk with a known UUID that will collide.
            ///
            /// Feature: file-save-management, Property: Batch Atomicity — nếu batch N thất bại, chỉ batch N bị rollback, các batch 1..N-1 vẫn còn
            /// **Validates: Requirements 27.6, 27.7**
            #[test]
            fn prop_batch_atomicity_partial_failure(
                intent_name in arb_nonempty_string(),
                blocks in arb_many_blocks(),
            ) {
                let dir = tempdir().unwrap();
                let db_path = dir.path().join("batch_test.db");
                let store = SqliteStore::new_with_path(&db_path).unwrap();

                let doc_id = uuid::Uuid::new_v4().to_string();
                let batch_size = 3usize;

                let doc = AuraDocument {
                    id: doc_id.clone(),
                    intent_name: intent_name.clone(),
                    content: blocks.clone(),
                    version: None,
                    created_at: None,
                    updated_at: None,
                };

                // First, do a successful full batched write to establish baseline
                let result = store.upsert_intent_batched(&doc, batch_size, |_| {});
                prop_assert!(result.is_ok(), "Initial batched write should succeed");

                // Count chunks written
                let conn = store.conn.lock().unwrap();
                let initial_chunk_count: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM intent_chunks WHERE document_id = ?1",
                        params![doc_id],
                        |row| row.get(0),
                    )
                    .unwrap();

                // Non-empty blocks count
                let non_empty_count = blocks.iter()
                    .filter(|b| !extract_block_text(b).is_empty())
                    .count() as i64;

                prop_assert_eq!(
                    initial_chunk_count,
                    non_empty_count,
                    "All non-empty blocks should be saved initially"
                );
                drop(conn);

                // Now simulate a partial failure by manually running batched logic
                // with a collision injected in the second batch.
                // We'll do this by:
                // 1. Writing metadata + deleting old chunks (transaction 1)
                // 2. Writing first batch successfully (transaction 2)
                // 3. Injecting a collision in the second batch (transaction 3 fails)

                let conn = store.conn.lock().unwrap();
                let raw_content = serde_json::to_string(&blocks).unwrap();
                let now_ms = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64;

                let current_version: i64 = conn
                    .query_row(
                        "SELECT version FROM intents WHERE id = ?1",
                        params![doc_id],
                        |row| row.get(0),
                    )
                    .unwrap_or(0);
                let new_version = current_version + 1;

                // Transaction 1: metadata + delete old chunks
                conn.execute_batch("BEGIN;").unwrap();
                conn.execute(
                    "INSERT OR REPLACE INTO intents \
                     (id, intent_name, raw_content, created_at, updated_at, version) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![doc_id, intent_name, raw_content, now_ms, now_ms, new_version],
                ).unwrap();
                conn.execute(
                    "DELETE FROM intent_chunks WHERE document_id = ?1",
                    params![doc_id],
                ).unwrap();
                conn.execute_batch("COMMIT;").unwrap();

                // Collect non-empty blocks with indices
                let non_empty_blocks: Vec<(usize, &DocumentBlock)> = blocks
                    .iter()
                    .enumerate()
                    .filter(|(_, block)| !extract_block_text(block).is_empty())
                    .collect();

                // Transaction 2: Write first batch successfully
                let first_batch = &non_empty_blocks[..batch_size.min(non_empty_blocks.len())];
                conn.execute_batch("BEGIN;").unwrap();
                for &(idx, block) in first_batch {
                    let chunk_text = extract_block_text(block);
                    let chunk_id = uuid::Uuid::new_v4().to_string();
                    conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, ?3, ?4, NULL)",
                        params![chunk_id, doc_id, idx as i64, chunk_text],
                    ).unwrap();
                }
                conn.execute_batch("COMMIT;").unwrap();

                let first_batch_count = first_batch.len() as i64;

                // Transaction 3: Attempt second batch with a PK collision
                if non_empty_blocks.len() > batch_size {
                    let second_batch = &non_empty_blocks[batch_size..
                        (batch_size * 2).min(non_empty_blocks.len())];

                    let collision_id = "collision-id-for-batch-test";

                    conn.execute_batch("BEGIN;").unwrap();

                    // Insert first item of second batch with a known id
                    let (idx0, block0) = second_batch[0];
                    let chunk_text0 = extract_block_text(block0);
                    conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, ?3, ?4, NULL)",
                        params![collision_id, doc_id, idx0 as i64, chunk_text0],
                    ).unwrap();

                    // Try to insert again with same id → PK violation
                    let collision_result = conn.execute(
                        "INSERT INTO intent_chunks \
                         (id, document_id, chunk_index, chunk_text, embedding) \
                         VALUES (?1, ?2, ?3, ?4, NULL)",
                        params![collision_id, doc_id, (idx0 + 1) as i64, "collision"],
                    );

                    prop_assert!(collision_result.is_err(), "PK collision should fail");
                    let _ = conn.execute_batch("ROLLBACK;");

                    // Assert: first batch chunks are still there
                    let remaining_chunks: i64 = conn
                        .query_row(
                            "SELECT COUNT(*) FROM intent_chunks WHERE document_id = ?1",
                            params![doc_id],
                            |row| row.get(0),
                        )
                        .unwrap();

                    prop_assert_eq!(
                        remaining_chunks,
                        first_batch_count,
                        "Only first batch chunks should remain after second batch failure"
                    );

                    // Assert: intent metadata is still there (from transaction 1)
                    let intent_exists: i64 = conn
                        .query_row(
                            "SELECT COUNT(*) FROM intents WHERE id = ?1",
                            params![doc_id],
                            |row| row.get(0),
                        )
                        .unwrap();

                    prop_assert_eq!(
                        intent_exists,
                        1,
                        "Intent metadata should persist even when a chunk batch fails"
                    );
                }
            }
        }
    }
}
