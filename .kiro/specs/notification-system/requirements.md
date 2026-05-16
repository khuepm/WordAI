# Requirements Document: Config-First Notification System

## Introduction

WordAI áp dụng triết lý **Config-First** — mọi hành vi của ứng dụng đều có thể cấu hình thông qua file config, không hardcode. Hệ thống Notification là lớp trung gian kết nối **Preferences** (nguồn dữ liệu) với **UI Channels** (nơi hiển thị), thông qua **Notification Policies** (quy tắc routing).

Mỗi preference có thể có **nhiều notification policies đồng thời** — ví dụ `autoSyncInterval` vừa hiển thị countdown trên status bar, vừa toast khi giá trị thay đổi. Policies được lưu trong file config riêng biệt, có thể override tại runtime qua Dev Dashboard (chỉ hiển thị trong môi trường dev).

Hệ thống này áp dụng cho **tất cả preferences** trong ứng dụng (general, ai-engine, typography, privacy), không giới hạn ở sync/export.

---

## Glossary

- **Notification_Policy**: Quy tắc định nghĩa cách một preference hoặc system event thông báo tới người dùng. Mỗi preference có thể có 0..N policies.
- **Notification_Channel**: Kênh hiển thị thông báo — nơi notification được render. Ví dụ: `statusBar`, `toast`, `titleBar`, `badge`, `none`.
- **Notification_Format**: Kiểu hiển thị nội dung — `countdown`, `elapsed`, `message`, `indicator`, `progress`.
- **Notification_Event**: Sự kiện kích hoạt notification — có thể là preference thay đổi, system event (sync error, export success), hoặc periodic timer.
- **Policy_Config_File**: File JSON chứa tất cả notification policies, lưu tại `~/.config/WordAI/notification-policies.json` (dev) hoặc bundled default.
- **Dev_Dashboard**: Giao diện ẩn chỉ hiển thị trong môi trường development (`import.meta.env.DEV`), cho phép xem/chỉnh sửa policies, xem notification log, và simulate events.
- **Channel_Renderer**: Component React chịu trách nhiệm render notifications cho một channel cụ thể.
- **Notification_Dispatcher**: Service trung tâm nhận events, lookup policies, và dispatch tới đúng channels.
- **Policy_Override**: Thay đổi tạm thời policy tại runtime qua Dev Dashboard, không persist vào file config trừ khi user chọn "Save".
- **Notification_Log**: Danh sách các notifications đã phát, lưu trong memory (dev mode), dùng cho debugging.
- **Silent_Policy**: Policy có `silent: true` — preference vẫn hoạt động nhưng không phát notification nào.
- **Trigger_Condition**: Điều kiện kích hoạt notification — `onChange`, `onThreshold`, `onError`, `periodic`, `onEvent`.
- **Config_First**: Triết lý thiết kế — mọi hành vi mặc định đều đến từ file config, code chỉ đọc config và thực thi.

---

## Requirements

### Requirement 1: Notification Policy Registry

**User Story:** Là một developer, tôi muốn mọi notification behavior được định nghĩa trong file config thay vì hardcode, để tôi có thể thay đổi cách thông báo mà không cần sửa code.

#### Acceptance Criteria

1. THE application SHALL load notification policies từ Policy_Config_File khi khởi động.
2. THE Policy_Config_File SHALL sử dụng định dạng JSON với schema rõ ràng và có thể validate.
3. WHEN Policy_Config_File không tồn tại hoặc không đọc được, THE application SHALL sử dụng default policies được bundle cùng ứng dụng.
4. EACH notification policy SHALL chứa tối thiểu: `id`, `preferenceKey` (hoặc `eventKey`), `channel`, `format`, `priority`, `silent`, `trigger`.
5. ONE preference key SHALL có thể có nhiều notification policies đồng thời (1:N relationship).
6. WHEN một policy có `silent: true`, THE Notification_Dispatcher SHALL không phát notification nào cho policy đó.
7. THE Policy_Config_File SHALL hỗ trợ policies cho tất cả preference tabs: `general`, `ai-engine`, `typography`, `privacy`.
8. THE application SHALL validate Policy_Config_File schema khi load; IF schema không hợp lệ, THEN THE application SHALL log warning và fallback về default policies.
9. THE Notification_Dispatcher SHALL hỗ trợ cả preference-driven events (giá trị thay đổi) và system events (sync error, export success, AI response).
10. WHEN Policy_Config_File được cập nhật tại runtime (qua Dev Dashboard), THE Notification_Dispatcher SHALL reload policies mà không cần restart ứng dụng.

---

### Requirement 2: Notification Channels

**User Story:** Là một developer, tôi muốn có nhiều kênh hiển thị notification khác nhau, để mỗi loại thông báo được hiển thị ở vị trí phù hợp nhất.

#### Acceptance Criteria

1. THE application SHALL hỗ trợ tối thiểu 5 notification channels: `statusBar`, `toast`, `titleBar`, `badge`, `none`.
2. THE `statusBar` channel SHALL render notifications trong EditorStatusBar component hiện tại.
3. THE `toast` channel SHALL render notifications dạng snackbar/toast overlay, tự động ẩn sau `duration` milliseconds.
4. THE `titleBar` channel SHALL render notifications dạng indicator (icon, text nhỏ) trong DocumentTitleBar.
5. THE `badge` channel SHALL render notifications dạng badge count trên icon (dành cho tương lai).
6. THE `none` channel SHALL không render bất kỳ UI nào — dùng cho silent policies.
7. WHEN nhiều notifications cùng channel được active đồng thời, THE Channel_Renderer SHALL hiển thị theo thứ tự priority (critical > high > medium > low).
8. WHEN một notification có `duration` khác null, THE Channel_Renderer SHALL tự động dismiss notification sau khoảng thời gian đó.
9. WHEN một notification có `duration` là null, THE Channel_Renderer SHALL giữ notification cho đến khi state thay đổi hoặc bị dismiss thủ công.
10. EACH Channel_Renderer SHALL expose một React hook để component subscribe vào notifications của channel đó.

---

### Requirement 3: Notification Formats

**User Story:** Là một developer, tôi muốn notification có nhiều kiểu hiển thị khác nhau, để thông tin được trình bày phù hợp với ngữ cảnh.

#### Acceptance Criteria

1. THE `countdown` format SHALL hiển thị thời gian còn lại (giảm dần) cho đến khi một event xảy ra. Ví dụ: "Next sync in 12s".
2. THE `elapsed` format SHALL hiển thị thời gian đã trôi qua kể từ event gần nhất. Ví dụ: "Synced · 15s ago".
3. THE `message` format SHALL hiển thị một chuỗi text tĩnh hoặc template. Ví dụ: "Sync failed: {error}".
4. THE `indicator` format SHALL hiển thị một icon hoặc ký hiệu trạng thái. Ví dụ: ● (unsaved), ✓ (synced), ⟳ (syncing).
5. THE `progress` format SHALL hiển thị thanh tiến trình hoặc phần trăm. Ví dụ: "Exporting... 45%".
6. EACH format SHALL hỗ trợ template variables dạng `{variableName}` được resolve từ context tại thời điểm render.
7. THE `countdown` và `elapsed` formats SHALL tự động cập nhật mỗi giây mà không cần re-dispatch notification.
8. WHEN template variable không resolve được, THE format SHALL hiển thị placeholder `[unknown]` thay vì crash.

---

### Requirement 4: Trigger Conditions

**User Story:** Là một developer, tôi muốn cấu hình khi nào notification được kích hoạt, để tránh spam người dùng với thông báo không cần thiết.

#### Acceptance Criteria

1. THE `onChange` trigger SHALL kích hoạt notification khi giá trị preference thay đổi.
2. THE `onThreshold` trigger SHALL kích hoạt notification khi giá trị preference vượt qua ngưỡng được cấu hình (operator + value).
3. THE `onError` trigger SHALL kích hoạt notification khi một system error xảy ra liên quan đến preference đó.
4. THE `periodic` trigger SHALL kích hoạt notification theo chu kỳ thời gian được cấu hình (intervalMs).
5. THE `onEvent` trigger SHALL kích hoạt notification khi một named system event được emit (ví dụ: `sync.success`, `sync.error`, `export.complete`).
6. WHEN trigger condition không thỏa mãn, THE Notification_Dispatcher SHALL không phát notification.
7. THE `onThreshold` trigger SHALL hỗ trợ operators: `>`, `<`, `>=`, `<=`, `==`, `!=`.
8. WHEN nhiều policies cùng trigger cho một event, THE Notification_Dispatcher SHALL dispatch tất cả policies đồng thời (không chặn nhau).

---

### Requirement 5: Dev Dashboard

**User Story:** Là một developer, tôi muốn có giao diện debug để xem và chỉnh sửa notification policies tại runtime, để tôi hiểu cách hệ thống hoạt động mà không cần đọc code.

#### Acceptance Criteria

1. THE Dev_Dashboard SHALL chỉ render khi `import.meta.env.DEV === true`.
2. THE Dev_Dashboard SHALL không có bất kỳ entry point nào trong production build — không menu, không route, không button.
3. THE Dev_Dashboard SHALL được kích hoạt bằng keyboard shortcut `Ctrl+Shift+Alt+D` (hoặc `Cmd+Shift+Option+D` trên macOS).
4. THE Dev_Dashboard SHALL hiển thị bảng liệt kê tất cả notification policies hiện tại, bao gồm: preferenceKey, channel, format, priority, silent, trigger.
5. THE Dev_Dashboard SHALL cho phép override bất kỳ policy field nào tại runtime (Policy_Override).
6. THE Dev_Dashboard SHALL hiển thị Notification_Log — timeline các notifications đã phát, kèm timestamp, channel, payload.
7. THE Dev_Dashboard SHALL cho phép simulate (trigger thủ công) bất kỳ notification nào để test UI.
8. THE Dev_Dashboard SHALL hiển thị live state của tất cả preferences (giá trị hiện tại, realtime update).
9. THE Dev_Dashboard SHALL có nút "Save to Config" để persist Policy_Override vào Policy_Config_File.
10. THE Dev_Dashboard SHALL có nút "Reset to Defaults" để khôi phục policies về trạng thái mặc định.
11. WHEN Dev_Dashboard đang mở, THE Dev_Dashboard SHALL không ảnh hưởng đến performance của editor chính.
12. THE Dev_Dashboard SHALL được tree-shaken khỏi production bundle (code splitting hoặc conditional import).

---

### Requirement 6: Config File Schema & Location

**User Story:** Là một developer, tôi muốn notification policies được lưu trong file config có schema rõ ràng, để tôi có thể version control và chia sẻ config giữa các môi trường.

#### Acceptance Criteria

1. THE Policy_Config_File SHALL được lưu tại đường dẫn platform-specific: `~/Library/Application Support/WordAI/config/notification-policies.json` (macOS) hoặc `AppData/Local/WordAI/config/notification-policies.json` (Windows).
2. THE Policy_Config_File SHALL có JSON schema version field (`schemaVersion`) để hỗ trợ migration trong tương lai.
3. THE Policy_Config_File SHALL chứa array `policies` với mỗi entry là một NotificationPolicy object đầy đủ.
4. THE application SHALL bundle một default config file trong source code tại `src/config/default-notification-policies.json`.
5. WHEN user config tồn tại, THE application SHALL merge user config với default config — user policies override default policies cùng `id`.
6. THE application SHALL expose Tauri IPC commands để read/write Policy_Config_File từ frontend.
7. WHEN Policy_Config_File bị corrupt hoặc schema version không tương thích, THE application SHALL backup file cũ và tạo file mới từ defaults.
8. THE Policy_Config_File SHALL hỗ trợ comments (JSONC) hoặc có file schema companion (`.schema.json`) để developer hiểu cấu trúc.

---

### Requirement 7: Integration với Existing Systems

**User Story:** Là một developer, tôi muốn notification system tích hợp mượt mà với EditorStatusBar, DocumentTitleBar, và AuraBrainManager hiện tại, để không phá vỡ các tính năng đã hoạt động.

#### Acceptance Criteria

1. THE EditorStatusBar SHALL subscribe vào `statusBar` channel và render notifications theo policy thay vì hardcode logic hiển thị.
2. THE DocumentTitleBar SHALL subscribe vào `titleBar` channel cho indicator notifications.
3. THE AuraBrainManager SHALL emit system events (`sync.start`, `sync.success`, `sync.error`) mà Notification_Dispatcher có thể listen.
4. THE PreferencesService SHALL emit `preference.changed` event khi bất kỳ preference nào thay đổi, kèm `{ key, oldValue, newValue }`.
5. THE useAutoSync hook SHALL emit `autoSync.tick` event mỗi interval để `countdown` format có thể tính toán thời gian còn lại.
6. WHEN notification system chưa sẵn sàng (loading config), THE existing components SHALL fallback về behavior hiện tại (hardcode) mà không crash.
7. THE notification system SHALL không thay đổi behavior mặc định của ứng dụng — default policies phải reproduce behavior hiện tại (status bar hiển thị "Synced · Ns ago", title bar hiển thị ●, v.v.).
8. THE notification system SHALL không block main thread — dispatch và render phải async/non-blocking.

---

### Requirement 8: Notification Lifecycle

**User Story:** Là một developer, tôi muốn notifications có lifecycle rõ ràng (created → active → dismissed), để tránh memory leak và UI inconsistency.

#### Acceptance Criteria

1. EACH notification SHALL có unique `id` được generate khi dispatch.
2. EACH notification SHALL có lifecycle states: `pending` → `active` → `dismissed`.
3. WHEN notification chuyển sang `active`, THE Channel_Renderer SHALL bắt đầu render.
4. WHEN notification chuyển sang `dismissed`, THE Channel_Renderer SHALL ngừng render và cleanup resources.
5. THE Notification_Dispatcher SHALL tự động dismiss notifications khi: (a) duration hết, (b) state thay đổi làm notification không còn relevant, (c) policy bị disable.
6. THE Notification_Log SHALL lưu tối đa 200 entries gần nhất (FIFO) để tránh memory leak.
7. WHEN ứng dụng mất focus (window blur), THE `toast` channel SHALL pause duration countdown và resume khi focus trở lại.
8. THE notification system SHALL cleanup tất cả active notifications khi component unmount hoặc ứng dụng đóng.

