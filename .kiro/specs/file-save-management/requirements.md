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
