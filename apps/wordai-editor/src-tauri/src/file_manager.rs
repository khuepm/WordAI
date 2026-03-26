/// File System Manager - handles document persistence
/// Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
use crate::models::{Document, IPCError};
use std::fs;
use std::path::Path;

/// Validates that a file path is non-empty and has a parent directory that exists.
fn validate_path(path: &str) -> Result<(), IPCError> {
    if path.is_empty() {
        return Err(IPCError {
            code: "INVALID_PATH".to_string(),
            message: "File path must not be empty".to_string(),
        });
    }
    Ok(())
}

/// Serialize and write a Document to the given file path.
/// Req 13.1, 13.4, 13.5
pub fn save_document(path: &str, document: &Document) -> Result<(), IPCError> {
    validate_path(path)?;

    let json = serde_json::to_string_pretty(document).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: format!("Failed to serialize document: {}", e),
    })?;

    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| IPCError {
                code: "PERMISSION_ERROR".to_string(),
                message: format!("Cannot create directory '{}': {}", parent.display(), e),
            })?;
        }
    }

    fs::write(path, json).map_err(|e| {
        let (code, message) = classify_io_error(&e, path, "write");
        IPCError { code, message }
    })
}

/// Read and deserialize a Document from the given file path.
/// Req 13.2, 13.3, 13.5
pub fn load_document(path: &str) -> Result<Document, IPCError> {
    validate_path(path)?;

    if !Path::new(path).exists() {
        return Err(IPCError {
            code: "FILE_NOT_FOUND".to_string(),
            message: format!("File not found: {}", path),
        });
    }

    let content = fs::read_to_string(path).map_err(|e| {
        let (code, message) = classify_io_error(&e, path, "read");
        IPCError { code, message }
    })?;

    serde_json::from_str(&content).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Failed to parse document at '{}': {}", path, e),
    })
}

/// Map std::io::Error to a descriptive error code and message.
fn classify_io_error(e: &std::io::Error, path: &str, op: &str) -> (String, String) {
    use std::io::ErrorKind;
    match e.kind() {
        ErrorKind::PermissionDenied => (
            "PERMISSION_ERROR".to_string(),
            format!("Permission denied when trying to {} '{}'", op, path),
        ),
        ErrorKind::NotFound => (
            "FILE_NOT_FOUND".to_string(),
            format!("File not found: '{}'", path),
        ),
        _ => (
            "FILE_IO_ERROR".to_string(),
            format!("Failed to {} file '{}': {}", op, path, e),
        ),
    }
}
