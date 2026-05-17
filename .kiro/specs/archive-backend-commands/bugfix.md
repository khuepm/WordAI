# Bugfix Requirements Document

## Introduction

The Archive Management feature's frontend (`ArchiveView.tsx`) calls 10 Tauri IPC commands via `invoke()` that have no corresponding implementation in the Rust backend. The `invoke_handler` in `lib.rs` does not register any archive-related commands, and no archive Rust module exists. This causes a runtime error "Command list_archived_intents not found" (and equivalent errors for all other archive commands) whenever the user navigates to the Archive tab.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the frontend invokes `list_archived_intents` via Tauri IPC THEN the system returns an error "Command list_archived_intents not found" because no such command is registered in the backend invoke_handler

1.2 WHEN the frontend invokes `get_archived_intent` via Tauri IPC THEN the system returns an error "Command get_archived_intent not found" because no such command is registered in the backend invoke_handler

1.3 WHEN the frontend invokes `archive_intent` via Tauri IPC THEN the system returns an error "Command archive_intent not found" because no such command is registered in the backend invoke_handler

1.4 WHEN the frontend invokes `restore_intent` via Tauri IPC THEN the system returns an error "Command restore_intent not found" because no such command is registered in the backend invoke_handler

1.5 WHEN the frontend invokes `delete_archived_intent` via Tauri IPC THEN the system returns an error "Command delete_archived_intent not found" because no such command is registered in the backend invoke_handler

1.6 WHEN the frontend invokes `update_memory_access` via Tauri IPC THEN the system returns an error "Command update_memory_access not found" because no such command is registered in the backend invoke_handler

1.7 WHEN the frontend invokes `get_archive_suggestions` via Tauri IPC THEN the system returns an error "Command get_archive_suggestions not found" because no such command is registered in the backend invoke_handler

1.8 WHEN the frontend invokes `generate_archive_summary` via Tauri IPC THEN the system returns an error "Command generate_archive_summary not found" because no such command is registered in the backend invoke_handler

1.9 WHEN the frontend invokes `list_paused_projects` via Tauri IPC THEN the system returns an error "Command list_paused_projects not found" because no such command is registered in the backend invoke_handler

1.10 WHEN the frontend invokes `get_project_documents` via Tauri IPC THEN the system returns an error "Command get_project_documents not found" because no such command is registered in the backend invoke_handler

### Expected Behavior (Correct)

2.1 WHEN the frontend invokes `list_archived_intents` with an optional category filter THEN the system SHALL return an array of archived intent summaries from the SQLite store, filtered by category if provided

2.2 WHEN the frontend invokes `get_archived_intent` with a valid id THEN the system SHALL return the full archived intent document including raw_content from the SQLite store

2.3 WHEN the frontend invokes `archive_intent` with an id and reason THEN the system SHALL move the active intent to the archived_intents table and return the archived summary

2.4 WHEN the frontend invokes `restore_intent` with a valid archived id THEN the system SHALL move the archived intent back to the active intents table and return the restored document

2.5 WHEN the frontend invokes `delete_archived_intent` with a valid id THEN the system SHALL permanently remove the archived intent from the SQLite store

2.6 WHEN the frontend invokes `update_memory_access` with an id and enabled boolean THEN the system SHALL update the memory_access_enabled field for the specified archived intent

2.7 WHEN the frontend invokes `get_archive_suggestions` with an active_doc_id THEN the system SHALL return an array of archive suggestions (potentially AI-powered) for the given document

2.8 WHEN the frontend invokes `generate_archive_summary` with an id THEN the system SHALL return a generated text summary for the specified archived intent

2.9 WHEN the frontend invokes `list_paused_projects` THEN the system SHALL return an array of all paused projects from the SQLite store

2.10 WHEN the frontend invokes `get_project_documents` with a project_id THEN the system SHALL return an array of archived intent summaries belonging to the specified project

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the frontend invokes `sync_intent` THEN the system SHALL CONTINUE TO upsert AuraDocuments into the SQLite store and return the new version number

3.2 WHEN the frontend invokes `get_intent` THEN the system SHALL CONTINUE TO retrieve a single AuraDocument by id from the SQLite store

3.3 WHEN the frontend invokes `list_intents` THEN the system SHALL CONTINUE TO return lightweight intent summaries without raw_content

3.4 WHEN the frontend invokes `save_document`, `load_document`, or `create_document` THEN the system SHALL CONTINUE TO perform file-based document operations correctly

3.5 WHEN the frontend invokes AI commands (`request_ai_suggestion`, `send_chat_message`, `check_ai_health`) THEN the system SHALL CONTINUE TO communicate with the AI service correctly

3.6 WHEN the frontend invokes export/import commands (`export_markdown`, `export_docx`, `import_file`, `cancel_export`, `cancel_import`) THEN the system SHALL CONTINUE TO handle file format conversions correctly
