# Manual QA: File Save Management

Use this checklist against a built Tauri app when validating the release candidate.

## Core AuraBrain Sync

- Launch the app with a clean AuraBrain database.
- Confirm a new unsynced `Untitled Intent` opens without a file path prompt.
- Type a paragraph, a Markdown heading (`# Heading`), an unordered list item (`- Item`), an ordered list item (`1. Item`), and a fenced code block.
- Press `Cmd+S` / `Ctrl+S`.
- Confirm the title dirty indicator clears and the status bar reports a synced state.
- Type additional text.
- Confirm the title/status dirty indicator appears again.
- Wait for the configured auto-sync interval.
- Confirm the dirty indicator clears and the synced timestamp updates.

## Startup Restore

- Close and reopen the app.
- Confirm the last intent is restored from AuraBrain, not from a legacy file path.
- Confirm the restored intent starts clean.
- Simulate a missing `wordai_last_intent_id` by removing that localStorage key.
- Relaunch and confirm the most recent AuraBrain intent opens.
- Simulate an AuraBrain IPC failure for `list_intents`.
- Confirm the blocking startup error appears, the editor is not rendered, and Retry is available.

## Export

- Open Export from the top navigation.
- Confirm Markdown is preselected when `defaultExportFormat = markdown`.
- Export Markdown to a path without `.md`.
- Confirm the created file has `.md`, contains `aura_intent_id` frontmatter, and preserves visible text.
- Export DOCX to a path without `.docx`.
- Confirm the created file opens in Word-compatible tooling and preserves visible text.
- Confirm export does not clear or mutate AuraBrain dirty state.
- Cancel the save dialog and confirm no error is displayed.

## Import

- Import Markdown without an Aura tag.
- Confirm a new intent is created, opened, synced, and starts clean.
- Import DOCX without an Aura tag.
- Confirm a new intent is created, opened, synced, and warnings are displayed for unsupported elements.
- Import Markdown or DOCX with an existing `aura_intent_id`.
- Choose `Cập nhật Intent` and confirm the existing id is preserved.
- Repeat and choose `Tạo Intent mới`; confirm a new id is created.
- Cancel the conflict dialog and confirm no editor or AuraBrain state changes occur.

## Storage Path

- Open Preferences > About.
- Confirm AuraBrain Storage Location comes from `get_aurabrain_storage_path`.
- Click Reveal in Finder/Explorer/File Manager.
- Confirm the same AuraBrain directory opens.
- Temporarily make the path unavailable and confirm a clear error is shown.
