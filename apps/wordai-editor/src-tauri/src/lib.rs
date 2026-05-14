pub mod ai_service;
pub mod docx_exporter;
pub mod document_store;
pub mod file_manager;
pub mod markdown_serializer;
pub mod models;
pub mod pdf_export;
pub mod preferences_store;
pub mod sqlite_store;

use models::{AISuggestion, AuraDocument, CancellationToken, Document, DocumentSnapshot, IntentSummary, IPCError};
use pdf_export::PDFExportOptions;
use sqlite_store::SqliteStore;
use tauri::Manager;

// ── Export Cancellation State ─────────────────────────────────────────────────
// Requirements: 28.3, 28.4

/// Managed state holding the current export cancellation token.
/// Replaced each time a new export starts; cleared when export completes.
pub struct ExportCancelState {
    pub token: std::sync::Mutex<Option<CancellationToken>>,
}

impl ExportCancelState {
    pub fn new() -> Self {
        Self { token: std::sync::Mutex::new(None) }
    }
}

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

/// Export an AuraDocument to a Markdown file at the given path.
/// Calls markdown_serializer::serialize and writes UTF-8 to disk.
/// Requirements: 6.3, 7.2, 7.3
#[tauri::command]
async fn export_markdown(path: String, document: AuraDocument) -> Result<(), IPCError> {
    let markdown = markdown_serializer::serialize(&document)?;
    tokio::fs::write(&path, markdown.as_bytes())
        .await
        .map_err(|e| IPCError {
            code: "FILE_WRITE_ERROR".to_string(),
            message: format!("Cannot write Markdown file '{}': {}", path, e),
        })
}

/// Export an AuraDocument to a DOCX file at the given path.
/// Calls docx_exporter::export (runs in spawn_blocking) and writes bytes to disk.
/// For large documents, emits `export-progress` events and supports cancellation.
/// Requirements: 6.3, 7.2, 7.3, 28.1, 28.2, 28.3, 28.4
#[tauri::command]
async fn export_docx(
    app: tauri::AppHandle,
    path: String,
    document: AuraDocument,
    cancel_state: tauri::State<'_, ExportCancelState>,
) -> Result<(), IPCError> {
    // Create a new cancellation token for this export
    let token = CancellationToken::new();
    {
        let mut guard = cancel_state.token.lock().unwrap();
        *guard = Some(token.clone());
    }

    let result = docx_exporter::export_with_progress(&document, app, token).await;

    // Clear the token after export completes (success or failure)
    {
        let mut guard = cancel_state.token.lock().unwrap();
        *guard = None;
    }

    let bytes = result?;

    // If cancelled before write, the error was already returned above.
    // Write the bytes to disk.
    tokio::fs::write(&path, &bytes)
        .await
        .map_err(|e| IPCError {
            code: "FILE_WRITE_ERROR".to_string(),
            message: format!("Cannot write DOCX file '{}': {}", path, e),
        })
}

/// Cancel the currently running DOCX export.
/// Sets the cancellation token; the export worker will stop within 50 blocks.
/// Requirements: 28.3, 28.4
#[tauri::command]
async fn cancel_export(
    cancel_state: tauri::State<'_, ExportCancelState>,
) -> Result<(), IPCError> {
    let guard = cancel_state.token.lock().unwrap();
    if let Some(token) = guard.as_ref() {
        token.cancel();
    }
    Ok(())
}

/// Import a file (.md or .docx) and return the parsed document with optional Aura_Tag.
/// Detects format from file extension.
/// Requirements: 8.1, 8.2, 8.3, 8.9
#[tauri::command]
async fn import_file(path: String) -> Result<models::ImportResult, IPCError> {
    use std::path::Path;

    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase());

    match ext.as_deref() {
        Some("md") => {
            let content = tokio::fs::read_to_string(&path)
                .await
                .map_err(|e| IPCError {
                    code: "FILE_READ_ERROR".to_string(),
                    message: format!("Cannot read Markdown file '{}': {}", path, e),
                })?;
            let (document, aura_intent_id) = markdown_serializer::parse(&content)?;
            Ok(models::ImportResult {
                document,
                aura_intent_id,
                warnings: vec![],
            })
        }
        Some("docx") => {
            let bytes = tokio::fs::read(&path)
                .await
                .map_err(|e| IPCError {
                    code: "FILE_READ_ERROR".to_string(),
                    message: format!("Cannot read DOCX file '{}': {}", path, e),
                })?;
            docx_exporter::import(&bytes).await
        }
        _ => Err(IPCError {
            code: "UNSUPPORTED_FORMAT".to_string(),
            message: format!(
                "Unsupported file format for '{}'. Only .md and .docx are supported.",
                path
            ),
        }),
    }
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

/// Open the AuraBrain storage directory in the system file manager.
/// Returns Err if the directory does not exist.
/// Requirements: 12.3, 12.4
#[tauri::command]
async fn reveal_in_file_manager(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), IPCError> {
    use std::path::Path;

    // Expand ~ to home directory
    let expanded = if path.starts_with("~/") {
        let home = app.path().home_dir().map_err(|_| IPCError {
            code: "PATH_ERROR".to_string(),
            message: "Cannot resolve home directory".to_string(),
        })?;
        home.join(&path[2..]).to_string_lossy().to_string()
    } else {
        path.clone()
    };

    let dir = Path::new(&expanded);
    if !dir.exists() {
        return Err(IPCError {
            code: "DIR_NOT_FOUND".to_string(),
            message: format!("Directory does not exist: {}", expanded),
        });
    }

    tauri_plugin_opener::open_path(expanded, None::<&str>)
        .map_err(|e| IPCError {
            code: "REVEAL_ERROR".to_string(),
            message: format!("Cannot open directory in file manager: {}", e),
        })
}

/// Return the AuraBrain storage directory path used by SqliteStore.
/// Requirements: file-save-management 12.1, 12.2, 19.4
#[tauri::command]
async fn get_aurabrain_storage_path(app: tauri::AppHandle) -> Result<String, IPCError> {
    let base = app.path().app_data_dir().map_err(|e| IPCError {
        code: "PATH_ERROR".to_string(),
        message: format!("Cannot resolve app data directory: {e}"),
    })?;
    Ok(base
        .join("WordAI")
        .join("AuraBrain")
        .to_string_lossy()
        .to_string())
}

// ── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            export_markdown,
            export_docx,
            import_file,
            reveal_in_file_manager,
            get_aurabrain_storage_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
