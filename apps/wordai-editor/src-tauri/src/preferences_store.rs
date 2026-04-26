/// Preferences Store — load, save, and reset user preferences
/// Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1, 8.2, 8.3, 8.4
use crate::models::IPCError;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Resolve the preferences directory inside the app data dir.
fn prefs_dir(app: &tauri::AppHandle) -> Result<PathBuf, IPCError> {
    let base = app.path().app_data_dir().map_err(|_| IPCError {
        code: "PATH_ERROR".to_string(),
        message: "Cannot resolve app data directory".to_string(),
    })?;
    Ok(base.join("preferences"))
}

/// Resolve the path to the bundled default.json resource.
fn default_json_path(app: &tauri::AppHandle) -> Result<PathBuf, IPCError> {
    let res_dir = app.path().resource_dir().map_err(|_| IPCError {
        code: "PATH_ERROR".to_string(),
        message: "Cannot resolve resource directory".to_string(),
    })?;
    Ok(res_dir.join("preferences").join("default.json"))
}

/// Read and parse default.json, returning an empty object if the file is absent.
fn read_default_json(app: &tauri::AppHandle) -> Result<Value, IPCError> {
    let mut path = default_json_path(app)?;
    #[cfg(debug_assertions)]
    if !path.exists() {
        let source_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("public")
            .join("preferences")
            .join("default.json");
        if source_path.exists() {
            path = source_path;
        }
    }

    if !path.exists() {
        // Req 8.4: log warning and fall back to empty object
        eprintln!(
            "[preferences_store] WARNING: default.json not found at {:?}; using empty defaults",
            path
        );
        return Ok(Value::Object(serde_json::Map::new()));
    }
    let raw = fs::read_to_string(&path).map_err(|e| IPCError {
        code: "FILE_IO_ERROR".to_string(),
        message: format!("Failed to read default.json: {}", e),
    })?;
    serde_json::from_str(&raw).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Failed to parse default.json: {}", e),
    })
}

/// Deep-merge `defaults` into `user_prefs`: for every key present in `defaults`
/// but absent in `user_prefs`, copy the value from `defaults`.
/// Recurses into nested objects.
/// Req 8.2
pub fn merge_with_defaults(user_prefs: &mut Value, defaults: &Value) {
    if let (Some(user_map), Some(default_map)) = (user_prefs.as_object_mut(), defaults.as_object())
    {
        for (key, default_val) in default_map {
            let entry = user_map
                .entry(key.clone())
                .or_insert_with(|| default_val.clone());
            // Recurse if both sides are objects
            if entry.is_object() && default_val.is_object() {
                merge_with_defaults(entry, default_val);
            }
        }
    }
}

// ── Core logic (pure, no AppHandle) ──────────────────────────────────────────

/// Validate that user_id contains only safe characters to prevent path traversal.
/// Allows alphanumerics, underscores, and hyphens only.
fn validate_user_id(user_id: &str) -> Result<(), IPCError> {
    if user_id.is_empty()
        || !user_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    {
        return Err(IPCError {
            code: "INVALID_USER_ID".to_string(),
            message: format!(
                "Invalid user_id '{}': only alphanumerics, underscores, and hyphens are allowed",
                user_id
            ),
        });
    }
    Ok(())
}

/// Read user preferences from `user_{user_id}.json`.
/// Returns merged result with defaults for any missing keys.
/// Req 7.1, 7.2
fn load_preferences_inner(
    prefs_dir: &PathBuf,
    defaults: &Value,
    user_id: &str,
) -> Result<Value, IPCError> {
    let user_file = prefs_dir.join(format!("user_{}.json", user_id));

    if !user_file.exists() {
        // Req 7.2: file absent → return defaults
        return Ok(defaults.clone());
    }

    let raw = fs::read_to_string(&user_file).map_err(|e| IPCError {
        code: "FILE_IO_ERROR".to_string(),
        message: format!("Failed to read preferences for user '{}': {}", user_id, e),
    })?;

    let mut user_prefs: Value = serde_json::from_str(&raw).map_err(|e| IPCError {
        code: "DESERIALIZE_ERROR".to_string(),
        message: format!("Failed to parse preferences for user '{}': {}", user_id, e),
    })?;

    // Fill missing keys from defaults
    merge_with_defaults(&mut user_prefs, defaults);
    Ok(user_prefs)
}

/// Write preferences to `user_{user_id}.json`, creating the directory if needed.
/// Req 7.3
fn save_preferences_inner(
    prefs_dir: &PathBuf,
    user_id: &str,
    preferences: &Value,
) -> Result<(), IPCError> {
    fs::create_dir_all(prefs_dir).map_err(|e| IPCError {
        code: "FILE_IO_ERROR".to_string(),
        message: format!("Failed to create preferences directory: {}", e),
    })?;

    let user_file = prefs_dir.join(format!("user_{}.json", user_id));
    let json = serde_json::to_string_pretty(preferences).map_err(|e| IPCError {
        code: "SERIALIZE_ERROR".to_string(),
        message: format!("Failed to serialize preferences: {}", e),
    })?;

    fs::write(&user_file, json).map_err(|e| IPCError {
        code: "FILE_IO_ERROR".to_string(),
        message: format!("Failed to write preferences for user '{}': {}", user_id, e),
    })
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Load preferences for the given user, merging with defaults for missing keys.
/// Req 7.1, 7.2
#[tauri::command]
pub fn load_preferences(app: tauri::AppHandle, user_id: String) -> Result<Value, IPCError> {
    validate_user_id(&user_id)?;
    let dir = prefs_dir(&app)?;
    let defaults = read_default_json(&app)?;
    load_preferences_inner(&dir, &defaults, &user_id)
}

/// Persist preferences for the given user.
/// Req 7.3
#[tauri::command]
pub fn save_preferences(
    app: tauri::AppHandle,
    user_id: String,
    preferences: Value,
) -> Result<(), IPCError> {
    validate_user_id(&user_id)?;
    let dir = prefs_dir(&app)?;
    save_preferences_inner(&dir, &user_id, &preferences)
}

/// Reset preferences to defaults.
/// If `group` is Some, only that top-level key is reset; otherwise the entire
/// user file is removed and defaults are returned.
/// Req 7.4, 7.5, 7.6
#[tauri::command]
pub fn reset_preferences(
    app: tauri::AppHandle,
    user_id: String,
    group: Option<String>,
) -> Result<Value, IPCError> {
    validate_user_id(&user_id)?;
    let dir = prefs_dir(&app)?;
    let defaults = read_default_json(&app)?;

    match group {
        Some(g) => {
            // Req 7.5: reset only the specified group
            let mut current = load_preferences_inner(&dir, &defaults, &user_id)?;
            if let Some(default_group) = defaults.get(&g) {
                if let Some(obj) = current.as_object_mut() {
                    obj.insert(g, default_group.clone());
                }
            }
            save_preferences_inner(&dir, &user_id, &current)?;
            Ok(current)
        }
        None => {
            // Req 7.6: delete user file and return defaults
            let user_file = dir.join(format!("user_{}.json", user_id));
            if user_file.exists() {
                fs::remove_file(&user_file).map_err(|e| IPCError {
                    code: "FILE_IO_ERROR".to_string(),
                    message: format!("Failed to delete preferences for user '{}': {}", user_id, e),
                })?;
            }
            Ok(defaults)
        }
    }
}

// ── Unit Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::fs;
    use tempfile::TempDir;

    fn temp_dir() -> TempDir {
        tempfile::tempdir().expect("failed to create temp dir")
    }

    // ── merge_with_defaults ───────────────────────────────────────────────────

    #[test]
    fn merge_fills_missing_top_level_keys() {
        let mut user = json!({ "general": { "theme": "dark" } });
        let defaults = json!({
            "general": { "theme": "system", "focusMode": false },
            "privacy": { "analyticsEnabled": false }
        });
        merge_with_defaults(&mut user, &defaults);

        // Existing key preserved
        assert_eq!(user["general"]["theme"], "dark");
        // Missing nested key filled
        assert_eq!(user["general"]["focusMode"], false);
        // Missing top-level group filled
        assert_eq!(user["privacy"]["analyticsEnabled"], false);
    }

    #[test]
    fn merge_does_not_overwrite_existing_values() {
        let mut user = json!({ "general": { "theme": "dark", "focusMode": true } });
        let defaults = json!({ "general": { "theme": "system", "focusMode": false } });
        merge_with_defaults(&mut user, &defaults);

        assert_eq!(user["general"]["theme"], "dark");
        assert_eq!(user["general"]["focusMode"], true);
    }

    #[test]
    fn merge_handles_empty_user_prefs() {
        let mut user = json!({});
        let defaults = json!({ "general": { "theme": "system" } });
        merge_with_defaults(&mut user, &defaults);

        assert_eq!(user["general"]["theme"], "system");
    }

    #[test]
    fn merge_handles_non_object_values() {
        // Should not panic when values are not objects
        let mut user = json!({ "count": 1 });
        let defaults = json!({ "count": 5, "extra": "hello" });
        merge_with_defaults(&mut user, &defaults);

        // Existing scalar preserved
        assert_eq!(user["count"], 1);
        // Missing scalar filled
        assert_eq!(user["extra"], "hello");
    }

    // ── load_preferences_inner ────────────────────────────────────────────────

    #[test]
    fn load_returns_defaults_when_file_missing() {
        let dir = temp_dir();
        let prefs_path = dir.path().to_path_buf();
        let defaults = json!({ "general": { "theme": "system" } });

        let result = load_preferences_inner(&prefs_path, &defaults, "user123").unwrap();
        assert_eq!(result, defaults);
    }

    #[test]
    fn load_merges_user_file_with_defaults() {
        let dir = temp_dir();
        let prefs_path = dir.path().to_path_buf();
        fs::create_dir_all(&prefs_path).unwrap();

        let user_data = json!({ "general": { "theme": "dark" } });
        fs::write(
            prefs_path.join("user_abc.json"),
            serde_json::to_string(&user_data).unwrap(),
        )
        .unwrap();

        let defaults = json!({
            "general": { "theme": "system", "focusMode": false },
            "privacy": { "analyticsEnabled": false }
        });

        let result = load_preferences_inner(&prefs_path, &defaults, "abc").unwrap();
        assert_eq!(result["general"]["theme"], "dark");
        assert_eq!(result["general"]["focusMode"], false);
        assert_eq!(result["privacy"]["analyticsEnabled"], false);
    }

    // ── save_preferences_inner ────────────────────────────────────────────────

    #[test]
    fn save_creates_directory_and_file() {
        let dir = temp_dir();
        let prefs_path = dir.path().join("nested").join("prefs");
        let prefs = json!({ "general": { "theme": "dark" } });

        save_preferences_inner(&prefs_path, "user1", &prefs).unwrap();

        let written = fs::read_to_string(prefs_path.join("user_user1.json")).unwrap();
        let parsed: Value = serde_json::from_str(&written).unwrap();
        assert_eq!(parsed["general"]["theme"], "dark");
    }

    #[test]
    fn save_then_load_round_trips() {
        let dir = temp_dir();
        let prefs_path = dir.path().to_path_buf();
        let prefs =
            json!({ "general": { "theme": "light" }, "privacy": { "analyticsEnabled": true } });

        save_preferences_inner(&prefs_path, "roundtrip", &prefs).unwrap();
        let defaults = json!({});
        let loaded = load_preferences_inner(&prefs_path, &defaults, "roundtrip").unwrap();

        assert_eq!(loaded["general"]["theme"], "light");
        assert_eq!(loaded["privacy"]["analyticsEnabled"], true);
    }

    // ── reset logic (pure) ────────────────────────────────────────────────────

    #[test]
    fn reset_group_replaces_only_that_group() {
        let dir = temp_dir();
        let prefs_path = dir.path().to_path_buf();

        let user_prefs = json!({
            "general": { "theme": "dark" },
            "privacy": { "analyticsEnabled": true }
        });
        save_preferences_inner(&prefs_path, "u1", &user_prefs).unwrap();

        let defaults = json!({
            "general": { "theme": "system", "focusMode": false },
            "privacy": { "analyticsEnabled": false }
        });

        // Simulate reset of "privacy" group
        let mut current = load_preferences_inner(&prefs_path, &defaults, "u1").unwrap();
        if let Some(default_group) = defaults.get("privacy") {
            if let Some(obj) = current.as_object_mut() {
                obj.insert("privacy".to_string(), default_group.clone());
            }
        }
        save_preferences_inner(&prefs_path, "u1", &current).unwrap();

        let reloaded = load_preferences_inner(&prefs_path, &defaults, "u1").unwrap();
        // privacy reset to default
        assert_eq!(reloaded["privacy"]["analyticsEnabled"], false);
        // general untouched
        assert_eq!(reloaded["general"]["theme"], "dark");
    }

    #[test]
    fn reset_all_removes_user_file_and_returns_defaults() {
        let dir = temp_dir();
        let prefs_path = dir.path().to_path_buf();

        let user_prefs = json!({ "general": { "theme": "dark" } });
        save_preferences_inner(&prefs_path, "u2", &user_prefs).unwrap();

        let user_file = prefs_path.join("user_u2.json");
        assert!(user_file.exists());

        // Simulate full reset
        fs::remove_file(&user_file).unwrap();
        assert!(!user_file.exists());

        let defaults = json!({ "general": { "theme": "system" } });
        let result = load_preferences_inner(&prefs_path, &defaults, "u2").unwrap();
        assert_eq!(result["general"]["theme"], "system");
    }
}
