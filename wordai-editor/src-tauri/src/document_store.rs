/// Document Store - manages document serialization, deserialization, and version control
/// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 22.1, 22.2, 22.3
use crate::models::{Document, DocumentMetadata, DocumentStatus, IPCError};

/// Serialize a Document to a pretty-printed JSON string.
/// Req 14.1, 14.3
pub fn serialize_document(document: &Document) -> Result<String, IPCError> {
    serde_json::to_string_pretty(document).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: format!("Failed to serialize document: {}", e),
    })
}

/// Deserialize a Document from a JSON string, validating all required fields.
/// Req 14.2, 14.4, 14.5
pub fn deserialize_document(json: &str) -> Result<Document, IPCError> {
    let doc: Document = serde_json::from_str(json).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Invalid document data: {}", e),
    })?;

    validate_document(&doc)?;
    Ok(doc)
}

/// Validate that all required fields are present and non-empty.
/// Req 14.4, 14.5
fn validate_document(doc: &Document) -> Result<(), IPCError> {
    if doc.id.is_empty() {
        return Err(IPCError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Document 'id' is required and must not be empty".to_string(),
        });
    }
    if doc.last_modified.is_empty() {
        return Err(IPCError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Document 'last_modified' is required and must not be empty".to_string(),
        });
    }
    Ok(())
}

/// Increment the document version number in-place.
/// Req 22.2
pub fn increment_version(document: &mut Document) {
    document.version += 1;
}

/// Create a new Document with version initialized to 1.
/// Req 22.1
pub fn create_document(id: String, title: String, last_modified: String) -> Document {
    Document {
        id,
        title,
        content: String::new(),
        metadata: DocumentMetadata {
            word_count: 0,
            reading_time: 0,
            status: DocumentStatus::Draft,
            tags: vec![],
        },
        version: 1,
        last_modified,
    }
}
