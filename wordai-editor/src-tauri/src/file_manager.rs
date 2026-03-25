/// File System Manager - handles document persistence
/// Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
use crate::models::{Document, IPCError};
use std::fs;
use std::path::Path;

pub fn save_document(path: &str, document: &Document) -> Result<(), IPCError> {
    let json = serde_json::to_string_pretty(document).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: e.to_string(),
    })?;

    fs::write(path, json).map_err(|e| IPCError {
        code: "FILE_WRITE_ERROR".to_string(),
        message: format!("Failed to write file: {}", e),
    })
}

pub fn load_document(path: &str) -> Result<Document, IPCError> {
    if !Path::new(path).exists() {
        return Err(IPCError {
            code: "FILE_NOT_FOUND".to_string(),
            message: format!("File not found: {}", path),
        });
    }

    let content = fs::read_to_string(path).map_err(|e| IPCError {
        code: "FILE_READ_ERROR".to_string(),
        message: format!("Failed to read file: {}", e),
    })?;

    serde_json::from_str(&content).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Failed to parse document: {}", e),
    })
}
