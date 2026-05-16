# Kế hoạch triển khai: Config-First Notification System

## Tổng quan

Triển khai hệ thống notification theo triết lý Config-First. Mọi notification behavior được định nghĩa trong file JSON config. Mỗi preference có thể có nhiều policies đồng thời. Dev Dashboard ẩn hoàn toàn khỏi production, chỉ kích hoạt trong dev mode.

## Tasks

- [x] 1. Định nghĩa Types và Default Config
  - [x] 1.1 Tạo `src/types/notification.ts`
    - Định nghĩa `NotificationChannel`, `NotificationFormat`, `NotificationPriority`, `TriggerType`
    - Định nghĩa `ThresholdConfig`, `PeriodicConfig`
    - Định nghĩa `NotificationPolicy` interface đầy đủ
    - Định nghĩa `PolicyConfigFile` interface với `schemaVersion`
    - Định nghĩa `NotificationEvent`, `ActiveNotification` interfaces
    - _Requirements: 1.4, 2.1, 3.1-3.5, 4.1-4.5, 6.2_

  - [x] 1.2 Tạo `src/config/default-notification-policies.json`
    - Policies mặc định reproduce behavior hiện tại:
      - `sync-status-elapsed`: statusBar, elapsed format, "Synced · {seconds}s ago"
      - `sync-status-syncing`: statusBar, indicator, "Syncing..."
      - `sync-error-toast`: toast, message, "Sync failed: {error}"
      - `sync-error-statusbar`: statusBar, indicator, "⚠ Sync error"
      - `dirty-titlebar-indicator`: titleBar, indicator, "●"
      - `dirty-statusbar`: statusBar, message, "Unsaved changes"
      - `autosync-interval-countdown`: statusBar, countdown, silent=true (disabled by default)
      - `preference-change-toast`: toast, message, silent=true (disabled by default)
      - `export-success-toast`: toast, message, "Exported to {path}"
      - `export-error-toast`: toast, message, "Export failed: {error}"
      - `ai-service-unavailable`: toast, message, "AI service unavailable"
    - Schema version = 1
    - _Requirements: 1.3, 6.4, 7.7_

  - [x] 1.3 Tạo JSON schema file `src/config/notification-policies.schema.json`
    - Validate structure của PolicyConfigFile
    - Dùng cho IDE autocompletion khi edit config
    - _Requirements: 1.2, 6.8_

- [x] 2. Implement NotificationRegistry Service
  - [x] 2.1 Tạo `src/services/notificationRegistry.ts`
    - State: `policies: NotificationPolicy[]`, `overrides: Map<string, Partial<NotificationPolicy>>`, `initialized: boolean`
    - Implement `initialize()`: load config via IPC → validate → merge với defaults
    - Implement `getAllPolicies()`: trả về merged policies (defaults + user + overrides)
    - Implement `lookupPolicies(sourceKey, trigger)`: filter policies matching sourceKey và trigger
    - Hỗ trợ wildcard matching cho sourceKey (ví dụ: `preference.*` matches `preference.changed.general.autoSyncInterval`)
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.8_

  - [x] 2.2 Implement policy override và persistence
    - `overridePolicy(policyId, overrides)`: in-memory override, không persist
    - `saveToConfig()`: persist current state (defaults + overrides) vào Policy_Config_File via IPC
    - `resetToDefaults()`: clear overrides, reload từ bundled defaults
    - _Requirements: 1.10, 5.5, 5.9, 5.10_

  - [x] 2.3 Implement subscribe/getSnapshot pattern
    - `subscribe(listener)` + `getSnapshot()` cho `useSyncExternalStore`
    - Notify listeners khi policies thay đổi (load, override, reset)
    - _Requirements: 1.10_

  - [x] 2.4 Implement config merge logic
    - User policies override default policies cùng `id`
    - Policies trong user config mà không có trong defaults → giữ nguyên
    - Policies trong defaults mà không có trong user config → giữ nguyên
    - _Requirements: 6.5_

- [x] 3. Implement NotificationDispatcher Service
  - [x] 3.1 Tạo `src/services/notificationDispatcher.ts`
    - State: `activeNotifications: Map<string, ActiveNotification>`, `log: ActiveNotification[]`
    - Implement `dispatch(event)`:
      1. Lookup policies từ registry
      2. Filter out silent policies
      3. Resolve template variables
      4. Create ActiveNotification cho mỗi policy
      5. Route tới channel
    - _Requirements: 1.6, 1.9, 4.6, 4.8_

  - [x] 3.2 Implement template resolution
    - Parse `{variableName}` trong template string
    - Resolve từ `event.data`
    - Fallback `[unknown]` nếu variable không tồn tại
    - _Requirements: 3.6, 3.8_

  - [x] 3.3 Implement notification lifecycle
    - Generate unique id cho mỗi notification
    - State transitions: pending → active → dismissed
    - Auto-dismiss sau `duration` ms (nếu duration !== null)
    - Dismiss khi state thay đổi (new notification cùng policy replaces old)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 3.4 Implement channel subscription
    - `getChannelNotifications(channel)`: trả về active notifications sorted by priority
    - `subscribeChannel(channel, listener)`: notify khi channel state thay đổi
    - `dismiss(notificationId)`: manual dismiss
    - `dismissChannel(channel)`: dismiss all trong channel
    - _Requirements: 2.7, 2.8, 2.9_

  - [x] 3.5 Implement notification log
    - Ring buffer max 200 entries
    - Lưu tất cả dispatched notifications (kể cả dismissed)
    - `getLog()`: trả về log entries
    - _Requirements: 5.6, 8.6_

  - [x] 3.6 Implement trigger matching
    - `onChange`: match khi event.trigger === 'onChange'
    - `onThreshold`: match khi value passes threshold (operator + value)
    - `onError`: match khi event.trigger === 'onError'
    - `periodic`: managed by internal timer, dispatch mỗi intervalMs
    - `onEvent`: match khi event.trigger === 'onEvent' và sourceKey match
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

- [ ] 4. Implement Notification Channels
  - [x] 4.1 Tạo `src/services/notificationChannels.ts`
    - Abstract channel interface
    - StatusBar channel: persistent notifications, priority ordering
    - Toast channel: auto-dismiss, stack management
    - TitleBar channel: indicator only
    - Badge channel: count-based (placeholder for future)
    - None channel: no-op
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.2 Tạo `src/hooks/useNotificationChannel.ts`
    - `useNotificationChannel(channel)`: hook subscribe vào channel, trả về ActiveNotification[]
    - `useTopNotification(channel)`: trả về highest-priority notification hoặc null
    - Dùng `useSyncExternalStore` pattern
    - _Requirements: 2.10_

  - [~] 4.3 Tạo `src/components/NotificationToast.tsx`
    - Render toast overlay (fixed position, top-right hoặc bottom-center)
    - Stack multiple toasts
    - Auto-dismiss animation
    - Priority-based ordering
    - Dismiss on click
    - _Requirements: 2.3, 2.8_

  - [~] 4.4 Implement countdown và elapsed format logic
    - Countdown: start từ value, giảm mỗi giây, dispatch "done" khi = 0
    - Elapsed: start từ 0, tăng mỗi giây
    - Cả hai tự cập nhật mà không cần re-dispatch
    - _Requirements: 3.1, 3.2, 3.7_

- [ ] 5. Implement Tauri IPC cho Config File
  - [~] 5.1 Thêm Rust command `load_notification_policies`
    - Đọc file từ platform-specific path
    - Trả về JSON string hoặc null nếu file không tồn tại
    - _Requirements: 6.1, 6.6_

  - [~] 5.2 Thêm Rust command `save_notification_policies`
    - Nhận JSON string, validate, ghi vào file
    - Tạo thư mục nếu chưa tồn tại
    - Backup file cũ trước khi overwrite
    - _Requirements: 6.6, 6.7_

  - [~] 5.3 Đăng ký commands vào `tauri::Builder`
    - _Requirements: 6.6_

- [ ] 6. Tích hợp Event Emitters vào Existing Services
  - [~] 6.1 Cập nhật `auraBrainManager.ts`
    - Emit `sync.start` khi bắt đầu sync
    - Emit `sync.success` khi sync thành công (kèm version, timestamp)
    - Emit `sync.error` khi sync thất bại (kèm error message)
    - Emit `document.dirty` khi dirty state thay đổi
    - _Requirements: 7.3_

  - [~] 6.2 Cập nhật `preferencesService.ts`
    - Emit `preference.changed` khi savePreferences thành công
    - Payload: `{ key, oldValue, newValue, label }`
    - _Requirements: 7.4_

  - [~] 6.3 Cập nhật `useAutoSync` hook
    - Emit `autoSync.tick` mỗi interval (kèm remainingSeconds)
    - Emit `autoSync.skip` khi skip do clean/syncing
    - _Requirements: 7.5_

  - [~] 6.4 Cập nhật `exportService.ts`
    - Emit `export.start` khi bắt đầu export
    - Emit `export.complete` khi export thành công (kèm path, format)
    - Emit `export.error` khi export thất bại (kèm error)
    - _Requirements: 7.3_

- [ ] 7. Migrate EditorStatusBar sang Channel-based
  - [~] 7.1 Cập nhật `EditorStatusBar.tsx`
    - Subscribe vào `statusBar` channel via `useNotificationChannel('statusBar')`
    - Render top notification theo format (elapsed, countdown, message, indicator)
    - Fallback: nếu không có notification → hiển thị behavior cũ
    - Giữ nguyên styling và layout hiện tại
    - _Requirements: 7.1, 7.6, 7.7_

  - [~] 7.2 Cập nhật `DocumentTitleBar.tsx`
    - Subscribe vào `titleBar` channel
    - Render indicator notification (●) khi có
    - Fallback: giữ behavior cũ nếu channel empty
    - _Requirements: 7.2, 7.6, 7.7_

- [ ] 8. Implement Dev Dashboard
  - [~] 8.1 Tạo `src/components/DevDashboard.tsx` (lazy loaded)
    - Conditional render: `import.meta.env.DEV` only
    - Keyboard shortcut: `Ctrl+Shift+Alt+D` / `Cmd+Shift+Option+D`
    - Layout: full-screen overlay hoặc side panel
    - _Requirements: 5.1, 5.2, 5.3, 5.12_

  - [~] 8.2 Implement Policy Table section
    - Bảng hiển thị tất cả policies
    - Columns: id, sourceKey, channel, format, priority, silent, trigger
    - Inline editing cho mỗi field
    - Toggle silent on/off
    - _Requirements: 5.4, 5.5_

  - [~] 8.3 Implement Notification Log section
    - Timeline view các notifications đã dispatch
    - Hiển thị: timestamp, channel, format, resolvedContent, state
    - Filter by channel, priority
    - _Requirements: 5.6_

  - [~] 8.4 Implement Event Simulator section
    - Dropdown chọn event type (sync.start, sync.error, preference.changed, etc.)
    - Input fields cho data payload
    - Button "Simulate" → dispatch event
    - _Requirements: 5.7_

  - [~] 8.5 Implement Live Preferences section
    - Hiển thị tất cả preference values realtime
    - Group by tab (general, ai-engine, typography, privacy)
    - Highlight khi value thay đổi
    - _Requirements: 5.8_

  - [~] 8.6 Implement Save/Reset actions
    - "Save to Config" button → persist overrides vào file
    - "Reset to Defaults" button → clear overrides, reload defaults
    - Confirmation dialog trước khi reset
    - _Requirements: 5.9, 5.10_

  - [~] 8.7 Ensure tree-shaking
    - Dùng dynamic import: `const DevDashboard = lazy(() => import('./DevDashboard'))`
    - Wrap trong `if (import.meta.env.DEV)` guard
    - Verify production bundle không chứa DevDashboard code
    - _Requirements: 5.11, 5.12_

- [ ] 9. Notification Lifecycle & Cleanup
  - [~] 9.1 Implement auto-dismiss timer
    - Khi notification có duration !== null, start timer
    - Khi timer fires, transition to 'dismissed'
    - Pause timer khi window blur (toast channel only)
    - Resume timer khi window focus
    - _Requirements: 8.5, 8.7_

  - [~] 9.2 Implement state-change dismiss
    - Khi new notification cùng policyId dispatch, dismiss old notification
    - Khi source state thay đổi (ví dụ: dirty → clean), dismiss related notifications
    - _Requirements: 8.5_

  - [~] 9.3 Implement cleanup on unmount
    - Clear all timers
    - Dismiss all active notifications
    - Unsubscribe all listeners
    - _Requirements: 8.8_

- [ ] 10. Testing
  - [~] 10.1 Unit tests cho NotificationRegistry
    - Load default config
    - Merge user config with defaults
    - Lookup policies by sourceKey
    - Wildcard matching
    - Override policy
    - Save to config
    - Reset to defaults
    - Invalid config fallback
    - _Requirements: 1.1-1.10_

  - [~] 10.2 Unit tests cho NotificationDispatcher
    - Dispatch event routes to correct channel
    - Silent policy suppresses notification
    - Template resolution with variables
    - Template resolution with missing variable → [unknown]
    - Duration auto-dismiss
    - Priority ordering within channel
    - Log bounded to 200 entries
    - Multiple policies for same event
    - _Requirements: 2.7, 3.6, 3.8, 4.6, 4.8, 8.6_

  - [~] 10.3 Unit tests cho Channels
    - StatusBar channel renders top notification
    - Toast channel auto-dismisses
    - TitleBar channel renders indicator
    - None channel is no-op
    - _Requirements: 2.1-2.6_

  - [~] 10.4 Unit tests cho trigger conditions
    - onChange fires on value change
    - onThreshold fires when threshold crossed
    - onEvent fires on matching event
    - periodic fires at interval
    - _Requirements: 4.1-4.5_

  - [~] 10.5 Integration tests
    - Preference change → toast notification appears
    - Sync error → toast + statusBar notification
    - Auto-sync countdown (when enabled) → statusBar countdown
    - Dev Dashboard opens in dev mode
    - Dev Dashboard does NOT render in production
    - _Requirements: 7.1-7.8, 5.1, 5.2_

## Ghi chú

- **Dependency order**: Types (Task 1) → Registry (Task 2) → Dispatcher (Task 3) → Channels (Task 4) → IPC (Task 5) → Integration (Tasks 6-7) → Dev Dashboard (Task 8)
- **Non-breaking**: Tasks 1-5 có thể triển khai song song với code hiện tại. Tasks 6-7 migrate dần, có fallback.
- **Tree-shaking**: Dev Dashboard (Task 8) phải verify bundle size không tăng trong production.
- **Config location**: macOS: `~/Library/Application Support/WordAI/config/notification-policies.json`
