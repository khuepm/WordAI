pub mod ai_service;
pub mod docx_exporter;
pub mod document_store;
pub mod file_manager;
pub mod markdown_serializer;
pub mod models;
pub mod pdf_export;
pub mod preferences_store;
pub mod sqlite_store;

use models::{AISuggestion, AuraDocument, Document, DocumentSnapshot, IntentSummary, IPCError};
use pdf_export::PDFExportOptions;
use sqlite_store::SqliteStore;
use tauri::Manager;

// ── IPC Commands ──────────────────────────────────────────────────────────────

/// Save a document to the given file path.
/// Increments the version number before persisting.
/// Stores a snapshot in version history before overwriting.
/// Requirements: 13.1, 14.1, 15.1, 15.2, 15.3, 22.2, 22.4
#[tauri::command]
fn save_document(app: tauri::AppHandle, path: String, mut document: Document) -> Result<(), IPCError> {
    use chrono::Utc;
    let full_path = resolve_doc_path(&app, &path)?;
    // Capture snapshot of current state before incrementing
    let snapshot = DocumentSnapshot {
        version: document.version,
        content: document.content.clone(),
        timestamp: Utc::now().to_rfc3339(),
    };
    document_store::push_snapshot(&document.id, snapshot);
    document_store::increment_version(&mut document);
    file_manager::save_document(&full_path, &document)
}

/// Load a document from the given file path.
/// Requirements: 13.2, 13.3, 14.2, 15.1, 15.2, 15.3
#[tauri::command]
fn load_document(app: tauri::AppHandle, path: String) -> Result<Document, IPCError> {
    let full_path = resolve_doc_path(&app, &path)?;
    file_manager::load_document(&full_path)
}

/// Create a new empty document with version 1 and persist it.
/// Requirements: 1.1, 14.1, 15.1, 22.1
#[tauri::command]
fn create_document(app: tauri::AppHandle, id: String, title: String, path: String) -> Result<Document, IPCError> {
    use chrono::Utc;
    let full_path = resolve_doc_path(&app, &path)?;
    let now = Utc::now().to_rfc3339();
    let doc = document_store::create_document(id, title, now);
    file_manager::save_document(&full_path, &doc)?;
    Ok(doc)
}

/// Resolve a relative document path to an absolute path under app data dir.
fn resolve_doc_path(app: &tauri::AppHandle, path: &str) -> Result<String, IPCError> {
    let base = app.path().app_data_dir().map_err(|_| IPCError {
        code: "PATH_ERROR".to_string(),
        message: "Cannot resolve app data directory".to_string(),
    })?;
    Ok(base.join(path).to_string_lossy().to_string())
}

// ── AI Commands ──────────────────────────────────────────────────────────────

/// Request AI writing suggestions for the given document context.
/// Requirements: 6.2, 6.3, 6.4, 15.2
#[tauri::command]
async fn request_ai_suggestion(
    context: String,
    selected_text: Option<String>,
    api_key: String,
    endpoint: Option<String>,
) -> Result<Vec<AISuggestion>, IPCError> {
    let connector = ai_service::AIServiceConnector::new(api_key, endpoint);
    connector
        .request_suggestion(&context, selected_text.as_deref())
        .await
}

/// Send a chat message to the AI assistant.
/// Requirements: 23.2, 23.4, 15.2
#[tauri::command]
async fn send_chat_message(
    message: String,
    history: Vec<String>,
    api_key: String,
    endpoint: Option<String>,
) -> Result<String, IPCError> {
    let connector = ai_service::AIServiceConnector::new(api_key, endpoint);
    connector.send_chat_message(&message, &history).await
}

/// Check whether the AI service is reachable with the given credentials.
/// Requirements: 25.4, 15.2
#[tauri::command]
async fn check_ai_health(api_key: String, endpoint: Option<String>) -> bool {
    let connector = ai_service::AIServiceConnector::new(api_key, endpoint);
    connector.check_health().await
}

// ── PDF Export Command ────────────────────────────────────────────────────────

/// Export document content to a PDF file at the given path.
/// Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
#[tauri::command]
fn export_to_pdf(
    content: String,
    output_path: String,
    options: PDFExportOptions,
) -> Result<(), IPCError> {
    pdf_export::PDFExportEngine::generate_pdf(&content, &output_path, &options)
}

/// Return the version history (last 10 snapshots) for a document.
/// Requirements: 22.4
#[tauri::command]
fn get_version_history(doc_id: String) -> Vec<DocumentSnapshot> {
    document_store::get_version_history(&doc_id)
}

// ── AuraBrain IPC Commands ────────────────────────────────────────────────────

/// Sync (upsert) an AuraDocument into the AuraBrain SQLite store.
/// Returns the new version number on success.
/// Requirements: 1.1, 1.7, 5.4
#[tauri::command]
async fn sync_intent(
    document: AuraDocument,
    state: tauri::State<'_, SqliteStore>,
) -> Result<i64, IPCError> {
    state.upsert_intent(&document)
}

/// Retrieve a single AuraDocument by id (includes raw_content).
/// Returns None if no intent with the given id exists.
/// Requirements: 5.2
#[tauri::command]
async fn get_intent(
    id: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<Option<AuraDocument>, IPCError> {
    state.get_intent(&id)
}

/// List all intents as lightweight summaries (no raw_content).
/// Requirements: 5.2
#[tauri::command]
async fn list_intents(
    state: tauri::State<'_, SqliteStore>,
) -> Result<Vec<IntentSummary>, IPCError> {
    state.list_intents()
}

// ── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let store = SqliteStore::new(app.handle()).map_err(|e| {
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize AuraBrain SQLite store: {}", e.message),
                )) as Box<dyn std::error::Error>
            })?;
            app.manage(store);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_document,
            load_document,
            create_document,
            request_ai_suggestion,
            send_chat_message,
            check_ai_health,
            export_to_pdf,
            get_version_history,
            preferences_store::load_preferences,
            preferences_store::save_preferences,
            preferences_store::reset_preferences,
            sync_intent,
            get_intent,
            list_intents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
