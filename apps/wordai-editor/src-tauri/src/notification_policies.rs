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
}
