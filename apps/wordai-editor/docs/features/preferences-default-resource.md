# Preferences Default Resource

## Purpose

`public/preferences/default.json` is the canonical bundled default preference file for the Tauri backend. The backend reads it through `app.path().resource_dir()` and uses it when loading or resetting preferences.

The file is used for:

- First run, when `user_{userId}.json` does not exist.
- Schema migration, by filling missing keys from defaults without overwriting existing user values.
- Restore Default, either for all preferences or for one top-level preference group.

## Source and Bundled Path

Source file:

```text
apps/wordai-editor/public/preferences/default.json
```

Tauri bundle mapping:

```json
{
  "bundle": {
    "resources": {
      "../public/preferences/default.json": "preferences/default.json"
    }
  }
}
```

Runtime path resolved by Rust:

```rust
app.path().resource_dir()?.join("preferences").join("default.json")
```

On macOS app bundles this resolves inside:

```text
wordai-editor.app/Contents/Resources/preferences/default.json
```

In debug development builds, `preferences_store.rs` falls back to the source file if the bundled resource is not present yet. Release and packaged builds should use the bundled resource path.

## User Preference Files

User-specific preferences are stored separately under the app data directory:

```text
{app_data_dir}/preferences/user_{userId}.json
```

The bundled `default.json` is read-only app data. User changes are written only to `user_{userId}.json`.

## Update Checklist

When adding or renaming a preference:

1. Update `src/types/preferences.ts`.
2. Update `public/preferences/default.json`.
3. Update `src/data/settingRegistry.ts` if the preference should be searchable.
4. Update this document's full default JSON below.
5. Run `pnpm test`, `pnpm build`, and a Tauri app build.

## Full Default Preferences

```json
{
  "general": {
    "theme": "system",
    "autoSave": {
      "enabled": true,
      "intervalMinutes": 5
    },
    "focusMode": false,
    "language": "en-US",
    "defaultExportPath": "",
    "defaultExportFormat": "markdown",
    "autoSyncEnabled": true,
    "autoSyncInterval": 30
  },
  "aiEngine": {
    "agent": "claude",
    "model": "aura-turbo",
    "creativity": 75,
    "contextWindowTokens": 16000,
    "responseLanguage": "auto",
    "webAccess": true
  },
  "typography": {
    "fontFamily": "inter",
    "fontSize": "medium",
    "lineSpacing": "1.15",
    "smartQuotes": true,
    "autoCapitalize": false,
    "ligatures": true
  },
  "privacy": {
    "allowAITraining": false,
    "analyticsEnabled": false,
    "crashReports": true,
    "localProcessingOnly": false
  }
}
```
