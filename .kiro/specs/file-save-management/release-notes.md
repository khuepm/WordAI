# Release Notes: File Save Management

## Primary Storage

AuraBrain SQLite is now the primary persistence layer for editor intents. `Cmd+S` / `Ctrl+S` syncs the active intent into AuraBrain and does not open a file save dialog.

## Export And Import

Markdown and DOCX are explicit legacy interchange formats. Exporting a file does not change AuraBrain dirty state. Importing Markdown/DOCX converts the file into an AuraBrain intent and syncs it locally.

## Storage Location

The app resolves the AuraBrain storage directory through the backend `get_aurabrain_storage_path` command. The path is shown in Preferences > About and in the editor status tooltip.

## Restore Behavior

On startup, the app restores `wordai_last_intent_id` first, falls back to the most recent AuraBrain intent, then creates a new in-memory unsynced intent when AuraBrain is empty. Legacy `wordai_last_document_path` is only used as a one-time migration path.

## Known Format Limits

Markdown round-trip is text/block oriented. DOCX import preserves supported text, headings, lists, inline marks, and Aura tags; unsupported DOCX elements such as tables, images, and comments are surfaced as warnings/placeholders rather than silently dropped.

## Verification Snapshot

- `npm test`: 28 files passed, 365 tests passed.
- `npm run build`: TypeScript and Vite production build passed.
- `cargo test`: 71 Rust tests passed.
- `npm run tauri -- build`: macOS `.app` and `.dmg` bundle build passed.
