/// Shared data models used across backend modules
/// Requirements: 14.1, 14.2, 14.3, 14.4, 22.4
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
