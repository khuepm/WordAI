# Implementation Plan: Prism Multi-Variant Editor

## Overview

Triển khai Prism Multi-Variant Editor theo 6 milestone tuần tự: Foundation (types + hook + skeleton), Multi-slot layout, Code view + Markdown round-trip, .aura bundle persistence, AuraSphere wiring, và Polish (keyboard shortcuts, sync scroll, accessibility, perf). Mỗi milestone xây dựng trên milestone trước, đảm bảo không có code orphan. Sử dụng TypeScript, React 18, CodeMirror 6, zod, Vitest + fast-check.

## Tasks

- [x] 1. M1 — Foundation: Types, usePrismState, skeleton PrismCanvas
  - [x] 1.1 Cài đặt dependencies mới
    - Chạy `npm install @codemirror/view @codemirror/state @codemirror/lang-markdown @codemirror/lang-html @codemirror/lang-json zod` trong `apps/wordai-editor`
    - _Requirements: (infrastructure)_

  - [x] 1.2 Tạo type definitions tại `src/components/prism/types.ts`
    - Định nghĩa `PrismSlotIndex`, `PrismViewMode`, `PrismCodeSubTab`
    - Định nghĩa `PrismVariant` interface với id, label, blockContent, source, promptRef, pinned, dirty
    - Định nghĩa `PrismState` interface với slots, modes, codeSubTabs, focusedSlot, syncScroll
    - Định nghĩa `PrismSourceFormat` discriminated union (markdown/html/docx/aura)
    - Định nghĩa `AuraBundle`, `AuraVariantEntry`, `AuraSphereSuggestion` interfaces
    - _Requirements: 1.2, 1.3, 5.6, 8.5_

  - [x] 1.3 Tạo `usePrismState` hook tại `src/components/prism/usePrismState.ts`
    - Khởi tạo state với slot 0 chứa variant chính từ initialContent, slot 1-2 null
    - Implement `addVariant`: clone slot 0 content vào slot trống có index thấp nhất
    - Implement `discardVariant`: set slot thành null (từ chối nếu slotIndex === 0)
    - Implement `updateVariantContent`: cập nhật blockContent cho slot chỉ định
    - Implement `setViewMode`, `setCodeSubTab`, `setFocus`, `toggleSyncScroll`
    - Chưa implement promote, pin, AuraSphere (milestone sau)
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 1.7, 7.6, 7.7_

  - [x] 1.4 Viết property test cho slot structural invariant
    - **Property 2: Slot Structural Invariant** — sau mọi operation, slots.length === 3, slot 0 !== null, active count ∈ [1,3]
    - **Validates: Requirements 1.2, 1.3**

  - [x] 1.5 Viết property test cho add variant lowest-index placement
    - **Property 10: Add Variant Lowest-Index Placement** — addVariant đặt variant vào slot trống có index thấp nhất
    - **Validates: Requirements 1.4**

  - [x] 1.6 Tạo skeleton `PrismCanvas` tại `src/components/prism/PrismCanvas.tsx`
    - Nhận props tương thích với EditorCanvasProps hiện tại + auraSuggestion
    - Gọi `usePrismState` với document.id và document.content
    - Render 1 `EditorCanvas` (slot 0) bọc trong layout container
    - Forward tất cả props cần thiết (onDocumentChange, onAITrigger, fontSize, v.v.)
    - Export component để sẵn sàng thay thế EditorCanvas trong App.tsx
    - _Requirements: 1.1, 1.3_

- [~] 2. Checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [ ] 3. M2 — Multi-slot layout, add/discard actions
  - [x] 3.1 Implement layout đa cột trong `PrismCanvas`
    - Sử dụng CSS Grid với `gridTemplateColumns: repeat(N, 1fr)` dựa trên số slot active
    - Thêm CSS transition cho layout shift (< 50ms)
    - Đảm bảo không unmount/remount EditorCanvas khi thêm/xóa variant (giữ React key ổn định)
    - _Requirements: 1.1, 11.4, 11.5_

  - [x] 3.2 Tạo `PrismToolbar` tại `src/components/prism/PrismToolbar.tsx`
    - Nút "+ Variant" gọi addVariant, disabled khi variantCount === 3 với tooltip "Tối đa 3 biến thể"
    - Toggle sync scroll on/off
    - Hiển thị số variant hiện tại
    - _Requirements: 1.5, 9.3_

  - [x] 3.3 Tạo skeleton `PrismVariantPane` tại `src/components/prism/PrismVariantPane.tsx`
    - Render tab bar (Preview | Code) với indicator active
    - Khi Preview: mount EditorCanvas với variant.blockContent
    - Hiển thị label, pin status badge, dirty indicator
    - Nút Discard (disabled cho slot 0), nút Promote, nút Pin
    - _Requirements: 2.1, 2.5, 2.6, 7.6_

  - [~] 3.4 Wire PrismCanvas vào App.tsx thay thế EditorCanvas
    - Import PrismCanvas và thay thế `<EditorCanvas .../>` bằng `<PrismCanvas .../>`
    - Truyền tất cả props hiện có + auraSuggestion (null ban đầu)
    - _Requirements: 1.1_

  - [~] 3.5 Viết unit tests cho PrismToolbar và PrismVariantPane
    - Test nút "+ Variant" disabled khi 3 slot active
    - Test discard variant ở slot 1/2 → slot thành null
    - Test discard variant ở slot 0 → không thay đổi
    - _Requirements: 1.5, 1.6, 1.7_

- [~] 4. Checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [ ] 5. M3 — Code view + Markdown round-trip
  - [~] 5.1 Tạo `blockToMarkdown` tại `src/utils/blockToMarkdown.ts`
    - Implement chuyển đổi cho tất cả supported block types: header, paragraph, list, quote, todo, code
    - Unsupported block types → fenced code block chứa JSON (lossy-safe)
    - _Requirements: 4.4, 4.6_

  - [~] 5.2 Tạo `markdownToBlock` tại `src/utils/markdownToBlock.ts`
    - Parse heading (h1-h6), paragraph, list (ordered/unordered), quote, todo, code block
    - Mỗi block được gán unique ID (crypto.randomUUID)
    - Throw ParseError nếu gặp cấu trúc không parse được
    - _Requirements: 4.5, 4.7_

  - [~] 5.3 Viết property test cho round-trip text preservation
    - **Property 1: Round-trip Text Preservation** — blockToMarkdown → markdownToBlock bảo toàn toàn bộ plain text
    - **Validates: Requirements 4.4, 4.5, 4.6**

  - [~] 5.4 Viết property test cho parse error state preservation
    - **Property 8: Parse Error State Preservation** — invalid markdown → giữ nguyên blockContent cũ
    - **Validates: Requirements 4.7, 10.2**

  - [~] 5.5 Tạo `PrismCodeView` tại `src/components/prism/PrismCodeView.tsx`
    - Mount CodeMirror 6 với language mode phù hợp (markdown/xml/html/json)
    - Lazy load — chỉ mount khi user mở Code view
    - Emit onChange với debounce 500ms nội bộ
    - OOXML và .aura sub-tab luôn readonly
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [~] 5.6 Implement view toggle trong `PrismVariantPane`
    - Khi chuyển sang Code: gọi blockToMarkdown và truyền cho PrismCodeView
    - Khi chuyển sang Preview: gọi markdownToBlock và cập nhật EditorCanvas
    - Debounce 500ms cho mỗi hướng chuyển đổi
    - Sử dụng requestIdleCallback để không block main thread
    - _Requirements: 2.2, 2.3, 4.1, 4.2, 4.3, 4.8, 11.2_

  - [~] 5.7 Implement error banner trong `PrismCodeView`
    - Hiển thị error banner khi markdownToBlock parse thất bại
    - Ẩn banner trong 300ms khi parse thành công sau lỗi
    - Giữ nguyên blockContent cũ khi parse lỗi
    - _Requirements: 10.1, 10.2, 10.3_

  - [~] 5.8 Implement sub-tabs trong `PrismCodeView`
    - Hiển thị sub-tabs dựa trên PrismSourceFormat: Markdown, HTML, OOXML, .aura
    - Giữ scroll position riêng cho từng sub-tab
    - _Requirements: 3.1, 3.6_

  - [~] 5.9 Viết unit tests cho blockToMarkdown và markdownToBlock
    - Test từng block type: heading h1-h6, paragraph, ordered/unordered list, quote, todo, code block
    - Test unsupported block type → fenced code block JSON
    - Test empty input → []
    - _Requirements: 4.4, 4.5, 4.6, 4.7_

- [~] 6. Checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [ ] 7. M4 — .aura bundle: schema (zod), auraBundleService load/save, sub-tab .aura
  - [~] 7.1 Tạo `auraSchema` tại `src/utils/auraSchema.ts`
    - Định nghĩa zod schema cho AuraBundle v1 với tất cả trường bắt buộc
    - Validate: $schema URL, version === 1, intentId không rỗng, lastModified ISO 8601
    - Validate: promotedVariantId match variant.id nếu không null
    - Validate: variants tối đa 50 entries
    - Export schema và inferred type
    - _Requirements: 5.2, 5.6, 5.8, 5.9_

  - [~] 7.2 Tạo `auraBundleService` tại `src/services/auraBundleService.ts`
    - Implement `loadBundle(intentId)`: đọc file từ `{appDataDir}/aura/{intentId}.aura.json`
    - Validate bundle với auraSchema, trả về null nếu invalid hoặc file không tồn tại
    - Implement `saveBundle(bundle)`: validate rồi ghi file (overwrite strategy)
    - Sử dụng Tauri fs API để đọc/ghi file
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.7_

  - [~] 7.3 Viết property test cho AuraBundle schema validity
    - **Property 6: AuraBundle Schema Validity** — sau mọi mutation, bundle luôn pass auraSchema validation
    - **Validates: Requirements 5.2, 5.4, 5.5, 5.6**

  - [~] 7.4 Tạo `intentSourceService` tại `src/services/intentSourceService.ts`
    - Implement `detectSource(intent)`: kiểm tra sourcePath extension trước, rồi bundle
    - Case-insensitive extension matching
    - Không bao giờ throw — fallback sang kind 'markdown'
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [~] 7.5 Viết property test cho source detection determinism
    - **Property 7: Source Detection Determinism** — detectSource trả về kind tương ứng extension, không throw
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.6**

  - [~] 7.6 Kết nối usePrismState với auraBundleService
    - Load bundle khi init state (nếu có)
    - Save bundle sau mỗi thay đổi variant (debounce)
    - Implement retry logic: tối đa 3 lần retry khi save thất bại
    - Hiển thị toast notification khi save thất bại
    - _Requirements: 5.1, 10.5, 10.6, 10.7_

  - [~] 7.7 Implement .aura sub-tab content trong PrismCodeView
    - Hiển thị AuraBundle JSON (readonly) khi sub-tab .aura active
    - Sử dụng @codemirror/lang-json cho syntax highlighting
    - _Requirements: 3.1, 3.2_

  - [~] 7.8 Viết unit tests cho auraBundleService và intentSourceService
    - Test loadBundle trả về null khi file không tồn tại
    - Test loadBundle trả về null khi file corrupt
    - Test saveBundle ghi file thành công
    - Test detectSource cho mỗi extension (.docx, .md, .markdown, .html, .htm)
    - Test detectSource fallback khi không có sourcePath
    - _Requirements: 5.4, 5.5, 6.1, 6.2, 6.3, 6.5_

- [~] 8. Checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [ ] 9. M5 — AuraSphere wiring: panel generates ≥2 variants, fill slots, Pin/Promote
  - [~] 9.1 Implement `addAuraSphereVariants` trong usePrismState
    - Nhận AuraSphereSuggestion, validate từng variant (label không rỗng, markdown parse được)
    - Phân phối vào slot trống theo thứ tự index tăng dần
    - Bỏ qua slot pinned, slot 0 có content, slot dirty
    - Bỏ qua variant không hợp lệ, tiếp tục xử lý variant còn lại
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8_

  - [~] 9.2 Implement `promoteVariant` trong usePrismState
    - Set promotedVariantId = variant.id
    - Cập nhật bundle.markdown = blockToMarkdown(variant.blockContent)
    - Archive tất cả variant khác không pinned (set archivedAt)
    - Reset state: slot 0 = promoted content, clear slot không pinned
    - Giữ nguyên slot pinned
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [~] 9.3 Implement `pinVariant` / `unpinVariant` trong usePrismState
    - Toggle pinned flag trên variant
    - Variant pinned không bị archive khi promote, không bị ghi đè bởi AuraSphere
    - _Requirements: 7.5, 7.8_

  - [~] 9.4 Viết property test cho promote correctness
    - **Property 3: Promote Correctness** — sau promote: promotedVariantId đúng, markdown đúng, state về 1 slot active
    - **Validates: Requirements 7.1, 7.2, 7.4**

  - [~] 9.5 Viết property test cho pin/protected slot invariant
    - **Property 4: Pin/Protected Slot Invariant** — slot pinned không bị ghi đè bởi AuraSphere hoặc archive bởi promote
    - **Validates: Requirements 7.3, 7.5, 8.2, 8.3, 8.4**

  - [~] 9.6 Viết property test cho archive idempotency
    - **Property 5: Archive Idempotency** — variant đã archived không bị thay đổi archivedAt khi promote lại
    - **Validates: Requirements 7.3**

  - [~] 9.7 Viết property test cho AuraSphere partial failure resilience
    - **Property 9: AuraSphere Partial Failure Resilience** — chỉ variant parse thành công được thêm, variant lỗi bị bỏ qua
    - **Validates: Requirements 10.8**

  - [~] 9.8 Wire AuraSphere suggestion vào PrismCanvas
    - Nhận auraSuggestion prop, gọi addAuraSphereVariants khi có suggestion mới
    - Hiển thị toast nếu tất cả variant parse thất bại
    - Disable nút Promote khi chỉ có 1 variant active
    - _Requirements: 8.1, 8.7, 7.9, 10.9_

  - [~] 9.9 Viết unit tests cho promote, pin, AuraSphere integration
    - Test promote slot 2 → state về 1 slot, content đúng
    - Test pin variant → AuraSphere push không ghi đè
    - Test AuraSphere suggestion với 2 variant → fill 2 slot trống
    - Test tất cả slot đầy → variant thừa bị bỏ qua
    - _Requirements: 7.1, 7.5, 8.1, 8.6_

- [~] 10. Checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

- [ ] 11. M6 — Polish: keyboard shortcuts, sync scroll, accessibility, perf review
  - [~] 11.1 Implement sync scroll giữa các pane
    - Khi syncScroll bật: scroll 1 pane → cập nhật tất cả pane khác theo % scrollTop
    - Đồng bộ trong vòng 100ms
    - Khi toggle bật: đồng bộ tất cả pane về % scrollTop của focusedSlot
    - Hoạt động cho cả Preview và Code view
    - _Requirements: 9.1, 9.2, 9.4, 9.5_

  - [~] 11.2 Implement keyboard shortcuts
    - `Cmd+1/2/3`: chuyển focus slot
    - `Cmd+Enter`: thêm variant mới
    - Chỉ gắn keyboard listeners cho slot đang focus
    - Các EditorCanvas ngoài focus render read-only (không đăng ký keyboard listeners global)
    - _Requirements: 11.1_

  - [~] 11.3 Implement scroll position preservation khi toggle view mode
    - Lưu % scrollTop trước khi chuyển view
    - Khôi phục % scrollTop sau khi mount view mới (sai lệch tối đa 5%)
    - _Requirements: 2.4_

  - [~] 11.4 Accessibility review và cải thiện
    - Thêm aria-labels cho tất cả interactive elements
    - Đảm bảo tab navigation hoạt động đúng giữa các pane
    - Thêm role và aria-live cho error banners và toast notifications
    - _Requirements: 10.1, 10.5_

  - [~] 11.5 Performance review và optimization
    - Verify CodeMirror lazy load (không mount khi Preview)
    - Verify CSS Grid transition không unmount existing panes
    - Verify requestIdleCallback cho transform pipeline
    - Verify layout shift < 50ms, first paint 3 pane < 1000ms
    - _Requirements: 11.2, 11.3, 11.4, 11.5, 11.6_

  - [~] 11.6 Viết integration tests cho keyboard shortcuts và sync scroll
    - Test Cmd+1/2/3 chuyển focus
    - Test sync scroll toggle → scroll đồng bộ
    - Test view toggle giữ scroll position
    - _Requirements: 9.1, 9.2, 11.1_

- [~] 12. Final checkpoint — Đảm bảo tất cả tests pass
  - Đảm bảo tất cả tests pass, hỏi người dùng nếu có thắc mắc.

## Notes

- Các task đánh dấu `*` là optional và có thể bỏ qua để đẩy nhanh MVP
- Mỗi task tham chiếu requirements cụ thể để đảm bảo traceability
- Checkpoints đảm bảo validation tăng dần sau mỗi milestone
- Property tests validate các correctness properties từ design document
- Unit tests validate các ví dụ cụ thể và edge cases
- Dependencies mới (CodeMirror, zod) được cài ở task đầu tiên để tất cả milestone sau đều sử dụng được

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.6"] },
    { "id": 3, "tasks": ["1.4", "1.5"] },
    { "id": 4, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 5, "tasks": ["3.4", "3.5"] },
    { "id": 6, "tasks": ["5.1", "5.2"] },
    { "id": 7, "tasks": ["5.3", "5.4", "5.5", "5.9"] },
    { "id": 8, "tasks": ["5.6", "5.7", "5.8"] },
    { "id": 9, "tasks": ["7.1", "7.4"] },
    { "id": 10, "tasks": ["7.2", "7.5"] },
    { "id": 11, "tasks": ["7.3", "7.6", "7.7"] },
    { "id": 12, "tasks": ["7.8"] },
    { "id": 13, "tasks": ["9.1", "9.2", "9.3"] },
    { "id": 14, "tasks": ["9.4", "9.5", "9.6", "9.7"] },
    { "id": 15, "tasks": ["9.8", "9.9"] },
    { "id": 16, "tasks": ["11.1", "11.2", "11.3"] },
    { "id": 17, "tasks": ["11.4", "11.5", "11.6"] }
  ]
}
```
