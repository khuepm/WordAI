/// SQLite_Store — AuraBrain persistence layer.
///
/// Manages the AuraBrain SQLite database at the platform-specific path:
///   macOS:   ~/Library/Application Support/WordAI/AuraBrain/aurabrain.db
///   Windows: AppData/Local/WordAI/AuraBrain/aurabrain.db
///
/// Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 9.6
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use serde_json;
use tauri::Manager;

use crate::models::{AuraDocument, DocumentBlock, IntentSummary, IPCError};

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

        let db_dir = base.join("WordAI").join("AuraBrain");
        std::fs::create_dir_all(&db_dir).map_err(|e| IPCError {
            code: "IO_ERROR".to_string(),
            message: format!("Cannot create AuraBrain directory: {e}"),
        })?;

        let db_path = db_dir.join("aurabrain.db");

        let conn = Connection::open(&db_path).map_err(|e| IPCError {
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
