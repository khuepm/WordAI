# Requirements Document: AuraBrain Persistence & Legacy Export

## Introduction

WordAI không phải là một text editor lưu file truyền thống. WordAI là một **Intent Engine** — nơi người dùng viết ra "ý niệm" (intent/idea), và hệ thống tự động hiểu, lưu trữ, và tổ chức chúng trong một local database ẩn gọi là **AuraBrain**.

Người dùng không bao giờ thấy đường dẫn file, không bao giờ cần nhớ "lưu vào thư mục nào". Họ chỉ viết. `Cmd+S` có nghĩa là "đồng bộ ý niệm vào AuraBrain" — không phải "lưu file". Xuất ra `.md` hay `.docx` là tính năng **Export for Legacy Systems**, dành cho khi cần chia sẻ với người dùng các công cụ cũ (Word, GitHub, v.v.).

Tính năng này mở rộng Requirement 2 (Auto-Save), Requirement 11 (Render Drawer), và Requirement 13 (File System Operations) của spec `wordai-text-editor`, đồng thời bổ sung các preferences mới vào `SettingRegistry` để tích hợp với Quick Search (spec `quick-settings-search`).


---
## Chuẩn bị cho bản cập nhật ở tương lai

- Tách bạch hoàn toàn Sync và Export: Việc biến Cmd+S thành "Lưu ý niệm vào não bộ" (không hiện hộp thoại) và tạo một luồng riêng cho Export là một quyết định UI/UX xuất sắc. Người dùng sẽ thoát khỏi hội chứng "sợ quên lưu file".

- Thiết kế Database sẵn sàng cho AI (Future-Proof): Trong Requirement 5, việc bạn thiết kế sẵn bảng Intent_Chunk và chừa cột embedding là nước cờ cực kỳ cao tay. Nó tạo nền tảng vững chắc để sau này khi bạn có thêm kinh phí, chỉ cần ốp model AI vào là tính năng Semantic Search (Tìm kiếm theo ngữ nghĩa) sẽ chạy mượt mà ngay lập tức.

- Quản lý hiệu năng đỉnh cao: Sử dụng SQLite WAL mode (Requirement 9) và giới hạn Auto-Sync từ 5-60 giây (Requirement 10) là hoàn toàn hợp lý. SQLite ghi dữ liệu nhẹ và nhanh hơn ghi file .docx rất nhiều, nên để 5 giây cũng không làm giật lag máy người dùng.

---

## Glossary

- **AuraBrain**: Local database ẩn tại `~/Library/Application Support/WordAI/AuraBrain/` (macOS) hoặc `AppData/Local/WordAI/AuraBrain/` (Windows). Người dùng không biết và không cần biết thư mục này.
- **Intent_Name**: Tên hiển thị của một document trong WordAI, do người dùng đặt. Ví dụ: "Bài viết về AI năm 2025". Không phải tên file.
- **Intent_Chunk**: Một đoạn nhỏ của nội dung document được chia nhỏ để tạo Vector_Embedding. Mỗi Intent có thể có nhiều Intent_Chunk.
- **Vector_Embedding**: Biểu diễn số học (float array) của một Intent_Chunk, dùng cho semantic search trong tương lai. Được lưu trong AuraBrain.
- **Sync_Queue**: Hàng đợi lưu trữ các lệnh Sync được nhận trong khi Is_Syncing đang bật.
- **Export_Module**: Module riêng biệt xử lý việc xuất document ra file vật lý cho legacy systems.
- **Legacy_Export**: Thao tác xuất document từ AuraBrain ra file `.md` hoặc `.docx` để dùng với các công cụ bên ngoài.
- **Export_Format**: Định dạng file đầu ra khi Export, hiện hỗ trợ `markdown` (`.md`) và `docx` (`.docx`).
- **AuraBrain_Manager**: Service frontend điều phối toàn bộ luồng Sync và tương tác với AuraBrain SQLite.
- **SQLite_Store**: Rust backend service quản lý đọc/ghi vào AuraBrain SQLite database.
- **IPC_Bridge**: Tauri Inter-Process Communication layer (đã có) kết nối frontend và backend.
- **Native_File_Dialog**: Hộp thoại chọn file/thư mục do Tauri cung cấp, chỉ dùng trong Export context.
- **Markdown_Serializer**: Module chuyển đổi Document object sang chuỗi Markdown thuần.
- **DOCX_Exporter**: Module Rust backend chuyển đổi Document object sang định dạng DOCX.
- **Background_Worker**: Luồng Rust riêng biệt xử lý tác vụ nặng (DOCX export) mà không chặn main thread.
- **Is_Syncing**: Cờ trạng thái (boolean) đánh dấu AuraBrain_Manager đang trong quá trình ghi vào SQLite.
- **Dirty_Bit**: Trạng thái boolean cho biết nội dung document hiện tại khác với trạng thái lúc sync gần nhất vào AuraBrain.
- **Content_Hash**: Giá trị hash (SHA-256) của nội dung document tại thời điểm sync gần nhất, dùng để so sánh Dirty_Bit.
- **Debounce_Window**: Khoảng thời gian (2 giây) sau khi một lệnh Sync hoàn tất, trong đó Auto-sync sẽ bị bỏ qua.
- **Unsupported_Element**: Thành phần DOCX (Table, Image, Comment, v.v.) mà WordAI chưa hỗ trợ chỉnh sửa.
- **Placeholder**: Khối nội dung đặc biệt trong Document object dùng để giữ chỗ cho Unsupported_Element.
- **Aura_Tag**: Metadata ẩn chứa `intent_id` (UUID) được nhúng vào file export để WordAI nhận diện Intent khi import lại. Với `.md`: YAML frontmatter ẩn. Với `.docx`: Custom Document Properties.
- **Intent_Conflict**: Tình huống khi file import có Aura_Tag trùng với Intent_ID đã tồn tại trong AuraBrain nhưng nội dung khác nhau.
- **Replace_Confirmation_Dialog**: Hộp thoại xác nhận hiển thị khi phát hiện Intent_Conflict, cho phép người dùng xác nhận trước khi thay thế.
- **PreferencesService**: Service frontend (đã có) giao tiếp với Tauri IPC để load/save preferences.
- **SettingRegistry**: Danh sách phẳng (flat list) tất cả `SettingEntry` trong ứng dụng, dùng cho Quick Search.
- **Document_Title_Bar**: Vùng tiêu đề cửa sổ hiển thị Intent_Name và trạng thái sync.
- **Unsaved_Indicator**: Ký hiệu hiển thị khi document có thay đổi chưa được sync vào AuraBrain (dấu `●`).

---

## Requirements

### Requirement 1: Intent Sync (Cmd+S)

**User Story:** Là một writer, tôi muốn nhấn Cmd+S để đồng bộ ý niệm vào AuraBrain, để nội dung được lưu trữ ngay lập tức mà không cần chọn đường dẫn file.

#### Acceptance Criteria

1. WHEN người dùng nhấn `Cmd+S` (macOS) hoặc `Ctrl+S` (Windows/Linux), THE AuraBrain_Manager SHALL ghi nội dung document vào AuraBrain SQLite mà không mở bất kỳ hộp thoại nào.
2. WHEN thao tác sync hoàn tất thành công, THE AuraBrain_Manager SHALL xóa Unsaved_Indicator trên Document_Title_Bar.
3. WHEN thao tác sync hoàn tất thành công, THE AuraBrain_Manager SHALL tính toán và lưu Content_Hash của nội dung vừa ghi để làm mốc so sánh Dirty_Bit.
4. IF thao tác ghi SQLite thất bại, THEN THE AuraBrain_Manager SHALL hiển thị thông báo lỗi mô tả rõ nguyên nhân và không xóa Unsaved_Indicator.
5. WHILE Is_Syncing là `true`, WHEN một lệnh Sync mới được nhận, THE AuraBrain_Manager SHALL đưa lệnh đó vào Sync_Queue thay vì thực thi ngay lập tức.
6. WHEN Is_Syncing chuyển về `false`, THE AuraBrain_Manager SHALL xử lý lệnh Sync tiếp theo trong Sync_Queue nếu có, và bỏ qua các lệnh trùng lặp còn lại.
7. THE AuraBrain_Manager SHALL thực hiện mỗi thao tác ghi vào SQLite trong một transaction để đảm bảo tính toàn vẹn dữ liệu (Atomic Write).

---

### Requirement 2: Auto-sync

**User Story:** Là một writer, tôi muốn ý niệm được tự động đồng bộ vào AuraBrain theo định kỳ, để tôi không mất nội dung khi có sự cố mà không cần nhấn Cmd+S thủ công.

#### Acceptance Criteria

1. WHILE preference `autoSyncEnabled` là `true`, THE AuraBrain_Manager SHALL kích hoạt thao tác sync sau mỗi khoảng thời gian bằng `autoSyncInterval` giây.
2. WHILE preference `autoSyncEnabled` là `true`, WHEN cửa sổ ứng dụng mất focus, THE AuraBrain_Manager SHALL kích hoạt thao tác sync ngay lập tức.
3. WHEN Auto-sync được kích hoạt, THE AuraBrain_Manager SHALL ghi vào AuraBrain SQLite mà không hiển thị bất kỳ hộp thoại nào.
4. WHEN Auto-sync hoàn tất thành công, THE AuraBrain_Manager SHALL xóa Unsaved_Indicator trên Document_Title_Bar.
5. IF Auto-sync thất bại, THEN THE AuraBrain_Manager SHALL hiển thị thông báo lỗi không xâm lấn (non-blocking) và giữ nguyên Unsaved_Indicator.
6. WHEN một lệnh Sync hoàn tất thành công, WHILE thời gian kể từ lần sync đó nhỏ hơn Debounce_Window (2 giây), THE AuraBrain_Manager SHALL bỏ qua lệnh Auto-sync do mất focus được kích hoạt trong khoảng thời gian đó.
7. WHILE Is_Syncing là `true`, THE AuraBrain_Manager SHALL không kích hoạt thêm thao tác sync mới mà chờ đến chu kỳ tiếp theo.

---

### Requirement 3: Intent Name & Title Bar

**User Story:** Là một writer, tôi muốn tiêu đề cửa sổ hiển thị Intent_Name thay vì đường dẫn file, để tôi biết mình đang làm việc với ý niệm nào.

#### Acceptance Criteria

1. WHEN document có Intent_Name, THE Document_Title_Bar SHALL hiển thị theo định dạng `"{Intent_Name} — WordAI"`.
2. WHEN document chưa có Intent_Name, THE Document_Title_Bar SHALL hiển thị `"Untitled Intent — WordAI"`.
3. WHEN người dùng chỉnh sửa nội dung document và chưa sync vào AuraBrain, THE Document_Title_Bar SHALL hiển thị Unsaved_Indicator (ký hiệu `●`) trước Intent_Name.
4. WHEN thao tác sync hoàn tất thành công, THE Document_Title_Bar SHALL xóa Unsaved_Indicator ngay lập tức.
5. WHEN người dùng thực hiện Undo và Content_Hash của document hiện tại khớp với Content_Hash tại thời điểm sync gần nhất, THE Document_Title_Bar SHALL xóa Unsaved_Indicator.
6. WHEN Intent_Name thay đổi, THE Document_Title_Bar SHALL cập nhật tên hiển thị trong vòng 100ms.
7. THE Document_Title_Bar SHALL không bao giờ hiển thị đường dẫn file hay tên file vật lý.

---

### Requirement 4: Dirty Bit dựa trên Content_Hash

**User Story:** Là một writer, tôi muốn hệ thống chính xác phát hiện khi nào document có thay đổi chưa sync, để Unsaved_Indicator phản ánh đúng trạng thái thực tế.

#### Acceptance Criteria

1. WHEN thao tác sync hoàn tất thành công, THE AuraBrain_Manager SHALL tính toán Content_Hash (SHA-256) của nội dung vừa ghi và lưu vào bộ nhớ.
2. WHEN người dùng chỉnh sửa nội dung document, THE AuraBrain_Manager SHALL so sánh Content_Hash hiện tại với Content_Hash đã lưu để xác định Dirty_Bit.
3. WHEN Dirty_Bit là `true`, THE Document_Title_Bar SHALL hiển thị Unsaved_Indicator.
4. WHEN Dirty_Bit là `false`, THE Document_Title_Bar SHALL không hiển thị Unsaved_Indicator.
5. WHEN người dùng thực hiện Undo đến trạng thái khớp với Content_Hash đã lưu, THE AuraBrain_Manager SHALL đặt Dirty_Bit thành `false`.
6. WHEN document mới được tạo và chưa có nội dung, THE AuraBrain_Manager SHALL đặt Dirty_Bit thành `false`.

---

### Requirement 5: AuraBrain Storage

**User Story:** Là một developer, tôi muốn AuraBrain lưu trữ document dưới dạng SQLite với metadata đầy đủ và vector embedding placeholder, để hệ thống có nền tảng cho semantic search trong tương lai.

#### Acceptance Criteria

1. THE SQLite_Store SHALL tạo và quản lý AuraBrain database tại `~/Library/Application Support/WordAI/AuraBrain/` (macOS) hoặc `AppData/Local/WordAI/AuraBrain/` (Windows).
2. THE SQLite_Store SHALL lưu mỗi document với các trường: `id` (UUID), `intent_name` (text), `raw_content` (text), `created_at` (timestamp), `updated_at` (timestamp), `version` (integer).
3. THE SQLite_Store SHALL lưu các Intent_Chunk của mỗi document với các trường: `id` (UUID), `document_id` (foreign key), `chunk_index` (integer), `chunk_text` (text), `embedding` (blob, nullable).
4. WHEN một document được sync, THE SQLite_Store SHALL thực hiện toàn bộ thao tác ghi (document + chunks) trong một SQLite transaction duy nhất.
5. IF SQLite transaction thất bại, THEN THE SQLite_Store SHALL rollback toàn bộ thay đổi và trả về lỗi qua IPC_Bridge.
6. THE SQLite_Store SHALL tăng `version` của document mỗi khi sync thành công.
7. WHERE Vector_Embedding chưa được tính toán, THE SQLite_Store SHALL lưu `embedding` là `NULL` và không chặn thao tác sync.

---

### Requirement 6: Export to Markdown

**User Story:** Là một writer, tôi muốn xuất document ra file Markdown để chia sẻ với các công cụ hỗ trợ Markdown như GitHub hay Obsidian.

#### Acceptance Criteria

1. WHEN người dùng chọn "Export → Markdown" từ menu hoặc Render_Drawer, THE Export_Module SHALL mở Native_File_Dialog để người dùng chọn thư mục và tên file đích.
2. WHEN Native_File_Dialog mở, THE Export_Module SHALL đặt thư mục mặc định theo preference `defaultExportPath` nếu được cấu hình, hoặc thư mục home nếu chưa cấu hình.
3. WHEN người dùng xác nhận đường dẫn, THE Markdown_Serializer SHALL chuyển đổi Document object thành chuỗi Markdown hợp lệ và ghi ra file với encoding UTF-8.
4. WHEN chuyển đổi sang Markdown, THE Markdown_Serializer SHALL bảo toàn toàn bộ nội dung văn bản, tiêu đề, danh sách, và định dạng inline (bold, italic, code).
5. WHEN thao tác Export hoàn tất thành công, THE Export_Module SHALL không thay đổi trạng thái document trong AuraBrain và không cập nhật Dirty_Bit.
6. IF thao tác ghi file thất bại, THEN THE Export_Module SHALL hiển thị thông báo lỗi mô tả rõ nguyên nhân.
7. WHEN người dùng hủy Native_File_Dialog, THE Export_Module SHALL không thực hiện bất kỳ thao tác ghi file nào.
8. WHEN Export_Module xuất file Markdown thành công, THE Export_Module SHALL chèn Aura_Tag vào YAML frontmatter của file với trường `aura_intent_id: {intent_id}` và `aura_exported_at: {timestamp}`.
9. THE Export_Module SHALL đặt YAML frontmatter ở đầu file Markdown theo chuẩn `---\n...\n---`.
10. WHEN người dùng mở file Markdown đã export bằng công cụ khác (Obsidian, VSCode), Aura_Tag SHALL hiển thị như metadata bình thường và không làm hỏng nội dung.

---

### Requirement 7: Export to DOCX

**User Story:** Là một writer, tôi muốn xuất document ra file DOCX để chia sẻ với người dùng Microsoft Word.

#### Acceptance Criteria

1. WHEN người dùng chọn "Export → DOCX" từ menu hoặc Render_Drawer, THE Export_Module SHALL mở Native_File_Dialog để người dùng chọn thư mục và tên file đích.
2. WHEN người dùng xác nhận đường dẫn, THE Export_Module SHALL gửi yêu cầu export đến DOCX_Exporter chạy trên Background_Worker để không chặn main thread.
3. WHEN DOCX_Exporter nhận yêu cầu, THE DOCX_Exporter SHALL chuyển đổi Document object thành file DOCX hợp lệ theo chuẩn Office Open XML.
4. WHEN chuyển đổi sang DOCX, THE DOCX_Exporter SHALL bảo toàn toàn bộ nội dung văn bản, tiêu đề (heading levels), danh sách, và định dạng inline (bold, italic).
5. WHEN thao tác Export hoàn tất thành công, THE Export_Module SHALL không thay đổi trạng thái document trong AuraBrain và không cập nhật Dirty_Bit.
6. IF quá trình tạo DOCX thất bại, THEN THE DOCX_Exporter SHALL trả về lỗi mô tả rõ ràng qua IPC_Bridge và không tạo file không hợp lệ.
7. WHEN Document object chứa Unsupported_Element, THE DOCX_Exporter SHALL xử lý theo Requirement 8 (Import from Legacy File) và hiển thị cảnh báo liệt kê các loại thành phần bị ảnh hưởng.
8. WHEN Export_Module xuất file DOCX thành công, THE DOCX_Exporter SHALL nhúng Aura_Tag vào Custom Document Properties của file DOCX với property name `AuraIntentId` (giá trị: intent_id UUID) và `AuraExportedAt` (giá trị: ISO timestamp).
9. Custom Document Properties SHALL không hiển thị trong nội dung văn bản khi mở bằng Microsoft Word.

---

### Requirement 8: Import from Legacy File

**User Story:** Là một writer, tôi muốn import file `.md` hoặc `.docx` vào WordAI và hệ thống tự nhận ra đây là phiên bản cập nhật của Intent nào, để ý niệm của tôi luôn liền mạch dù đã "du lịch" qua các công cụ khác.

#### Acceptance Criteria

1. WHEN người dùng kích hoạt lệnh "Import from File", THE Export_Module SHALL mở Native_File_Dialog với bộ lọc cho phép chọn file `.md` và `.docx`.
2. WHEN người dùng chọn file `.md`, THE Export_Module SHALL đọc YAML frontmatter để kiểm tra sự tồn tại của trường `aura_intent_id`.
3. WHEN người dùng chọn file `.docx`, THE Export_Module SHALL đọc Custom Document Properties để kiểm tra sự tồn tại của property `AuraIntentId`.
4. WHEN file import có Aura_Tag VÀ `intent_id` tương ứng tồn tại trong AuraBrain, THE Export_Module SHALL hiển thị Replace_Confirmation_Dialog thông báo: "File này thuộc Intent '[Intent_Name]'. Bạn có muốn cập nhật Intent đó với nội dung mới không?" với hai lựa chọn: "Cập nhật Intent" và "Tạo Intent mới".
5. WHEN người dùng chọn "Cập nhật Intent" trong Replace_Confirmation_Dialog, THE AuraBrain_Manager SHALL thay thế `raw_content` của Intent gốc bằng nội dung file import và tăng `version` lên 1, giữ nguyên `intent_id` và `created_at`.
6. WHEN người dùng chọn "Tạo Intent mới" trong Replace_Confirmation_Dialog, THE AuraBrain_Manager SHALL tạo Intent mới với UUID mới, không liên kết với Intent gốc.
7. WHEN file import không có Aura_Tag HOẶC `intent_id` không tồn tại trong AuraBrain, THE AuraBrain_Manager SHALL tạo Intent mới với Intent_Name lấy từ tên file (không có phần mở rộng).
8. WHEN thao tác "Cập nhật Intent" hoàn tất, THE AuraBrain_Manager SHALL mở Intent đó trong Editor_Canvas và xóa Unsaved_Indicator (vì nội dung vừa được sync).
9. IF file được chọn không thể đọc hoặc parse, THEN THE Export_Module SHALL hiển thị thông báo lỗi mô tả rõ nguyên nhân và không tạo hoặc cập nhật Intent nào trong AuraBrain.
10. WHEN file DOCX chứa Unsupported_Element (Table, Image, Comment), THE DOCX_Exporter SHALL chuyển đổi các thành phần đó thành Placeholder trong Document object và hiển thị cảnh báo liệt kê các loại thành phần bị ảnh hưởng.

---

### Requirement 9: Sync Queue & Concurrency

**User Story:** Là một developer, tôi muốn hệ thống xử lý đồng thời các lệnh sync một cách an toàn, để không xảy ra race condition hay dữ liệu bị ghi đè không nhất quán.

#### Acceptance Criteria

1. THE AuraBrain_Manager SHALL duy trì cờ Is_Syncing để theo dõi trạng thái ghi SQLite hiện tại.
2. WHEN AuraBrain_Manager bắt đầu thao tác ghi SQLite, THE AuraBrain_Manager SHALL đặt Is_Syncing thành `true`.
3. WHEN thao tác ghi SQLite kết thúc (thành công hoặc thất bại), THE AuraBrain_Manager SHALL đặt Is_Syncing thành `false`.
4. THE Sync_Queue SHALL lưu tối đa 1 lệnh Sync đang chờ; WHEN một lệnh Sync mới được thêm vào Sync_Queue đã có lệnh đang chờ, THE AuraBrain_Manager SHALL thay thế lệnh cũ bằng lệnh mới.
5. WHEN Is_Syncing chuyển về `false`, THE AuraBrain_Manager SHALL kiểm tra Sync_Queue và xử lý lệnh đang chờ nếu có.
6. THE SQLite_Store SHALL sử dụng SQLite WAL (Write-Ahead Logging) mode để tối ưu hiệu năng ghi đồng thời.
7. WHEN nhiều thao tác đọc xảy ra đồng thời với thao tác ghi, THE SQLite_Store SHALL đảm bảo các thao tác đọc không bị chặn bởi thao tác ghi đang diễn ra.

---

### Requirement 10: Preferences & SettingRegistry

**User Story:** Là một writer, tôi muốn cấu hình hành vi sync và export theo ý muốn, và tìm kiếm các cài đặt này qua Quick Search, để tôi có thể thiết lập workflow phù hợp.

#### Acceptance Criteria

1. THE PreferencesService SHALL hỗ trợ preference `defaultExportPath` kiểu `string` (đường dẫn thư mục mặc định khi Export), mặc định là chuỗi rỗng (sử dụng thư mục home).
2. THE PreferencesService SHALL hỗ trợ preference `defaultExportFormat` kiểu `string` với giá trị hợp lệ là `"markdown"` hoặc `"docx"`, mặc định là `"markdown"`.
3. THE PreferencesService SHALL hỗ trợ preference `autoSyncEnabled` kiểu `boolean`, mặc định là `true`.
4. THE PreferencesService SHALL hỗ trợ preference `autoSyncInterval` kiểu `number` (đơn vị giây) với giá trị hợp lệ từ 5 đến 60.
5. WHEN `autoSyncInterval` được đặt ngoài khoảng từ 5 đến 60, THE PreferencesService SHALL từ chối giá trị và giữ nguyên giá trị hợp lệ trước đó.
6. THE SettingRegistry SHALL chứa SettingEntry cho `general.defaultExportPath` với `label` là "Default Export Path", `tab` là `"general"`, và `keywords` bao gồm `["export path", "default folder", "export location", "thư mục xuất"]`.
7. THE SettingRegistry SHALL chứa SettingEntry cho `general.defaultExportFormat` với `label` là "Default Export Format", `tab` là `"general"`, và `keywords` bao gồm `["export format", "file format", "markdown", "docx", "định dạng xuất"]`.
8. THE SettingRegistry SHALL chứa SettingEntry cho `general.autoSyncEnabled` với `label` là "Auto Sync", `tab` là `"general"`, và `keywords` bao gồm `["auto sync", "autosync", "automatic sync", "tự động đồng bộ"]`.
9. THE SettingRegistry SHALL chứa SettingEntry cho `general.autoSyncInterval` với `label` là "Auto Sync Interval", `tab` là `"general"`, và `keywords` bao gồm `["auto sync interval", "sync frequency", "autosync timer", "khoảng thời gian đồng bộ"]`.
10. WHEN QuickSearch_Popup tìm kiếm với từ khóa liên quan đến sync hoặc export, THE SettingRegistry SHALL trả về ít nhất một trong 4 SettingEntry mới trong kết quả.

---

### Requirement 11: Round-trip Export

**User Story:** Là một developer, tôi muốn đảm bảo dữ liệu document không bị mất khi export và import lại, để người dùng không mất nội dung khi dùng Legacy_Export làm cầu nối với các công cụ khác.

#### Acceptance Criteria

1. THE Markdown_Serializer SHALL đảm bảo rằng với mọi Document object hợp lệ, thao tác serialize sang Markdown rồi parse lại phải tạo ra Document object tương đương về nội dung (round-trip property).
2. THE DOCX_Exporter SHALL đảm bảo rằng với mọi Document object hợp lệ chứa các thành phần WordAI hỗ trợ, thao tác export sang DOCX rồi import lại phải bảo toàn toàn bộ nội dung văn bản và cấu trúc heading.
3. WHEN parse một file Markdown hợp lệ, THE Markdown_Serializer SHALL tạo ra Document object có `content` không rỗng nếu file có nội dung.
4. IF file Markdown có cú pháp không hợp lệ, THEN THE Markdown_Serializer SHALL trả về lỗi mô tả vị trí lỗi trong file thay vì tạo Document object không đầy đủ.
5. WHEN lưu Document object có chứa Placeholder ra file DOCX, THE DOCX_Exporter SHALL khôi phục lại Unsupported_Element gốc từ dữ liệu Placeholder để bảo toàn nội dung không hỗ trợ.
6. WHEN hiển thị cảnh báo về Unsupported_Element, THE Export_Module SHALL thông báo rõ ràng rằng round-trip guarantee chỉ áp dụng cho các thành phần WordAI hỗ trợ.
7. THE Export_Module SHALL không áp dụng round-trip guarantee cho AuraBrain core sync — round-trip chỉ là thuộc tính của Export_Module.
8. THE Export_Module SHALL đảm bảo rằng Aura_Tag được bảo toàn qua round-trip: file export có Aura_Tag → chỉnh sửa bằng công cụ khác → import lại → Aura_Tag vẫn còn nguyên để nhận diện Intent.
9. WHEN Markdown_Serializer parse file `.md` có YAML frontmatter chứa `aura_intent_id`, THE Markdown_Serializer SHALL bảo toàn trường này và không đưa nó vào `raw_content` của Document object.

---

### Requirement 12: AuraBrain Storage Path trong Preferences

**User Story:** Là một writer, tôi muốn xem đường dẫn AuraBrain storage path trong phần Preferences/About, để tôi biết dữ liệu của mình đang được lưu ở đâu và có thể truy cập thư mục đó khi cần.

#### Acceptance Criteria

1. THE PreferencesService SHALL hiển thị đường dẫn AuraBrain storage path đầy đủ trong phần About của Preferences dialog.
2. WHEN người dùng xem phần About trong Preferences, THE PreferencesService SHALL hiển thị đường dẫn tương ứng với platform: `~/Library/Application Support/WordAI/AuraBrain/` (macOS) hoặc `AppData/Local/WordAI/AuraBrain/` (Windows).
3. WHEN người dùng nhấn nút "Reveal in Finder" (macOS) hoặc "Reveal in Explorer" (Windows) bên cạnh đường dẫn, THE PreferencesService SHALL mở thư mục AuraBrain trong file manager của hệ điều hành.
4. IF thư mục AuraBrain chưa tồn tại khi người dùng nhấn nút Reveal, THEN THE PreferencesService SHALL hiển thị thông báo lỗi mô tả rõ nguyên nhân và không mở file manager.
5. THE SettingRegistry SHALL chứa SettingEntry cho thông tin AuraBrain storage path với `label` là "AuraBrain Storage Location", `tab` là `"about"`, và `keywords` bao gồm `["aurabrain", "storage path", "data location", "database path", "nơi lưu dữ liệu", "thư mục dữ liệu"]`.
6. WHEN QuickSearch_Popup tìm kiếm với từ khóa liên quan đến "aurabrain" hoặc "storage", THE SettingRegistry SHALL trả về SettingEntry của AuraBrain storage path trong kết quả.

---

### Requirement 13: Editor Status Bar

**User Story:** Là một writer, tôi muốn thấy trạng thái sync ngay dưới editor mà không cần nhìn lên title bar, để tôi luôn biết document của mình đang ở trạng thái nào mà không bị phân tâm.

#### Acceptance Criteria

1. THE Editor_Status_Bar SHALL hiển thị cố định ở phía dưới Editor_Canvas, luôn hiển thị trong suốt phiên làm việc.
2. WHEN thao tác sync hoàn tất thành công, THE Editor_Status_Bar SHALL hiển thị trạng thái theo định dạng `"Synced · {N}s ago"` trong đó `{N}` là số giây kể từ lần sync gần nhất.
3. WHILE Is_Syncing là `true`, THE Editor_Status_Bar SHALL hiển thị trạng thái `"Syncing..."`.
4. WHEN Dirty_Bit là `true` và Is_Syncing là `false`, THE Editor_Status_Bar SHALL hiển thị trạng thái `"Unsaved changes"`.
5. THE Editor_Status_Bar SHALL không hiển thị đường dẫn AuraBrain storage path trực tiếp trên thanh trạng thái.
6. WHEN người dùng hover chuột vào Editor_Status_Bar, THE Editor_Status_Bar SHALL hiển thị tooltip chứa đường dẫn AuraBrain storage path đầy đủ.
7. THE Editor_Status_Bar SHALL cập nhật thời gian hiển thị trong `"Synced · {N}s ago"` mỗi giây để phản ánh thời gian thực.
8. WHEN document mới được tạo và chưa có lần sync nào, THE Editor_Status_Bar SHALL hiển thị trạng thái `"Unsaved changes"`.

---

### Requirement 14: Unified Document Model Boundary

**User Story:** Là một developer, tôi muốn frontend `Document` và backend `AuraDocument` có ranh giới chuyển đổi rõ ràng, để sync/export/import hoạt động ổn định thay vì phụ thuộc vào shape dữ liệu ngẫu nhiên.

#### Acceptance Criteria

1. THE application SHALL define a single canonical frontend intent model for AuraBrain operations, named `AuraIntentDocument` or equivalent, containing at minimum: `id`, `intentName`, `contentBlocks`, `version`, `createdAt`, `updatedAt`.
2. THE application SHALL provide an adapter `documentToAuraIntent(document)` converting the current editor `Document` into the exact JSON shape expected by Rust `AuraDocument`.
3. THE application SHALL provide an adapter `auraIntentToDocument(auraDocument)` converting Rust `AuraDocument` into the current editor `Document` without losing visible text.
4. THE adapter SHALL map frontend `title` to backend `intent_name` and backend `intent_name` back to frontend `title`.
5. THE adapter SHALL map frontend editor content into `DocumentBlock[]`. If the editor still stores plain string or BlockNote-like JSON as string, THEN the adapter SHALL parse it deterministically into `Paragraph`, `Heading`, `ListItem`, `CodeBlock`, or fallback `Paragraph` blocks.
6. THE adapter SHALL preserve inline formatting when the frontend content contains structured inline spans supported by WordAI.
7. THE adapter SHALL preserve unsupported structured blocks as `Placeholder` only when enough raw data exists to restore them on export/import; otherwise it SHALL degrade to text and add a warning.
8. THE `sync_intent`, `export_markdown`, and `export_docx` IPC calls SHALL receive `AuraDocument` shape, not the legacy frontend `Document` shape.
9. THE TypeScript compiler SHALL reject direct calls that pass legacy `Document` to AuraBrain IPC commands without using the adapter.
10. THE app SHALL include unit tests for all adapter directions: plain paragraph, heading, ordered list, unordered list, code block, empty document, malformed editor content, and Unicode text.
11. THE app SHALL include at least one integration test proving that pressing `Cmd+S` sends `intent_name` and `content: DocumentBlock[]` to `sync_intent`.

---

### Requirement 15: Production Auto-Sync Integration

**User Story:** Là một writer, tôi muốn auto-sync thật sự chạy trong app theo preferences, để nội dung được lưu vào AuraBrain mà không cần nhớ nhấn Cmd+S.

#### Acceptance Criteria

1. THE `App` component SHALL call `useAutoSync` whenever a document is loaded.
2. THE `App` component SHALL load `autoSyncEnabled` and `autoSyncInterval` from `PreferencesService` before enabling interval-based sync.
3. IF preferences cannot be loaded, THEN auto-sync SHALL use defaults: `autoSyncEnabled = true`, `autoSyncInterval = 30`.
4. WHEN preferences are changed in Preferences dialog, THE auto-sync interval SHALL update without requiring app restart.
5. Auto-sync SHALL call the same AuraBrain sync path as `Cmd+S`, including the `Document -> AuraDocument` adapter.
6. Auto-sync SHALL only attempt sync when the document is dirty. It SHALL skip clean documents to avoid unnecessary version increments.
7. Auto-sync SHALL skip while `Is_Syncing = true`.
8. Auto-sync blur handler SHALL obey the 2-second debounce window after any successful sync.
9. IF auto-sync fails, THE app SHALL show a non-blocking notification and keep Dirty_Bit true.
10. THE Editor_Status_Bar and Document_Title_Bar SHALL update when auto-sync starts, succeeds, fails, or is skipped due to clean content.
11. THE app SHALL include tests proving interval sync, blur sync, dirty-only sync, preference changes, debounce behavior, and failure UI.

---

### Requirement 16: Sync State as a React-Observable Source

**User Story:** Là một developer, tôi muốn sync state có thể quan sát được bởi React, để UI không bị lệch với trạng thái thật bên trong AuraBrain_Manager.

#### Acceptance Criteria

1. THE AuraBrain_Manager SHALL expose sync state through a React-compatible subscription API, hook, context, or external store pattern.
2. THE `App`, `DocumentTitleBar`, and `EditorStatusBar` SHALL derive `isSyncing`, `isDirty`, `lastSyncedAt`, and `syncError` from the same source of truth.
3. THE app SHALL not copy `isSyncing` and `lastSyncedAt` manually around `sync()` calls in ways that can diverge from queued sync execution.
4. WHEN a queued sync runs after the first sync returns, THE UI SHALL remain in `Syncing...` until the queued sync completes.
5. WHEN `sync()` returns `{ success: true }` only because a request was queued but not persisted yet, THE UI SHALL not clear Dirty_Bit until actual persistence succeeds.
6. THE store SHALL expose `lastSyncedHashByDocumentId` or reset `lastSyncedHash` whenever switching documents, so dirty state from one document cannot leak into another document.
7. THE store SHALL expose a method to initialize the synced baseline when loading an existing AuraBrain intent.
8. THE store SHALL expose a method to reset sync state when creating a new unsynced intent.
9. THE app SHALL include tests for queued sync UI state, switching documents, creating new document, failed queued sync, and successful queued sync.

---

### Requirement 17: Legacy File Save Removal from Primary Workflow

**User Story:** Là một writer, tôi muốn WordAI không còn behave như editor lưu file truyền thống trong workflow chính, để `Cmd+S` và auto-save luôn có nghĩa là sync vào AuraBrain.

#### Acceptance Criteria

1. THE primary save shortcut `Cmd+S` / `Ctrl+S` SHALL never call legacy `save_document`.
2. THE primary top navigation save/render action SHALL either trigger AuraBrain sync or open the Export/Render drawer explicitly, but SHALL not silently save a legacy JSON document.
3. THE legacy `useAutoSave` hook SHALL be removed from the primary AuraBrain workflow or renamed/scoped as `useLegacyFileAutoSave` if still needed for backward compatibility.
4. THE app SHALL not create or update hidden legacy JSON document files as part of normal typing, Cmd+S, or auto-sync.
5. IF legacy file loading is temporarily retained for migration, THEN it SHALL be clearly separated as an import/migration path and SHALL sync migrated content into AuraBrain.
6. THE state names `hasUnsavedChanges`, `saveError`, `markSaved`, and `markFilePersisted` SHALL either be migrated to AuraBrain terminology or isolated to legacy file code paths.
7. THE UI copy SHALL use "Sync", "Synced", "Unsaved changes", "Export", and "Render" consistently; it SHALL not use "Save file" language for AuraBrain sync.
8. THE app SHALL include regression tests proving that normal editing and `Cmd+S` do not invoke `save_document`.

---

### Requirement 18: Export and Import End-to-End UI

**User Story:** Là một writer, tôi muốn export/import Markdown hoặc DOCX từ UI hiện tại, để có thể dùng WordAI ngay với GitHub, Obsidian, Microsoft Word và các công cụ cũ.

#### Acceptance Criteria

1. THE Render_Drawer SHALL call `exportService.exportMarkdown` when selected format is Markdown.
2. THE Render_Drawer SHALL call `exportService.exportDocx` when selected format is DOCX.
3. THE Render_Drawer SHALL not call a non-existent `export_document` command.
4. THE Render_Drawer SHALL pass the full current document through the `Document -> AuraDocument` adapter before export.
5. THE Render_Drawer SHALL show success feedback after the export IPC command resolves successfully.
6. THE Render_Drawer SHALL show descriptive error feedback when dialog, serialization, DOCX generation, or file write fails.
7. THE Export_Module SHALL choose default export extension based on selected format.
8. THE Export_Module SHALL use `defaultExportPath` preference as the initial dialog path when configured.
9. THE app SHALL provide an Import command reachable from UI, either in Render_Drawer, top nav, or command palette.
10. WHEN import detects Aura_Tag conflict, THE UI SHALL render `ReplaceConfirmationDialog` and block side effects until the user chooses.
11. WHEN user chooses "Cập nhật Intent", THE app SHALL open the updated intent in editor, initialize dirty state as clean, and show latest synced timestamp.
12. WHEN user chooses "Tạo Intent mới", THE app SHALL create and open a new intent with a new UUID, initialize dirty state as clean after sync, and preserve visible imported content.
13. WHEN import returns warnings for unsupported DOCX elements, THE app SHALL show a non-blocking warning with affected element types.
14. THE app SHALL include UI tests for export Markdown, export DOCX, cancel dialog, export failure, import no tag, import tag conflict update, import tag conflict create-new, and import warnings.

---

### Requirement 19: Build, Type Safety, and Release Readiness

**User Story:** Là một developer, tôi muốn feature đạt trạng thái build sạch và có checklist release rõ ràng, để có thể ship bản sử dụng được ngay.

#### Acceptance Criteria

1. `npm run build` in `apps/wordai-editor` SHALL pass with zero TypeScript errors.
2. `npm test` in `apps/wordai-editor` SHALL pass.
3. `cargo test` in `apps/wordai-editor/src-tauri` SHALL pass.
4. THE TypeScript codebase SHALL not rely on undeclared global fields such as `window.__TAURI_INTERNALS__`; platform/runtime detection SHALL use typed Tauri APIs or an app-owned typed helper.
5. All `Record<Tab, ...>` maps SHALL include the `about` tab.
6. Unused imports, unused props, and unused variables introduced by this feature SHALL be removed or intentionally named with an underscore and excluded from lint/build errors according to project policy.
7. THE app SHALL include an end-to-end smoke test or manual QA script covering: create intent, type content, Cmd+S sync, close/reopen app, content restored from AuraBrain, export Markdown, export DOCX, import Markdown, import DOCX.
8. THE release notes for this feature SHALL document that AuraBrain sync is primary storage and Markdown/DOCX are legacy export/import formats.
9. THE spec checklist SHALL not mark completion tasks as `[x]` until build and the release smoke path both pass.

---

### Requirement 20: AuraBrain Startup and Restore Flow

**User Story:** Là một writer, tôi muốn mở app và thấy lại intent gần nhất từ AuraBrain, để WordAI thực sự hoạt động như một intent engine thay vì phụ thuộc vào file path cũ.

#### Acceptance Criteria

1. WHEN the app starts, THE App SHALL attempt to load the last opened AuraBrain intent ID from local preferences or app state.
2. IF last opened intent exists in AuraBrain, THEN THE App SHALL load it via `get_intent` and display it in Editor_Canvas.
3. IF no last opened intent exists, THEN THE App SHALL create a new unsynced intent in memory without writing a legacy file.
4. WHEN a new intent is first synced, THE App SHALL persist its intent ID as the last opened AuraBrain intent ID.
5. WHEN `list_intents` returns existing intents and no last opened ID is available, THE App MAY open the most recently updated intent.
6. IF AuraBrain database initialization fails, THEN THE App SHALL show a blocking error state with retry and reveal diagnostics actions.
7. THE App SHALL not use `wordai_last_document_path` as the primary restore key after AuraBrain migration is complete.
8. THE app SHALL include tests for startup with last intent, startup with missing last intent, startup with empty database, database init failure, and fallback to most recent intent.


---

### Requirement 21: Large File Handling and Streaming Import

**User Story:** Là một writer, tôi muốn import file DOCX lớn (>50MB) mà không bị crash, đợi quá lâu, hoặc làm đơ máy, để tôi có thể làm việc với documents phức tạp từ Microsoft Word.

#### Acceptance Criteria

1. WHEN user selects a file for import, THE Import_Module SHALL check file size before attempting to read the file.
2. WHEN file size exceeds 50MB, THE Import_Module SHALL display a warning dialog showing file size in MB and estimated import time, with options to "Continue" or "Cancel".
3. WHEN file size exceeds 100MB, THE Import_Module SHALL reject the import with an error dialog stating: "File quá lớn ({size}MB). WordAI hiện chỉ hỗ trợ file DOCX tối đa 100MB."
4. WHEN importing a file > 10MB, THE Import_Module SHALL display a progress dialog with: current stage name, progress percentage (0-100), current block/total blocks, and estimated time remaining.
5. WHEN importing DOCX, THE DOCX_Exporter SHALL read the file in chunks of 1MB to avoid loading the entire file into memory at once.
6. WHEN parsing DOCX, THE DOCX_Exporter SHALL process XML nodes incrementally and emit DocumentBlock objects as they are parsed, rather than building the entire document tree in memory.
7. WHEN import progress is displayed, THE Import_Module SHALL update progress through stages: "Reading file", "Parsing DOCX", "Converting blocks", "Saving to AuraBrain".
8. WHEN saving imported content to AuraBrain, THE SQLite_Store SHALL batch-insert DocumentBlocks in groups of 100 blocks per transaction to avoid single massive transactions.
9. WHEN user clicks "Cancel" in the progress dialog, THE Import_Module SHALL stop processing immediately, clean up partial data, and not create or update any Intent in AuraBrain.
10. IF available system memory drops below 200MB during import, THEN THE Import_Module SHALL pause processing and display a memory warning dialog with options to "Continue" or "Cancel".
11. WHEN import completes successfully, THE Import_Module SHALL close the progress dialog and proceed with normal Aura_Tag detection and conflict resolution flow.
12. IF import fails due to memory exhaustion, file corruption, or parsing error, THEN THE Import_Module SHALL display a descriptive error message, clean up partial data, and not leave AuraBrain in an inconsistent state.
13. THE Import_Module SHALL log import performance metrics (file size, parse time, memory peak) to help diagnose performance issues in production.
14. THE app SHALL include property tests validating that import of files up to 50MB does not exceed 500MB peak memory usage.

---

### Requirement 22: Export Size Validation and Streaming

**User Story:** Là một writer, tôi muốn export documents lớn ra DOCX mà không bị crash, để tôi có thể chia sẻ nội dung dài với người dùng Microsoft Word.

#### Acceptance Criteria

1. WHEN user triggers DOCX export, THE Export_Module SHALL estimate the output file size based on current document content length.
2. WHEN estimated export size exceeds 50MB, THE Export_Module SHALL display a warning dialog showing estimated size and export time, with options to "Continue" or "Cancel".
3. WHEN exporting a document with > 10,000 blocks, THE Export_Module SHALL display a progress dialog with: current stage, progress percentage, and estimated time remaining.
4. WHEN generating DOCX, THE DOCX_Exporter SHALL write XML content incrementally to a file stream rather than building the entire DOCX in memory.
5. WHEN export progress is displayed, THE Export_Module SHALL update progress through stages: "Preparing content", "Generating DOCX", "Writing file".
6. WHEN user clicks "Cancel" in the export progress dialog, THE Export_Module SHALL stop processing immediately and delete the partial output file.
7. IF export fails due to disk space, memory exhaustion, or serialization error, THEN THE Export_Module SHALL display a descriptive error message and delete the partial output file.
8. THE Export_Module SHALL not create invalid or corrupted DOCX files; if generation fails partway, the output file SHALL be deleted.
9. THE app SHALL include tests validating that export of documents with 10,000+ blocks does not exceed 500MB peak memory usage.

---

### Requirement 23: Memory Monitoring and Resource Limits

**User Story:** Là một developer, tôi muốn hệ thống giám sát memory usage và áp dụng resource limits, để tránh crash và đảm bảo trải nghiệm ổn định cho người dùng.

#### Acceptance Criteria

1. THE Import_Module và Export_Module SHALL monitor current process memory usage during long-running operations.
2. WHEN memory usage exceeds 80% of available system memory, THE system SHALL log a warning and consider pausing non-critical operations.
3. WHEN memory usage exceeds 90% of available system memory, THE system SHALL pause import/export operations and display a memory warning dialog.
4. THE system SHALL define maximum resource limits: max file size (100MB), max document blocks (50,000), max memory per operation (500MB).
5. WHEN a document exceeds 50,000 blocks, THE system SHALL display a warning that performance may degrade and some features may be limited.
6. THE SQLite_Store SHALL enforce a maximum `raw_content` size of 50MB per intent; attempts to sync larger content SHALL fail with a descriptive error.
7. THE system SHALL include a diagnostic command (accessible via developer menu or command palette) that displays: current memory usage, AuraBrain database size, number of intents, and largest intent size.
8. THE app SHALL include monitoring tests that simulate memory pressure and verify graceful degradation rather than crashes.

---

### Requirement 24: Import/Export Performance Optimization

**User Story:** Là một writer, tôi muốn import/export hoàn tất nhanh chóng, để tôi không phải chờ đợi lâu khi làm việc với documents lớn.

#### Acceptance Criteria

1. WHEN importing DOCX, THE DOCX_Exporter SHALL use parallel processing for independent XML nodes where possible, utilizing multiple CPU cores.
2. WHEN parsing DOCX, THE DOCX_Exporter SHALL skip parsing of unsupported elements (images, tables, comments) beyond extracting their type and creating Placeholder, to reduce processing time.
3. WHEN converting DocumentBlocks, THE adapter SHALL use efficient string operations and avoid unnecessary string copies or allocations.
4. WHEN saving to AuraBrain, THE SQLite_Store SHALL use prepared statements and batch inserts to minimize database round-trips.
5. THE Import_Module SHALL cache parsed DOCX structure to avoid re-parsing if user cancels and retries import of the same file within the same session.
6. THE Export_Module SHALL reuse DOCX templates and XML writers across multiple exports in the same session to reduce initialization overhead.
7. THE system SHALL target import performance of: <5 seconds for 10MB files, <15 seconds for 50MB files, <60 seconds for 100MB files (on modern hardware).
8. THE system SHALL target export performance of: <3 seconds for 1,000 blocks, <10 seconds for 10,000 blocks, <30 seconds for 50,000 blocks.
9. THE app SHALL include performance benchmark tests that measure and report import/export times for various file sizes and block counts.


---

### Requirement 25: Large File Validation

**User Story:** Là một writer, tôi muốn được cảnh báo khi chọn file quá lớn trước khi import, để tôi không bị crash ứng dụng hay đợi quá lâu mà không biết.

#### Acceptance Criteria

1. WHEN người dùng chọn file để import, THE Import_Module SHALL kiểm tra kích thước file trước khi bắt đầu đọc nội dung.
2. WHEN kích thước file nằm trong khoảng từ 20MB đến 100MB, THE Import_Module SHALL hiển thị dialog cảnh báo thông báo kích thước file và thời gian ước tính, cho phép người dùng xác nhận hoặc hủy.
3. WHEN kích thước file vượt quá 100MB, THE Import_Module SHALL từ chối import và hiển thị thông báo lỗi rõ ràng nêu giới hạn kích thước.
4. WHEN người dùng hủy dialog cảnh báo kích thước, THE Import_Module SHALL không thực hiện bất kỳ thao tác đọc file nào.
5. THE Import_Module SHALL hiển thị kích thước file theo định dạng thân thiện (ví dụ: "45.2 MB") trong dialog cảnh báo.
6. WHEN file DOCX được chọn, THE Import_Module SHALL ước tính thời gian import dựa trên kích thước file (công thức: `ceil(size_mb / 5)` giây) và hiển thị trong dialog cảnh báo.
7. THE Import_Module SHALL kiểm tra kích thước file bằng metadata (không đọc nội dung) để tránh tốn memory trước khi user xác nhận.

---

### Requirement 26: Import Progress Indicator

**User Story:** Là một writer, tôi muốn thấy tiến trình import file lớn theo thời gian thực, để tôi biết ứng dụng đang hoạt động và ước tính được khi nào xong.

#### Acceptance Criteria

1. WHEN import file có kích thước lớn hơn 5MB, THE Import_Module SHALL hiển thị progress indicator trong suốt quá trình import.
2. THE progress indicator SHALL hiển thị: giai đoạn hiện tại (`"Reading file..."`, `"Parsing document..."`, `"Converting blocks..."`, `"Saving to AuraBrain..."`), phần trăm hoàn thành (0–100%), và số block đã xử lý trên tổng số block ước tính.
3. WHEN import hoàn tất, THE Import_Module SHALL tự động đóng progress indicator và hiển thị kết quả (thành công hoặc lỗi).
4. THE progress indicator SHALL có nút "Cancel" cho phép người dùng hủy import đang diễn ra.
5. WHEN người dùng nhấn Cancel trong progress indicator, THE Import_Module SHALL dừng xử lý ngay lập tức và dọn dẹp dữ liệu tạm thời.
6. THE Import_Module SHALL emit progress events qua Tauri IPC event system để frontend có thể cập nhật UI mà không block main thread.
7. WHEN import bị cancel, THE Import_Module SHALL không tạo hoặc cập nhật bất kỳ Intent nào trong AuraBrain.

---

### Requirement 27: Chunked DOCX Processing

**User Story:** Là một developer, tôi muốn DOCX_Exporter xử lý file theo từng phần thay vì load toàn bộ vào memory, để ứng dụng không bị crash khi import file lớn.

#### Acceptance Criteria

1. WHEN import file DOCX, THE DOCX_Exporter SHALL đọc và parse file theo từng chunk thay vì load toàn bộ bytes vào memory cùng một lúc.
2. THE DOCX_Exporter SHALL giới hạn memory sử dụng tối đa ở mức 3x kích thước file gốc trong suốt quá trình import.
3. WHEN parse DOCX, THE DOCX_Exporter SHALL emit `ImportProgressEvent` sau mỗi 50 block được xử lý, bao gồm `blocks_processed`, `blocks_estimated`, và `stage`.
4. THE DOCX_Exporter SHALL hỗ trợ cancellation token: khi token bị cancel, DOCX_Exporter SHALL dừng xử lý và trả về `Err(ImportCancelled)`.
5. WHEN import bị cancel, THE DOCX_Exporter SHALL không để lại dữ liệu tạm thời trong memory hay filesystem.
6. THE DOCX_Exporter SHALL lưu DocumentBlock vào AuraBrain theo batch 100 blocks mỗi transaction thay vì một transaction duy nhất cho toàn bộ document, để giảm memory peak.
7. WHEN một batch ghi thất bại, THE DOCX_Exporter SHALL rollback batch đó và trả về lỗi, nhưng các batch đã ghi thành công trước đó SHALL được giữ nguyên (partial import với thông báo rõ ràng).

---

### Requirement 28: Export Progress for Large Documents

**User Story:** Là một writer, tôi muốn thấy tiến trình khi export document lớn sang DOCX, để tôi biết quá trình đang diễn ra và không nhầm tưởng ứng dụng bị treo.

#### Acceptance Criteria

1. WHEN export DOCX cho document có hơn 500 block, THE Export_Module SHALL hiển thị progress indicator.
2. THE progress indicator SHALL hiển thị phần trăm hoàn thành và giai đoạn hiện tại (`"Building document structure..."`, `"Writing DOCX file..."`).
3. THE progress indicator SHALL có nút "Cancel" cho phép hủy export.
4. WHEN export bị cancel, THE Export_Module SHALL xóa file DOCX tạm thời nếu đã tạo và không để lại file không hợp lệ.
5. WHEN export hoàn tất thành công, THE Export_Module SHALL đóng progress indicator và hiển thị thông báo thành công kèm đường dẫn file đã xuất.

---

## Glossary (bổ sung)

- **Import_Progress_Event**: Sự kiện Tauri IPC được emit trong quá trình import file lớn, chứa thông tin về giai đoạn hiện tại, phần trăm hoàn thành, và số block đã xử lý.
- **Cancellation_Token**: Cơ chế `Arc<AtomicBool>` trong Rust cho phép frontend yêu cầu dừng một thao tác import/export đang diễn ra trên background thread.
- **File_Size_Warning_Dialog**: Dialog cảnh báo hiển thị khi file import có kích thước từ 20MB đến 100MB, cho phép người dùng xác nhận hoặc hủy trước khi bắt đầu đọc file.
- **Import_Progress_Dialog**: Dialog hiển thị tiến trình import file lớn (>5MB), bao gồm stage label, progress bar, block count, và nút Cancel.
