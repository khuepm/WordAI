# Kế hoạch triển khai: AuraBrain Persistence & Legacy Export

## Tổng quan

Triển khai hệ thống lưu trữ AuraBrain (SQLite ẩn) thay thế hoàn toàn mô hình lưu file truyền thống. `Cmd+S` đồng bộ vào SQLite local, không mở dialog. Export `.md`/`.docx` là module riêng biệt. Stack: Rust backend (rusqlite/sqlx, docx-rs, pulldown-cmark) + React/TypeScript frontend (Tauri IPC).

## Tasks

- [x] 1. Thiết lập SQLite schema và SQLite_Store (Rust)
  - [x] 1.1 Tạo module `src-tauri/src/sqlite_store.rs` với schema AuraBrain
    - Tạo bảng `intents`: `id` (UUID TEXT PK), `intent_name` (TEXT), `raw_content` (TEXT), `created_at` (INTEGER), `updated_at` (INTEGER), `version` (INTEGER)
    - Tạo bảng `intent_chunks`: `id` (UUID TEXT PK), `document_id` (TEXT FK), `chunk_index` (INTEGER), `chunk_text` (TEXT), `embedding` (BLOB nullable)
    - Bật WAL mode: `PRAGMA journal_mode=WAL`
    - Khởi tạo DB tại đúng platform path: `~/Library/Application Support/WordAI/AuraBrain/` (macOS) hoặc `AppData/Local/WordAI/AuraBrain/` (Windows)
    - _Requirements: 5.1, 5.2, 5.3, 9.6_

  - [x] 1.2 Viết unit test cho SQLite_Store khởi tạo
    - Test DB được tạo đúng path
    - Test WAL mode được bật
    - Test schema tồn tại sau init
    - _Requirements: 5.1, 9.6_

- [x] 2. Implement CRUD operations cho SQLite_Store (Rust)
  - [x] 2.1 Implement `upsert_intent` — ghi document + chunks trong một transaction
    - Dùng `INSERT OR REPLACE` cho bảng `intents`, tăng `version` mỗi lần upsert
    - Xóa chunks cũ và insert chunks mới trong cùng transaction
    - Rollback toàn bộ nếu bất kỳ bước nào thất bại
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 2.2 Implement `get_intent` và `list_intents`
    - `get_intent(id)` → trả về intent với raw_content
    - `list_intents()` → trả về danh sách intent (không kèm raw_content)
    - _Requirements: 5.2_

  - [x] 2.3 Viết property test cho transaction atomicity
    - **Property 1: Atomic Write — nếu upsert thất bại giữa chừng, DB không có dữ liệu nửa vời**
    - **Validates: Requirements 5.4, 5.5, 9.1**

- [x] 3. Thêm Tauri IPC commands cho AuraBrain (Rust)
  - [x] 3.1 Implement `#[tauri::command] sync_intent` — nhận Document JSON, ghi vào SQLite
    - Deserialize Document JSON → gọi `sqlite_store.upsert_intent`
    - Trả về `Ok(version)` hoặc `Err(IPCError)`
    - _Requirements: 1.1, 1.7, 5.4_

  - [x] 3.2 Implement `#[tauri::command] get_intent` và `#[tauri::command] list_intents`
    - _Requirements: 5.2_

  - [x] 3.3 Đăng ký các commands mới vào `tauri::Builder` trong `lib.rs`
    - _Requirements: 1.1_

- [x] 4. Checkpoint — Backend SQLite hoạt động
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [x] 5. Implement AuraBrain_Manager service (TypeScript frontend)
  - [x] 5.1 Tạo `src/services/auraBrainManager.ts` với state management
    - State: `isSyncing: boolean`, `syncQueue: SyncEntry | null`, `lastSyncedHash: string | null`, `lastSyncedAt: number | null`
    - Implement `computeContentHash(content: string): Promise<string>` dùng Web Crypto API (SHA-256)
    - Implement `isDirty(currentContent: string): boolean` — so sánh hash hiện tại với `lastSyncedHash`
    - _Requirements: 1.3, 4.1, 4.2, 4.6_

  - [x] 5.2 Implement `sync(document: Document): Promise<SyncResult>` với Sync_Queue logic
    - Nếu `isSyncing = true`: đưa vào `syncQueue` (thay thế entry cũ nếu có)
    - Nếu `isSyncing = false`: set `isSyncing = true`, gọi IPC `sync_intent`, set `isSyncing = false`
    - Sau khi sync xong: tính `lastSyncedHash`, set `lastSyncedAt = Date.now()`, xử lý `syncQueue` nếu có
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 5.3 Viết unit test cho Sync_Queue logic
    - Test: sync thứ 2 trong khi sync thứ 1 đang chạy → vào queue
    - Test: sync thứ 3 thay thế sync thứ 2 trong queue
    - Test: sau khi sync xong, queue được xử lý
    - _Requirements: 1.5, 1.6, 9.4_

- [x] 6. Implement Auto-sync (TypeScript frontend)
  - [x] 6.1 Mở rộng `src/hooks/useAutoSave.ts` thành `useAutoSync` hook
    - Đọc preferences `autoSyncEnabled` và `autoSyncInterval`
    - Thiết lập interval timer gọi `auraBrainManager.sync()`
    - Lắng nghe window `blur` event → trigger sync ngay lập tức
    - Debounce: bỏ qua blur-triggered sync nếu `Date.now() - lastSyncedAt < 2000`
    - Bỏ qua nếu `isSyncing = true`
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 2.7_

  - [x] 6.2 Viết unit test cho useAutoSync
    - Test: interval trigger gọi sync
    - Test: blur trigger gọi sync
    - Test: debounce window bỏ qua blur trigger
    - Test: không trigger khi `isSyncing = true`
    - _Requirements: 2.1, 2.2, 2.6, 2.7_

- [x] 7. Implement Document_Title_Bar component (TypeScript frontend)
  - [x] 7.1 Tạo `src/components/DocumentTitleBar.tsx`
    - Props: `intentName: string | null`, `isDirty: boolean`, `isSyncing: boolean`
    - Render: `"● {Intent_Name} — WordAI"` khi dirty, `"{Intent_Name} — WordAI"` khi clean
    - Render: `"Untitled Intent — WordAI"` khi `intentName = null`
    - Không bao giờ hiển thị đường dẫn file
    - Cập nhật trong vòng 100ms khi `intentName` thay đổi
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7_

  - [x] 7.2 Viết unit test cho DocumentTitleBar
    - Test: hiển thị đúng format với intent name
    - Test: hiển thị "Untitled Intent" khi null
    - Test: hiển thị `●` khi dirty
    - Test: không hiển thị `●` khi clean
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8. Kết nối Cmd+S với AuraBrain_Manager (TypeScript frontend)
  - [x] 8.1 Cập nhật keyboard shortcut handler trong `App.tsx` hoặc `EditorCanvas.tsx`
    - `Cmd+S` / `Ctrl+S` → gọi `auraBrainManager.sync(currentDocument)` — không mở dialog
    - Truyền `isDirty` và `isSyncing` state xuống `DocumentTitleBar`
    - Hiển thị error notification nếu sync thất bại (không xóa Unsaved_Indicator)
    - _Requirements: 1.1, 1.2, 1.4, 3.3, 3.4_

  - [x] 8.2 Implement Dirty_Bit tracking khi người dùng chỉnh sửa
    - Mỗi khi `document.content` thay đổi → gọi `auraBrainManager.isDirty()` → cập nhật state
    - Khi Undo và hash khớp `lastSyncedHash` → `isDirty = false`
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 9. Checkpoint — Core Sync hoạt động end-to-end
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [x] 10. Implement Markdown_Serializer (Rust)
  - [x] 10.1 Tạo `src-tauri/src/markdown_serializer.rs`
    - `serialize(doc: &Document) -> Result<String, IPCError>`: chuyển Document → Markdown string
    - Bảo toàn: văn bản, tiêu đề (heading levels), danh sách, bold/italic/code inline
    - Chèn YAML frontmatter ở đầu file: `---\naura_intent_id: {id}\naura_exported_at: {ts}\n---`
    - _Requirements: 6.3, 6.4, 6.8, 6.9, 11.1, 11.3_

  - [x] 10.2 Implement `parse(markdown: &str) -> Result<Document, IPCError>` dùng `pulldown-cmark`
    - Đọc YAML frontmatter → extract `aura_intent_id`, không đưa vào `raw_content`
    - Trả về lỗi mô tả vị trí nếu cú pháp không hợp lệ
    - _Requirements: 8.2, 11.3, 11.4, 11.9_

  - [x] 10.3 Viết property test cho Markdown round-trip
    - **Property 2: Round-trip Markdown — serialize(doc) → parse() phải tạo Document tương đương về content**
    - **Validates: Requirements 11.1, 11.3**

  - [x] 10.4 Viết property test cho Aura_Tag preservation qua Markdown
    - **Property 3: Aura_Tag Preservation — file có YAML frontmatter `aura_intent_id` → parse → serialize → vẫn còn `aura_intent_id`**
    - **Validates: Requirements 11.8, 11.9**

- [x] 11. Implement DOCX_Exporter (Rust)
  - [x] 11.1 Tạo `src-tauri/src/docx_exporter.rs`
    - `export(doc: &Document) -> Result<Vec<u8>, IPCError>`: chuyển Document → DOCX bytes dùng `docx-rs`
    - Bảo toàn: văn bản, heading levels, danh sách, bold/italic
    - Nhúng Aura_Tag vào Custom Document Properties: `AuraIntentId` và `AuraExportedAt`
    - Chạy trong `tokio::task::spawn_blocking` để không chặn main thread
    - _Requirements: 7.2, 7.3, 7.4, 7.8, 7.9_

  - [x] 11.2 Implement `import(bytes: &[u8]) -> Result<(Document, Vec<String>), IPCError>`
    - Đọc Custom Document Properties để extract `AuraIntentId`
    - Chuyển đổi Unsupported_Element (Table, Image, Comment) → Placeholder
    - Trả về danh sách loại Unsupported_Element gặp phải
    - _Requirements: 8.3, 8.10, 11.2, 11.5_

  - [x] 11.3 Viết property test cho DOCX round-trip
    - **Property 4: Round-trip DOCX — export(doc) → import() phải bảo toàn toàn bộ văn bản và cấu trúc heading**
    - **Validates: Requirements 11.2_

  - [x] 11.4 Viết property test cho Aura_Tag preservation qua DOCX
    - **Property 5: Aura_Tag DOCX Preservation — export với AuraIntentId → import lại → AuraIntentId vẫn còn**
    - **Validates: Requirements 11.8_

- [x] 12. Thêm IPC commands cho Export/Import (Rust)
  - [x] 12.1 Implement `#[tauri::command] export_markdown` và `#[tauri::command] export_docx`
    - `export_markdown(path, document_json)` → gọi `markdown_serializer::serialize` → ghi file UTF-8
    - `export_docx(path, document_json)` → gọi `docx_exporter::export` → ghi bytes
    - _Requirements: 6.3, 7.2, 7.3_

  - [x] 12.2 Implement `#[tauri::command] import_file`
    - Detect format từ extension (`.md` / `.docx`)
    - Gọi đúng parser, trả về `(Document, Vec<String> warnings)`
    - _Requirements: 8.1, 8.2, 8.3, 8.9_

  - [x] 12.3 Đăng ký các commands mới vào `tauri::Builder`
    - _Requirements: 6.1, 7.1, 8.1_

- [x] 13. Implement Export_Module frontend (TypeScript)
  - [x] 13.1 Tạo `src/services/exportService.ts`
    - `exportMarkdown(document)`: mở Native_File_Dialog (Tauri dialog plugin) → gọi IPC `export_markdown`
    - `exportDocx(document)`: mở Native_File_Dialog → gọi IPC `export_docx`
    - Đặt default path từ preference `defaultExportPath`
    - Không thay đổi AuraBrain state sau khi export
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 7.1, 7.5_

  - [x] 13.2 Implement `importFile()`
    - Mở Native_File_Dialog với filter `.md` và `.docx`
    - Gọi IPC `import_file` → nhận `(Document, warnings)`
    - Hiển thị warnings nếu có Unsupported_Element
    - _Requirements: 8.1, 8.9, 8.10_

- [x] 14. Implement Replace_Confirmation_Dialog (TypeScript frontend)
  - [x] 14.1 Tạo `src/components/ReplaceConfirmationDialog.tsx`
    - Hiển thị khi import file có Aura_Tag trùng với Intent đã tồn tại trong AuraBrain
    - Hai lựa chọn: "Cập nhật Intent" và "Tạo Intent mới"
    - _Requirements: 8.4_

  - [x] 14.2 Kết nối dialog với import flow trong `exportService.ts`
    - Sau khi `import_file` trả về Document có `aura_intent_id`: kiểm tra AuraBrain có intent đó không
    - Nếu có → hiển thị `ReplaceConfirmationDialog`
    - "Cập nhật Intent" → gọi `auraBrainManager.sync()` với intent gốc (giữ nguyên id)
    - "Tạo Intent mới" → tạo UUID mới, gọi `auraBrainManager.sync()`
    - Sau khi "Cập nhật Intent": mở intent trong Editor_Canvas, xóa Unsaved_Indicator
    - _Requirements: 8.4, 8.5, 8.6, 8.7, 8.8_

- [x] 15. Cập nhật Preferences và SettingRegistry (TypeScript frontend)
  - [x] 15.1 Mở rộng `src/types/preferences.ts`
    - Thêm vào `Preferences.general`: `defaultExportPath: string`, `defaultExportFormat: 'markdown' | 'docx'`, `autoSyncEnabled: boolean`, `autoSyncInterval: number`
    - Thêm vào `defaultPreferences.general`: giá trị mặc định tương ứng
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 15.2 Thêm 4 SettingEntry mới vào `src/data/settingRegistry.ts`
    - `general.defaultExportPath`: label "Default Export Path", keywords `["export path", "default folder", "export location", "thư mục xuất"]`
    - `general.defaultExportFormat`: label "Default Export Format", keywords `["export format", "file format", "markdown", "docx", "định dạng xuất"]`
    - `general.autoSyncEnabled`: label "Auto Sync", keywords `["auto sync", "autosync", "automatic sync", "tự động đồng bộ"]`
    - `general.autoSyncInterval`: label "Auto Sync Interval", keywords `["auto sync interval", "sync frequency", "autosync timer", "khoảng thời gian đồng bộ"]`
    - _Requirements: 10.6, 10.7, 10.8, 10.9_

  - [x] 15.3 Thêm validation cho `autoSyncInterval` trong PreferencesService
    - Từ chối giá trị ngoài khoảng 5–60, giữ nguyên giá trị hợp lệ trước đó
    - _Requirements: 10.4, 10.5_

  - [x] 15.4 Viết unit test cho SettingRegistry entries mới
    - Test: QuickSearch với "auto sync" trả về ít nhất 1 entry mới
    - Test: QuickSearch với "export" trả về ít nhất 1 entry mới
    - Test: validation `autoSyncInterval` từ chối giá trị < 5 và > 60
    - _Requirements: 10.5, 10.10_

- [~] 16. Checkpoint cuối — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

## Ghi chú

- Tasks đánh dấu `*` là optional, có thể bỏ qua để ra MVP nhanh hơn
- Thứ tự dependency: Rust backend (Tasks 1–3) → Frontend core (Tasks 5–8) → Export module (Tasks 10–14) → Preferences (Task 15)
- Property tests (Tasks 2.3, 5.3, 10.3, 10.4, 11.3, 11.4) validate các invariant quan trọng nhất của hệ thống
- Round-trip guarantee chỉ áp dụng cho Export_Module, không áp dụng cho AuraBrain core sync (Req 11.7)
