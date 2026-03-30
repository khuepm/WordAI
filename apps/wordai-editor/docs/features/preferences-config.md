# Preferences Config System

## Tổng quan

Hệ thống preferences được lưu dưới dạng JSON, hỗ trợ 3 tính năng chính:

1. **Quick Search Popup** — tìm kiếm setting nhanh qua `Cmd+Shift+P` (giống VSCode)
2. **Restore Default** — reset toàn bộ hoặc từng nhóm setting về giá trị mặc định
3. **Per-account Storage** — mỗi tài khoản có preferences riêng, sync qua cloud

---

## Nơi lưu trữ

### Local (Tauri app data dir)

```
{app_data_dir}/
├── preferences/
│   ├── default.json          ← giá trị mặc định (readonly, bundled)
│   └── user_{userId}.json    ← preferences của từng user
```

`app_data_dir` trên macOS là:
```
~/Library/Application Support/com.wordai.editor/
```

Dùng Tauri API để resolve:
```rust
app.path().app_data_dir()
```

### Cloud (per-account sync)

Khi user đăng nhập, preferences được sync lên backend dưới key:
```
/users/{userId}/preferences
```

Thứ tự ưu tiên khi load: **cloud > local user file > default.json**

---

## Schema JSON

```json
{
  "$schema": "https://wordai.app/schemas/preferences/v1.json",
  "version": 1,
  "userId": "user_abc123",
  "updatedAt": "2026-03-30T10:00:00Z",

  "general": {
    "theme": "system",
    "autoSave": {
      "enabled": true,
      "intervalMinutes": 5
    },
    "focusMode": false,
    "language": "en-US"
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

---

## Searchable Setting Registry

Để hỗ trợ Quick Search, mỗi setting cần có metadata dạng flat list:

```ts
interface SettingEntry {
  id: string;           // "general.theme"
  label: string;        // "Interface Mode"
  description: string;  // "Adjust the visual appearance..."
  tab: Tab;             // "general" | "ai-engine" | "typography" | "privacy"
  keywords: string[];   // ["theme", "dark", "light", "appearance"]
  type: 'select' | 'toggle' | 'slider' | 'number' | 'radio';
  defaultValue: unknown;
}
```

Registry này được dùng bởi Quick Search popup để:
- Full-text search trên `label + description + keywords`
- Navigate thẳng đến tab + scroll đến setting khi chọn

---

## Tauri Commands cần thêm

```rust
// Load preferences cho user hiện tại
#[tauri::command]
fn load_preferences(app: AppHandle, user_id: String) -> Result<Preferences, IPCError>

// Lưu preferences (ghi local + trigger cloud sync)
#[tauri::command]
fn save_preferences(app: AppHandle, prefs: Preferences) -> Result<(), IPCError>

// Reset về default (toàn bộ hoặc theo group)
#[tauri::command]
fn reset_preferences(app: AppHandle, user_id: String, group: Option<String>) -> Result<Preferences, IPCError>
```

---

## File liên quan cần tạo/sửa

| File | Mô tả |
|------|-------|
| `src/types/preferences.ts` | TypeScript types cho toàn bộ schema |
| `src/services/preferencesService.ts` | Load/save/reset qua Tauri IPC |
| `src/components/QuickSettingsSearch.tsx` | Popup `Cmd+Shift+P` |
| `src-tauri/src/preferences_store.rs` | Rust backend: đọc/ghi file JSON |
| `src-tauri/src/lib.rs` | Đăng ký 3 commands mới |
| `public/preferences/default.json` | File default bundled với app |

---

## Luồng hoạt động

```
App khởi động
  └─ load_preferences(userId)
       ├─ Đọc local: app_data_dir/preferences/user_{id}.json
       ├─ Merge với default.json (fill missing keys)
       └─ (nếu online) Fetch cloud → override local → save local

User thay đổi setting
  └─ save_preferences(updatedPrefs)
       ├─ Ghi local ngay lập tức
       └─ Debounce 2s → sync lên cloud

User nhấn "Restore Default"
  └─ reset_preferences(userId, group?)
       ├─ group = undefined → reset toàn bộ
       ├─ group = "typography" → chỉ reset tab Typography
       └─ Trả về Preferences mới để UI re-render
```

---

## Quick Search — cách hoạt động

Trigger: `Cmd+Shift+P` (macOS) / `Ctrl+Shift+P` (Windows/Linux)

1. Popup mở, focus vào input
2. User gõ → filter `settingRegistry` theo `label + description + keywords`
3. Kết quả hiển thị dạng list với tab badge
4. Chọn một entry → đóng popup, mở PreferencesDialog đúng tab, scroll đến setting đó
5. `Escape` → đóng popup

```
┌─────────────────────────────────────────┐
│ 🔍  Search settings...          Esc     │
├─────────────────────────────────────────┤
│ [General]  Interface Mode               │
│            Adjust the visual appearance │
│                                         │
│ [AI Engine]  AI Creativity Level        │
│              Adjust the variance of...  │
│                                         │
│ [Typography]  Font Family               │
│               Editorial grade typefaces │
└─────────────────────────────────────────┘
```
