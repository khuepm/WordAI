pub mod ai_service;
pub mod docx_exporter;
pub mod document_store;
pub mod file_manager;
pub mod markdown_serializer;
pub mod models;
pub mod notification_policies;
pub mod pdf_export;
pub mod preferences_store;
pub mod sqlite_store;

use models::{
    AISuggestion, ArchiveSuggestion, ArchivedIntentDocument, ArchivedIntentSummary,
    AuraDocument, CancellationToken, Document, DocumentBlock, DocumentSnapshot,
    IntentSummary, IPCError, PausedProject,
};
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

// ── Import Cancellation State ─────────────────────────────────────────────────
// Requirements: 26.4, 26.5

/// Managed state holding the current import cancellation token.
/// Replaced each time a new import starts; cleared when import completes.
pub struct ImportCancelState {
    pub token: std::sync::Mutex<Option<CancellationToken>>,
}

impl ImportCancelState {
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
/// Uses a temp file strategy: writes to `path.tmp` first, then renames atomically.
/// If cancelled during write, the temp file is deleted — no invalid file is left behind.
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

    let token_for_write = token.clone();
    let result = docx_exporter::export_with_progress(&document, app, token).await;

    // Clear the token after export completes (success or failure)
    {
        let mut guard = cancel_state.token.lock().unwrap();
        *guard = None;
    }

    let bytes = result?;

    // Write to a temp file first, then rename atomically.
    // This ensures no invalid/partial DOCX is left at the target path.
    // Requirements: 28.4
    let temp_path = format!("{}.tmp", &path);

    // Check cancellation before writing — user may have cancelled after build completed
    if token_for_write.is_cancelled() {
        return Err(IPCError {
            code: "EXPORT_CANCELLED".to_string(),
            message: "Export was cancelled by the user".to_string(),
        });
    }

    // Write bytes to temp file
    if let Err(e) = tokio::fs::write(&temp_path, &bytes).await {
        // Clean up temp file on write error
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(IPCError {
            code: "FILE_WRITE_ERROR".to_string(),
            message: format!("Cannot write DOCX file '{}': {}", path, e),
        });
    }

    // Check cancellation again after write — delete temp file if cancelled
    // Requirements: 28.4
    if token_for_write.is_cancelled() {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return Err(IPCError {
            code: "EXPORT_CANCELLED".to_string(),
            message: "Export was cancelled by the user".to_string(),
        });
    }

    // Rename temp file to final path (atomic on most filesystems)
    tokio::fs::rename(&temp_path, &path)
        .await
        .map_err(|e| {
            // Clean up temp file if rename fails
            let temp_path_clone = temp_path.clone();
            tokio::spawn(async move {
                let _ = tokio::fs::remove_file(&temp_path_clone).await;
            });
            IPCError {
                code: "FILE_WRITE_ERROR".to_string(),
                message: format!("Cannot finalize DOCX file '{}': {}", path, e),
            }
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

/// Cancel the currently running file import.
/// Sets the cancellation token; the import worker will stop within 50 blocks.
/// Requirements: 26.4, 26.5
#[tauri::command]
async fn cancel_import(
    cancel_state: tauri::State<'_, ImportCancelState>,
) -> Result<(), IPCError> {
    let guard = cancel_state.token.lock().unwrap();
    if let Some(token) = guard.as_ref() {
        token.cancel();
    }
    Ok(())
}

/// Import a file (.md or .docx) and return the parsed document with optional Aura_Tag.
/// Detects format from file extension.
/// For .docx files, creates a cancellation token and emits import-progress events.
/// Requirements: 8.1, 8.2, 8.3, 8.9, 26.4, 27.4
#[tauri::command]
async fn import_file(
    app: tauri::AppHandle,
    path: String,
    cancel_state: tauri::State<'_, ImportCancelState>,
) -> Result<models::ImportResult, IPCError> {
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

            // Create a new cancellation token for this import
            let token = CancellationToken::new();
            {
                let mut guard = cancel_state.token.lock().unwrap();
                *guard = Some(token.clone());
            }

            let result = docx_exporter::import_with_progress(&bytes, app, token).await;

            // Clear the token after import completes (success or failure)
            {
                let mut guard = cancel_state.token.lock().unwrap();
                *guard = None;
            }

            result
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

/// Return the file size in bytes using metadata (does not read file content).
/// Requirements: 25.1, 25.7
#[tauri::command]
async fn get_file_size(path: String) -> Result<u64, IPCError> {
    let metadata = std::fs::metadata(&path).map_err(|e| IPCError {
        code: "FILE_METADATA_ERROR".to_string(),
        message: format!("Cannot read file metadata for '{}': {}", path, e),
    })?;
    Ok(metadata.len())
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

// ── Archive IPC Commands ──────────────────────────────────────────────────────

/// List all archived intents, optionally filtered by category (archive_type).
/// Requirements: 2.1
#[tauri::command]
async fn list_archived_intents(
    category: Option<String>,
    state: tauri::State<'_, SqliteStore>,
) -> Result<Vec<ArchivedIntentSummary>, IPCError> {
    state.list_archived_intents(category.as_deref())
}

/// Retrieve a single archived intent by id (includes full content).
/// Requirements: 2.2
#[tauri::command]
async fn get_archived_intent(
    id: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<Option<ArchivedIntentDocument>, IPCError> {
    state.get_archived_intent(&id)
}

/// Archive an active intent by moving it from intents to archived_intents.
/// Requirements: 2.3
#[tauri::command]
async fn archive_intent(
    id: String,
    reason: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<ArchivedIntentSummary, IPCError> {
    state.archive_intent(&id, &reason)
}

/// Restore an archived intent back to the active intents table.
/// Requirements: 2.4
#[tauri::command]
async fn restore_intent(
    id: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<AuraDocument, IPCError> {
    state.restore_intent(&id)
}

/// Permanently delete an archived intent.
/// Requirements: 2.5
#[tauri::command]
async fn delete_archived_intent(
    id: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<(), IPCError> {
    state.delete_archived_intent(&id)
}

/// Toggle memory access for an archived intent.
/// Requirements: 2.6
#[tauri::command]
async fn update_memory_access(
    id: String,
    enabled: bool,
    state: tauri::State<'_, SqliteStore>,
) -> Result<(), IPCError> {
    state.update_memory_access(&id, enabled)
}

/// Get AI-powered archive suggestions for an active document.
/// Retrieves the document content from the store, then calls the AI service.
/// Requirements: 2.7
#[tauri::command]
async fn get_archive_suggestions(
    active_doc_id: String,
    api_key: String,
    endpoint: Option<String>,
    state: tauri::State<'_, SqliteStore>,
) -> Result<Vec<ArchiveSuggestion>, IPCError> {
    // Get the document content to use as context for the AI
    let doc = state.get_intent(&active_doc_id)?;
    let doc = doc.ok_or_else(|| IPCError {
        code: "NOT_FOUND".to_string(),
        message: format!("Document '{}' not found", active_doc_id),
    })?;

    // Build context string from document blocks
    let context: String = doc
        .content
        .iter()
        .map(|block| extract_block_text(block))
        .collect::<Vec<_>>()
        .join("\n");

    let connector = ai_service::AIServiceConnector::new(api_key, endpoint);
    connector.get_archive_suggestions(&context).await
}

/// Generate an AI-powered summary for an archived document.
/// Retrieves the archived content from the store, then calls the AI service.
/// Requirements: 2.8
#[tauri::command]
async fn generate_archive_summary(
    id: String,
    api_key: String,
    endpoint: Option<String>,
    state: tauri::State<'_, SqliteStore>,
) -> Result<String, IPCError> {
    // Get the archived document content
    let doc = state.get_archived_intent(&id)?;
    let doc = doc.ok_or_else(|| IPCError {
        code: "NOT_FOUND".to_string(),
        message: format!("Archived document '{}' not found", id),
    })?;

    // Build content string from document blocks
    let content: String = doc
        .content
        .iter()
        .map(|block| extract_block_text(block))
        .collect::<Vec<_>>()
        .join("\n");

    let connector = ai_service::AIServiceConnector::new(api_key, endpoint);
    connector.generate_archive_summary(&content).await
}

/// List all paused projects with their document counts.
/// Requirements: 2.9
#[tauri::command]
async fn list_paused_projects(
    state: tauri::State<'_, SqliteStore>,
) -> Result<Vec<PausedProject>, IPCError> {
    state.list_paused_projects()
}

/// Get all archived documents belonging to a specific project.
/// Requirements: 2.10
#[tauri::command]
async fn get_project_documents(
    project_id: String,
    state: tauri::State<'_, SqliteStore>,
) -> Result<Vec<ArchivedIntentSummary>, IPCError> {
    state.get_project_documents(&project_id)
}

/// Extract text content from a DocumentBlock for building AI context strings.
fn extract_block_text(block: &DocumentBlock) -> String {
    match block {
        DocumentBlock::Paragraph { text, .. } => text.clone(),
        DocumentBlock::Heading { text, .. } => text.clone(),
        DocumentBlock::ListItem { text, .. } => text.clone(),
        DocumentBlock::CodeBlock { code, .. } => code.clone(),
        DocumentBlock::Placeholder(p) => p.display_hint.clone(),
    }
}

// ── App Entry Point ───────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .setup(|app| {
            let store = SqliteStore::new(app.handle()).map_err(|e| {
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("Failed to initialize AuraBrain SQLite store: {}", e.message),
                )) as Box<dyn std::error::Error>
            })?;
            app.manage(store);
            app.manage(ExportCancelState::new());
            app.manage(ImportCancelState::new());
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
            notification_policies::load_notification_policies,
            notification_policies::save_notification_policies,
            sync_intent,
            get_intent,
            list_intents,
            export_markdown,
            export_docx,
            cancel_export,
            import_file,
            cancel_import,
            reveal_in_file_manager,
            get_aurabrain_storage_path,
            get_file_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
