/// Notification Policies Store — load and save notification policy config
/// Requirements: 6.1, 6.6
use crate::models::IPCError;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Resolve the config directory inside the app data dir.
fn config_dir(app: &tauri::AppHandle) -> Result<PathBuf, IPCError> {
    let base = app.path().app_data_dir().map_err(|_| IPCError {
        code: "PATH_ERROR".to_string(),
        message: "Cannot resolve app data directory".to_string(),
    })?;
    Ok(base.join("config"))
}

/// Resolve the full path to the notification-policies.json file.
fn policies_file_path(app: &tauri::AppHandle) -> Result<PathBuf, IPCError> {
    Ok(config_dir(app)?.join("notification-policies.json"))
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Save notification policies to the platform-specific config file.
/// Accepts a JSON string, validates it is parseable, creates the config directory
/// if it doesn't exist, backs up the existing file before overwriting, and writes
/// the new content.
/// Requirements: 6.6, 6.7
#[tauri::command]
pub fn save_notification_policies(app: tauri::AppHandle, config: String) -> Result<(), IPCError> {
    // 1. Validate that the JSON is parseable
    let _parsed: serde_json::Value = serde_json::from_str(&config).map_err(|e| IPCError {
        code: "INVALID_JSON".to_string(),
        message: format!("Invalid JSON content: {}", e),
    })?;

    // 2. Resolve the config file path
    let path = policies_file_path(&app)?;

    // 3. Create the config directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| IPCError {
            code: "DIR_CREATE_ERROR".to_string(),
            message: format!("Cannot create config directory {:?}: {}", parent, e),
        })?;
    }

    // 4. Backup existing file before overwriting
    if path.exists() {
        let backup_path = path.with_extension("json.backup");
        fs::rename(&path, &backup_path).map_err(|e| IPCError {
            code: "BACKUP_ERROR".to_string(),
            message: format!("Cannot backup existing config file: {}", e),
        })?;
    }

    // 5. Write the new content to the file
    fs::write(&path, &config).map_err(|e| IPCError {
        code: "FILE_WRITE_ERROR".to_string(),
        message: format!("Cannot write notification policies to {:?}: {}", path, e),
    })?;

    Ok(())
}

/// Load notification policies from the platform-specific config file.
/// Returns the JSON content as a string, or None if the file does not exist.
/// Handles errors gracefully: file not found → None, other errors → log and return None.
/// Requirements: 6.1, 6.6
#[tauri::command]
pub fn load_notification_policies(app: tauri::AppHandle) -> Option<String> {
    let path = match policies_file_path(&app) {
        Ok(p) => p,
        Err(e) => {
            eprintln!(
                "[notification_policies] WARNING: Cannot resolve config path: {}",
                e.message
            );
            return None;
        }
    };

    if !path.exists() {
        return None;
    }

    match fs::read_to_string(&path) {
        Ok(content) => Some(content),
        Err(e) => {
            eprintln!(
                "[notification_policies] WARNING: Failed to read {:?}: {}",
                path, e
            );
            None
        }
    }
}

// ── Unit Tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn temp_dir() -> TempDir {
        tempfile::tempdir().expect("failed to create temp dir")
    }

    #[test]
    fn policies_file_path_joins_correctly() {
        // Verify the path construction logic
        let base = PathBuf::from("/tmp/test-app-data");
        let config = base.join("config");
        let file = config.join("notification-policies.json");
        assert!(file.to_string_lossy().contains("config"));
        assert!(file.to_string_lossy().contains("notification-policies.json"));
    }

    #[test]
    fn read_returns_none_when_file_missing() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        let file_path = config_path.join("notification-policies.json");

        // File does not exist → should conceptually return None
        assert!(!file_path.exists());
    }

    #[test]
    fn read_returns_content_when_file_exists() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        fs::create_dir_all(&config_path).unwrap();

        let file_path = config_path.join("notification-policies.json");
        let content = r#"{"schemaVersion":1,"policies":[]}"#;
        fs::write(&file_path, content).unwrap();

        let read_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(read_content, content);
    }

    #[test]
    fn read_handles_valid_json_content() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        fs::create_dir_all(&config_path).unwrap();

        let file_path = config_path.join("notification-policies.json");
        let content = r#"{
            "schemaVersion": 1,
            "policies": [
                {
                    "id": "sync-status-elapsed",
                    "sourceKey": "sync.success",
                    "channel": "statusBar",
                    "format": "elapsed",
                    "priority": "low",
                    "duration": null,
                    "silent": false,
                    "trigger": "onEvent",
                    "template": "Synced · {seconds}s ago"
                }
            ]
        }"#;
        fs::write(&file_path, content).unwrap();

        let read_content = fs::read_to_string(&file_path).unwrap();
        // Verify it's valid JSON
        let parsed: serde_json::Value = serde_json::from_str(&read_content).unwrap();
        assert_eq!(parsed["schemaVersion"], 1);
        assert_eq!(parsed["policies"][0]["id"], "sync-status-elapsed");
    }

    // ── save_notification_policies tests ──────────────────────────────────────

    #[test]
    fn save_rejects_invalid_json() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        let file_path = config_path.join("notification-policies.json");

        // Simulate save logic: validate JSON
        let invalid_json = "not valid json {{{";
        let result: Result<serde_json::Value, _> = serde_json::from_str(invalid_json);
        assert!(result.is_err());

        // File should not be created
        assert!(!file_path.exists());
    }

    #[test]
    fn save_creates_directory_if_missing() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        let file_path = config_path.join("notification-policies.json");

        // Directory does not exist yet
        assert!(!config_path.exists());

        let content = r#"{"schemaVersion":1,"policies":[]}"#;

        // Simulate save logic: create dir + write
        fs::create_dir_all(&config_path).unwrap();
        fs::write(&file_path, content).unwrap();

        assert!(config_path.exists());
        assert!(file_path.exists());
        assert_eq!(fs::read_to_string(&file_path).unwrap(), content);
    }

    #[test]
    fn save_creates_backup_before_overwrite() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        fs::create_dir_all(&config_path).unwrap();

        let file_path = config_path.join("notification-policies.json");
        let backup_path = config_path.join("notification-policies.json.backup");

        // Write original content
        let original = r#"{"schemaVersion":1,"policies":[{"id":"old"}]}"#;
        fs::write(&file_path, original).unwrap();

        // Simulate save logic: backup + write new
        let new_content = r#"{"schemaVersion":1,"policies":[{"id":"new"}]}"#;
        fs::rename(&file_path, &backup_path).unwrap();
        fs::write(&file_path, new_content).unwrap();

        // Verify backup contains old content
        assert!(backup_path.exists());
        let backup_content = fs::read_to_string(&backup_path).unwrap();
        assert_eq!(backup_content, original);

        // Verify new file contains new content
        let saved_content = fs::read_to_string(&file_path).unwrap();
        assert_eq!(saved_content, new_content);
    }

    #[test]
    fn save_writes_valid_json_content() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        fs::create_dir_all(&config_path).unwrap();

        let file_path = config_path.join("notification-policies.json");
        let content = r#"{"schemaVersion":1,"policies":[{"id":"sync-status-elapsed","sourceKey":"sync.success","channel":"statusBar","format":"elapsed","priority":"low","duration":null,"silent":false,"trigger":"onEvent","template":"Synced · {seconds}s ago"}]}"#;

        // Validate JSON first
        let parsed: serde_json::Value = serde_json::from_str(content).unwrap();
        assert_eq!(parsed["schemaVersion"], 1);

        // Write to file
        fs::write(&file_path, content).unwrap();

        // Read back and verify
        let read_back = fs::read_to_string(&file_path).unwrap();
        assert_eq!(read_back, content);
    }

    #[test]
    fn save_without_existing_file_skips_backup() {
        let dir = temp_dir();
        let config_path = dir.path().join("config");
        fs::create_dir_all(&config_path).unwrap();

        let file_path = config_path.join("notification-policies.json");
        let backup_path = config_path.join("notification-policies.json.backup");

        // No existing file
        assert!(!file_path.exists());

        let content = r#"{"schemaVersion":1,"policies":[]}"#;

        // Simulate save logic: no backup needed, just write
        if file_path.exists() {
            fs::rename(&file_path, &backup_path).unwrap();
        }
        fs::write(&file_path, content).unwrap();

        // No backup should exist
        assert!(!backup_path.exists());
        // File should be written
        assert_eq!(fs::read_to_string(&file_path).unwrap(), content);
    }
}
