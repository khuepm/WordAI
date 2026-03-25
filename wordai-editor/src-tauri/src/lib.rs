pub mod ai_service;
pub mod document_store;
pub mod file_manager;
pub mod models;
pub mod pdf_export;

use models::{Document, IPCError};

// ── IPC Commands ──────────────────────────────────────────────────────────────

/// Save a document to the given file path.
/// Increments the version number before persisting.
/// Requirements: 13.1, 14.1, 15.1, 15.2, 15.3, 22.2
#[tauri::command]
fn save_document(path: String, mut document: Document) -> Result<(), IPCError> {
    document_store::increment_version(&mut document);
    file_manager::save_document(&path, &document)
}

/// Load a document from the given file path.
/// Requirements: 13.2, 13.3, 14.2, 15.1, 15.2, 15.3
#[tauri::command]
fn load_document(path: String) -> Result<Document, IPCError> {
    file_manager::load_document(&path)
}

/// Create a new empty document with version 1 and persist it.
/// Requirements: 1.1, 14.1, 15.1, 22.1
#[tauri::command]
fn create_document(id: String, title: String, path: String) -> Result<Document, IPCError> {
    use chrono::Utc;
    let now = Utc::now().to_rfc3339();
    let doc = document_store::create_document(id, title, now);
    file_manager::save_document(&path, &doc)?;
    Ok(doc)
}

// ── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_document,
            load_document,
            create_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
