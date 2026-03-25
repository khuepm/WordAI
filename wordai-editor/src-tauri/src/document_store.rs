/// Document Store - manages document serialization and version control
/// Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 22.1, 22.2, 22.3, 22.4
use crate::models::{Document, IPCError};

pub fn serialize_document(document: &Document) -> Result<String, IPCError> {
    serde_json::to_string_pretty(document).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: e.to_string(),
    })
}

pub fn deserialize_document(json: &str) -> Result<Document, IPCError> {
    let doc: Document = serde_json::from_str(json).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Invalid document data: {}", e),
    })?;

    // Validate required fields
    if doc.id.is_empty() {
        return Err(IPCError {
            code: "VALIDATION_ERROR".to_string(),
            message: "Document id is required".to_string(),
        });
    }

    Ok(doc)
}

pub fn increment_version(document: &mut Document) {
    document.version += 1;
}
