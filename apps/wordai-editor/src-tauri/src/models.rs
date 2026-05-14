/// Shared data models used across backend modules
/// Requirements: 14.1, 14.2, 14.3, 14.4, 22.4
/// AuraBrain models: Requirements 5.1, 5.2, 5.3
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentMetadata {
    pub word_count: u32,
    pub reading_time: u32, // minutes
    pub status: DocumentStatus,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum DocumentStatus {
    Draft,
    Archived,
    Published,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub title: String,
    pub content: String,
    pub metadata: DocumentMetadata,
    pub version: u32,
    pub last_modified: String, // ISO 8601
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISuggestion {
    pub id: String,
    pub suggested_text: String,
    pub explanation: String,
    pub confidence_score: f32, // 0.0 - 1.0
    pub original_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IPCError {
    pub code: String,
    pub message: String,
}

/// A point-in-time snapshot of a document, stored in version history.
/// Requirements: 22.4
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentSnapshot {
    pub version: u32,
    pub content: String,
    pub timestamp: String, // ISO 8601
}

// ── AuraBrain Models ──────────────────────────────────────────────────────────
// Requirements: 5.1, 5.2, 5.3

/// AuraBrain document — the primary unit stored in SQLite.
/// `content` is serialized to/from `raw_content` (JSON) in the DB.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AuraDocument {
    pub id: String,
    pub intent_name: String,
    pub content: Vec<DocumentBlock>,
    pub version: Option<i64>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
}

/// Block-level content elements inside an AuraDocument.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DocumentBlock {
    Paragraph { text: String, inline: Vec<InlineSpan> },
    Heading { level: u8, text: String },
    ListItem { ordered: bool, text: String, inline: Vec<InlineSpan> },
    CodeBlock { language: Option<String>, code: String },
    Placeholder(DocxPlaceholder),
}

/// Inline formatting spans within a block.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum InlineSpan {
    Text { text: String },
    Bold { text: String },
    Italic { text: String },
    Code { text: String },
    BoldItalic { text: String },
}

/// Placeholder for unsupported DOCX elements (Table, Image, Comment, etc.).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DocxPlaceholder {
    pub element_type: String,
    pub raw_xml: String,
    pub display_hint: String,
}

/// Result returned from an import operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub document: AuraDocument,
    pub aura_intent_id: Option<String>,
    pub warnings: Vec<String>,
}

/// Lightweight intent summary (no raw_content) for list views.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntentSummary {
    pub id: String,
    pub intent_name: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub version: i64,
}

// ── Import Progress Models ────────────────────────────────────────────────────
// Requirements: 26.6, 27.3

/// Stage of an import operation, emitted as part of ImportProgressEvent.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum ImportStage {
    ReadingFile,
    ParsingDocument,
    ConvertingBlocks,
    SavingToAuraBrain,
}

/// Progress event emitted during a large file import.
/// Emitted via Tauri event `import-progress`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportProgressEvent {
    pub stage: ImportStage,
    pub blocks_processed: usize,
    pub blocks_estimated: usize,
    pub percent: u8,
}

// ── Export Progress Models ────────────────────────────────────────────────────
// Requirements: 28.1, 28.2

/// Stage of a DOCX export operation, emitted as part of ExportProgressEvent.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "PascalCase")]
pub enum ExportStage {
    BuildingStructure,
    WritingFile,
}

/// Progress event emitted during a large document export.
/// Emitted via Tauri event `export-progress`.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportProgressEvent {
    pub stage: ExportStage,
    pub blocks_processed: usize,
    pub blocks_total: usize,
    pub percent: u8,
}

// ── Cancellation Token ────────────────────────────────────────────────────────
// Requirements: 26.4, 27.4, 28.3, 28.4

use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

/// A lightweight cancellation token backed by an atomic boolean.
/// Can be cloned and shared across threads.
#[derive(Debug, Clone)]
pub struct CancellationToken {
    cancelled: Arc<AtomicBool>,
}

impl CancellationToken {
    /// Create a new, non-cancelled token.
    pub fn new() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Signal cancellation.
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::SeqCst);
    }

    /// Returns true if cancellation has been requested.
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::SeqCst)
    }
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}
