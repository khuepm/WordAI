# Requirements Document

## Introduction

Tính năng Quick Settings Search cho phép người dùng WordAI Editor tìm kiếm nhanh các cài đặt (settings) thông qua một popup được kích hoạt bằng tổ hợp phím `Cmd+Shift+P` (macOS) hoặc `Ctrl+Shift+P` (Windows/Linux), tương tự Command Palette của VSCode. Người dùng gõ từ khóa, chọn một setting từ kết quả, và hệ thống tự động mở PreferencesDialog đúng tab rồi cuộn đến setting đó.

---

## Glossary

- **QuickSearch_Popup**: Component popup hiển thị khi người dùng nhấn tổ hợp phím kích hoạt.
- **SettingEntry**: Một bản ghi metadata mô tả một setting, gồm `id`, `label`, `description`, `tab`, `keywords`, `type`, `defaultValue`.
- **SettingRegistry**: Danh sách phẳng (flat list) tất cả các `SettingEntry` trong ứng dụng.
- **PreferencesDialog**: Dialog cài đặt hiện có với 4 tab: General, AI Engine, Typography, Privacy.
- **Tab**: Một trong bốn nhóm cài đặt: `general`, `ai-engine`, `typography`, `privacy`.
- **PreferencesService**: Service frontend giao tiếp với Tauri IPC để load/save/reset preferences.
- **PreferencesStore**: Module Rust backend đọc/ghi file JSON preferences.
- **Preferences**: Cấu trúc dữ liệu JSON chứa toàn bộ cài đặt của người dùng.

---

## Requirements

### Requirement 1: Kích hoạt Quick Search Popup

**User Story:** As a người dùng WordAI Editor, I want nhấn tổ hợp phím để mở popup tìm kiếm setting, so that tôi có thể truy cập nhanh bất kỳ cài đặt nào mà không cần dùng chuột.

#### Acceptance Criteria

1. WHEN người dùng nhấn `Cmd+Shift+P` trên macOS, THE QuickSearch_Popup SHALL hiển thị và focus vào ô input tìm kiếm.
2. WHEN người dùng nhấn `Ctrl+Shift+P` trên Windows hoặc Linux, THE QuickSearch_Popup SHALL hiển thị và focus vào ô input tìm kiếm.
3. WHILE QuickSearch_Popup đang hiển thị, WHEN người dùng nhấn phím `Escape`, THE QuickSearch_Popup SHALL đóng lại.
4. WHILE QuickSearch_Popup đang hiển thị, WHEN người dùng click ra ngoài vùng popup, THE QuickSearch_Popup SHALL đóng lại.
5. THE QuickSearch_Popup SHALL hiển thị dưới dạng overlay modal ở trung tâm màn hình với backdrop mờ.

---

### Requirement 2: Tìm kiếm Setting

**User Story:** As a người dùng, I want gõ từ khóa vào popup để lọc danh sách setting, so that tôi tìm được setting cần thiết một cách nhanh chóng.

#### Acceptance Criteria

1. THE QuickSearch_Popup SHALL hiển thị một ô input text được focus tự động khi popup mở.
2. WHEN người dùng nhập văn bản vào ô input, THE QuickSearch_Popup SHALL lọc SettingRegistry theo `label`, `description`, và `keywords` của từng SettingEntry.
3. THE QuickSearch_Popup SHALL thực hiện tìm kiếm case-insensitive (không phân biệt hoa thường).
4. WHEN ô input trống, THE QuickSearch_Popup SHALL hiển thị toàn bộ danh sách SettingEntry từ SettingRegistry.
5. WHEN không có SettingEntry nào khớp với từ khóa, THE QuickSearch_Popup SHALL hiển thị thông báo "No settings found".
6. THE QuickSearch_Popup SHALL cập nhật kết quả tìm kiếm ngay lập tức sau mỗi ký tự người dùng nhập (real-time filtering).

---

### Requirement 3: Hiển thị Kết quả Tìm kiếm

**User Story:** As a người dùng, I want xem kết quả tìm kiếm với đủ thông tin để nhận biết setting, so that tôi chọn đúng setting cần thay đổi.

#### Acceptance Criteria

1. THE QuickSearch_Popup SHALL hiển thị mỗi SettingEntry trong kết quả với `label` và `description`.
2. THE QuickSearch_Popup SHALL hiển thị một tab badge (General, AI Engine, Typography, Privacy) cho mỗi SettingEntry trong kết quả.
3. THE QuickSearch_Popup SHALL hiển thị tối đa 8 kết quả trong danh sách có thể cuộn.
4. WHEN người dùng dùng phím mũi tên lên/xuống, THE QuickSearch_Popup SHALL di chuyển highlight giữa các kết quả.
5. THE QuickSearch_Popup SHALL highlight kết quả đầu tiên trong danh sách theo mặc định khi có kết quả.

---

### Requirement 4: Điều hướng đến Setting

**User Story:** As a người dùng, I want chọn một setting từ kết quả để được đưa thẳng đến setting đó, so that tôi không phải tự tìm trong PreferencesDialog.

#### Acceptance Criteria

1. WHEN người dùng click vào một SettingEntry trong kết quả, THE QuickSearch_Popup SHALL đóng lại và mở PreferencesDialog đúng tab tương ứng với `tab` của SettingEntry đó.
2. WHEN người dùng nhấn phím `Enter` khi một SettingEntry đang được highlight, THE QuickSearch_Popup SHALL đóng lại và mở PreferencesDialog đúng tab tương ứng.
3. WHEN PreferencesDialog mở theo yêu cầu từ QuickSearch_Popup, THE PreferencesDialog SHALL cuộn đến vị trí của setting được chọn trong vòng 300ms.
4. IF SettingEntry được chọn không tồn tại trong SettingRegistry, THEN THE QuickSearch_Popup SHALL hiển thị thông báo lỗi và không thực hiện điều hướng.

---

### Requirement 5: SettingRegistry — Danh mục Setting

**User Story:** As a developer, I want có một registry tập trung chứa metadata của tất cả settings, so that QuickSearch_Popup có thể tìm kiếm và điều hướng đến bất kỳ setting nào.

#### Acceptance Criteria

1. THE SettingRegistry SHALL chứa ít nhất một SettingEntry cho mỗi setting hiển thị trong PreferencesDialog.
2. THE SettingRegistry SHALL bao gồm các SettingEntry cho các setting thuộc tab General: theme, autoSave, focusMode, language.
3. THE SettingRegistry SHALL bao gồm các SettingEntry cho các setting thuộc tab AI Engine: agent, model, creativity, contextWindowTokens, responseLanguage, webAccess.
4. THE SettingRegistry SHALL bao gồm các SettingEntry cho các setting thuộc tab Typography: fontFamily, fontSize, lineSpacing, smartQuotes, autoCapitalize, ligatures.
5. THE SettingRegistry SHALL bao gồm các SettingEntry cho các setting thuộc tab Privacy: allowAITraining, analyticsEnabled, crashReports, localProcessingOnly.
6. THE SettingEntry SHALL có các trường bắt buộc: `id` (dạng `"tab.settingName"`), `label`, `description`, `tab`, `keywords`, `type`, `defaultValue`.

---

### Requirement 6: Preferences Schema và TypeScript Types

**User Story:** As a developer, I want có TypeScript types đầy đủ cho toàn bộ preferences schema, so that code frontend có type safety khi làm việc với preferences.

#### Acceptance Criteria

1. THE PreferencesService SHALL định nghĩa interface `Preferences` bao gồm các nhóm: `general`, `aiEngine`, `typography`, `privacy`.
2. THE PreferencesService SHALL định nghĩa interface `SettingEntry` với các trường: `id`, `label`, `description`, `tab`, `keywords`, `type`, `defaultValue`.
3. THE PreferencesService SHALL export type `Tab` là union type của `'general' | 'ai-engine' | 'typography' | 'privacy'`.
4. THE PreferencesService SHALL định nghĩa `defaultPreferences` là object `Preferences` chứa giá trị mặc định cho tất cả settings.

---

### Requirement 7: Tauri Backend — Đọc/Ghi Preferences

**User Story:** As a developer, I want có Tauri commands để load, save, và reset preferences, so that frontend có thể persist preferences xuống file system.

#### Acceptance Criteria

1. THE PreferencesStore SHALL cung cấp command `load_preferences` nhận `user_id` và trả về `Preferences` JSON từ file `user_{userId}.json` trong app data directory.
2. WHEN file `user_{userId}.json` không tồn tại, THE PreferencesStore SHALL merge `default.json` với các giá trị mặc định và trả về kết quả.
3. THE PreferencesStore SHALL cung cấp command `save_preferences` nhận `Preferences` JSON và ghi vào file `user_{userId}.json`.
4. THE PreferencesStore SHALL cung cấp command `reset_preferences` nhận `user_id` và `group` tùy chọn, trả về `Preferences` sau khi reset.
5. WHEN `group` được cung cấp cho `reset_preferences`, THE PreferencesStore SHALL chỉ reset nhóm setting tương ứng về giá trị trong `default.json`.
6. WHEN `group` không được cung cấp cho `reset_preferences`, THE PreferencesStore SHALL reset toàn bộ preferences về giá trị trong `default.json`.
7. IF thao tác đọc/ghi file thất bại, THEN THE PreferencesStore SHALL trả về lỗi có mô tả rõ ràng qua IPC error.

---

### Requirement 8: Default Preferences File

**User Story:** As a developer, I want có file `default.json` được bundle cùng ứng dụng, so that hệ thống luôn có giá trị mặc định để fallback khi chưa có preferences của user.

#### Acceptance Criteria

1. THE PreferencesStore SHALL đọc file `public/preferences/default.json` làm nguồn giá trị mặc định.
2. THE PreferencesStore SHALL sử dụng `default.json` để fill các key còn thiếu khi merge với preferences của user.
3. THE PreferencesStore SHALL validate rằng `default.json` có đủ tất cả các key bắt buộc khi ứng dụng khởi động.
4. IF `default.json` thiếu key bắt buộc, THEN THE PreferencesStore SHALL log cảnh báo và sử dụng giá trị hardcoded làm fallback.
