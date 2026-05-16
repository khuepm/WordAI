# Requirements Document

## Introduction

Prism Multi-Variant Editor là tính năng cho phép người dùng WordAI Editor chỉnh sửa và so sánh đồng thời tối đa 3 biến thể (variant) nội dung cạnh nhau. Prism bọc ngoài `EditorCanvas` hiện tại, cung cấp layout đa cột, chế độ xem Preview/Code, pipeline chuyển đổi Block JSON ↔ Markdown, và tích hợp AuraSphere để nhận variant do AI sinh ra. Dữ liệu variant được lưu trữ trong `.aura` bundle với chiến lược overwrite.

---

## Glossary

- **PrismCanvas**: Root component quản lý layout đa cột và dispatch các action chính (add/discard/promote variant).
- **PrismVariantPane**: Component đại diện cho một cột trong layout, chứa view tabs (Preview/Code) và render nội dung variant.
- **PrismCodeView**: Component code editor sử dụng CodeMirror 6, hiển thị nội dung dưới dạng Markdown/OOXML/HTML/.aura với syntax highlighting.
- **PrismToolbar**: Component header chung chứa nút thêm variant, toggle sync scroll.
- **usePrismState**: Hook quản lý toàn bộ state của Prism — slots, modes, focus, và đồng bộ với auraBundleService.
- **PrismVariant**: Đối tượng đại diện cho một biến thể nội dung, chứa blockContent, label, source, và trạng thái pin/dirty.
- **PrismState**: Trạng thái runtime gồm 3 slots, modes, codeSubTabs, focusedSlot, và syncScroll.
- **AuraBundle**: File JSON lưu trữ các variant của một Intent, theo schema v1.
- **AuraSphere**: Module AI sinh variant nội dung, trả về AuraSphereSuggestion chứa 1-3 variant.
- **Block_JSON**: Định dạng JSON nội bộ của react-block-text dùng để render Preview.
- **Markdown**: Định dạng văn bản thuần dùng trong Code view và làm canonical format trong .aura bundle.
- **Intent**: Đơn vị nội dung chính trong WordAI, là nguồn dữ liệu gốc cho variant.
- **Transform_Pipeline**: Hệ thống chuyển đổi hai chiều giữa Block JSON và Markdown với debounce 500ms.
- **intentSourceService**: Service phát hiện định dạng nguồn của Intent (markdown/html/docx/aura).

---

## Requirements

### Requirement 1: Layout đa cột và quản lý variant

**User Story:** As a người dùng WordAI Editor, I want xem và chỉnh sửa nhiều biến thể nội dung cạnh nhau, so that tôi có thể so sánh và chọn phiên bản tốt nhất.

#### Acceptance Criteria

1. THE PrismCanvas SHALL hiển thị layout với số cột bằng đúng số slot không null (1 slot active = 1 cột, 2 slot active = 2 cột, 3 slot active = 3 cột), các cột có chiều rộng bằng nhau.
2. THE PrismState SHALL duy trì mảng slots có độ dài cố định bằng 3, trong đó slot null biểu thị slot trống.
3. THE PrismState SHALL đảm bảo slot 0 luôn chứa variant chính (không bao giờ null).
4. WHEN người dùng nhấn nút "+ Variant", THE PrismCanvas SHALL tạo variant mới với nội dung là bản sao của variant chính (slot 0) và đặt vào slot trống có index thấp nhất.
5. WHILE đã có 3 variant active, THE PrismToolbar SHALL vô hiệu hóa nút "+ Variant" và hiển thị tooltip "Tối đa 3 biến thể".
6. WHEN người dùng discard một variant ở slot 1 hoặc slot 2, THE usePrismState SHALL đặt slot tương ứng thành null và PrismCanvas giảm số cột layout tương ứng.
7. IF người dùng thực hiện thao tác discard trên variant chính (slot 0), THEN THE PrismCanvas SHALL không thực hiện thao tác và giữ nguyên trạng thái hiện tại.

---

### Requirement 2: Chuyển đổi chế độ xem (Preview/Code)

**User Story:** As a người dùng, I want chuyển đổi giữa chế độ Preview và Code cho từng variant, so that tôi có thể xem nội dung dưới dạng WYSIWYG hoặc mã nguồn.

#### Acceptance Criteria

1. THE PrismVariantPane SHALL hiển thị tab bar với hai chế độ: Preview và Code, trong đó tab đang active được phân biệt trực quan với tab không active.
2. WHEN người dùng chọn tab Preview, THE PrismVariantPane SHALL render EditorCanvas với blockContent của variant.
3. WHEN người dùng chọn tab Code, THE PrismVariantPane SHALL render PrismCodeView với nội dung Markdown được chuyển đổi từ blockContent hiện tại của variant.
4. WHEN người dùng chuyển đổi giữa Preview và Code, THE PrismVariantPane SHALL khôi phục scroll position theo tỷ lệ phần trăm scrollTop (sai lệch tối đa 5% so với vị trí trước khi chuyển).
5. THE PrismVariantPane SHALL cho phép mỗi pane có chế độ xem độc lập (pane 1 ở Preview trong khi pane 2 ở Code).
6. WHEN một PrismVariantPane được mount lần đầu, THE PrismVariantPane SHALL mặc định hiển thị ở chế độ Preview.

---

### Requirement 3: Code view với sub-tabs

**User Story:** As a người dùng, I want xem nội dung dưới nhiều định dạng mã nguồn khác nhau, so that tôi có thể kiểm tra và chỉnh sửa nội dung ở định dạng phù hợp.

#### Acceptance Criteria

1. WHEN người dùng chuyển sang Code view, THE PrismCodeView SHALL hiển thị các sub-tabs tương ứng với nguồn của Intent: chỉ "Markdown" nếu nguồn là .md, chỉ "HTML" nếu nguồn là .html, chỉ "OOXML" nếu nguồn là .docx, và "Markdown" cùng ".aura" nếu nguồn là AuraSphere synthesis.
2. WHILE sub-tab OOXML hoặc sub-tab .aura đang active, THE PrismCodeView SHALL hiển thị nội dung ở chế độ readonly và không cho phép chỉnh sửa.
3. WHEN người dùng chỉnh sửa nội dung trong sub-tab có quyền edit (Markdown hoặc HTML), THE PrismCodeView SHALL emit onChange event với nội dung mới sau khoảng debounce 500ms kể từ lần gõ cuối cùng.
4. THE PrismCodeView SHALL sử dụng CodeMirror 6 với language mode phù hợp cho từng sub-tab: markdown cho Markdown, xml cho OOXML, html cho HTML, json cho .aura.
5. WHEN người dùng chuyển từ Preview sang Code view lần đầu trong session, THE PrismCodeView SHALL mount CodeMirror instance (lazy load) trong thời gian không quá 300ms trên thiết bị đạt cấu hình tối thiểu.
6. WHEN người dùng chuyển giữa các sub-tabs, THE PrismCodeView SHALL giữ nguyên scroll position riêng của từng sub-tab và không reload nội dung.

---

### Requirement 4: Pipeline chuyển đổi Block JSON ↔ Markdown

**User Story:** As a người dùng, I want nội dung tự động đồng bộ giữa Preview và Code view, so that thay đổi ở một chế độ được phản ánh ở chế độ kia.

#### Acceptance Criteria

1. WHEN người dùng chỉnh sửa trong Preview, THE Transform_Pipeline SHALL chuyển đổi block content sang Markdown sau debounce 500ms và cập nhật Code view với kết quả Markdown.
2. WHEN người dùng chỉnh sửa Markdown trong Code view, THE Transform_Pipeline SHALL chuyển đổi Markdown sang mảng Block JSON sau debounce 500ms và cập nhật Preview với kết quả block content.
3. THE Transform_Pipeline SHALL thực hiện parsing không đồng bộ sao cho main thread không bị block quá 50ms cho mỗi lần chuyển đổi.
4. THE blockToMarkdown SHALL chuyển đổi tất cả block types được hỗ trợ (heading, paragraph, list_item, code_block, quote, todo) sang cú pháp Markdown tương ứng, đảm bảo round-trip conversion block→markdown→block giữ nguyên nội dung text và cấu trúc block type cho các supported types.
5. THE markdownToBlock SHALL parse cú pháp Markdown thành mảng Block JSON, trong đó mỗi block được gán một unique ID dạng string không trùng lặp trong cùng document.
6. IF blockToMarkdown nhận block type không nằm trong danh sách supported types, THEN THE Transform_Pipeline SHALL render block đó thành fenced code block có ngôn ngữ "json" chứa toàn bộ JSON representation của block, để có thể khôi phục nguyên trạng khi parse ngược.
7. IF markdownToBlock gặp đoạn Markdown không khớp với bất kỳ pattern nào được hỗ trợ (heading, list, code fence, quote, todo), THEN THE Transform_Pipeline SHALL giữ nguyên block content trước đó không thay đổi và phát ra sự kiện ParseError chứa vị trí dòng gây lỗi.
8. IF người dùng thực hiện chỉnh sửa mới trong khi một lần chuyển đổi trước đó đang chờ debounce, THEN THE Transform_Pipeline SHALL hủy lần chuyển đổi đang chờ và chỉ thực hiện chuyển đổi cho nội dung mới nhất.

---

### Requirement 5: Lưu trữ .aura bundle

**User Story:** As a người dùng, I want các variant được lưu trữ tự động, so that tôi không mất dữ liệu khi đóng ứng dụng.

#### Acceptance Criteria

1. THE auraBundleService SHALL lưu AuraBundle dưới dạng JSON tại đường dẫn `{appDataDir}/aura/{intentId}.aura.json`.
2. IF AuraBundle không pass validation theo schema v1 (sử dụng zod), THEN THE auraBundleService SHALL từ chối lưu và throw validation error chứa danh sách các trường không hợp lệ.
3. WHEN file .aura.json đã tồn tại, THE auraBundleService SHALL ghi đè toàn bộ nội dung (overwrite strategy, không versioning).
4. WHEN auraBundleService load bundle từ file tồn tại nhưng nội dung không hợp lệ theo schema, THE auraBundleService SHALL trả về null.
5. WHEN auraBundleService load bundle từ file không tồn tại, THE auraBundleService SHALL trả về null.
6. THE AuraBundle SHALL chứa các trường bắt buộc: `$schema`, `version`, `intentId`, `canonical`, `markdown`, `variants`, `promotedVariantId`, `lastModified`.
7. THE AuraBundle SHALL lưu `lastModified` dưới dạng ISO 8601 hợp lệ, được cập nhật mỗi lần gọi save.
8. IF `promotedVariantId` không null, THEN THE auraBundleService SHALL đảm bảo giá trị đó match với `id` của một entry trong mảng `variants`; nếu không match, validation SHALL thất bại.
9. THE auraBundleService SHALL giới hạn mảng `variants` tối đa 50 entries (bao gồm cả archived).

---

### Requirement 6: Phát hiện nguồn Intent

**User Story:** As a developer, I want hệ thống tự động phát hiện định dạng nguồn của Intent, so that Prism xử lý đúng logic đọc/ghi cho từng loại file.

#### Acceptance Criteria

1. WHEN Intent có metadata.sourcePath kết thúc bằng `.docx` (case-insensitive), THE intentSourceService SHALL trả về PrismSourceFormat với kind là 'docx' và filePath là giá trị sourcePath đó.
2. WHEN Intent có metadata.sourcePath kết thúc bằng `.md` hoặc `.markdown` (case-insensitive), THE intentSourceService SHALL trả về PrismSourceFormat với kind là 'markdown' và filePath là giá trị sourcePath đó.
3. WHEN Intent có metadata.sourcePath kết thúc bằng `.html` hoặc `.htm` (case-insensitive), THE intentSourceService SHALL trả về PrismSourceFormat với kind là 'html' và filePath là giá trị sourcePath đó.
4. WHEN Intent có metadata.sourcePath là null, undefined, hoặc chuỗi rỗng, và auraBundleService.loadBundle(intent.id) trả về bundle khác null, THE intentSourceService SHALL trả về PrismSourceFormat với kind là 'aura' và bundle là giá trị bundle đó.
5. IF metadata.sourcePath không khớp extension nào trong criterion 1-3 và không có bundle hợp lệ trong store, THEN THE intentSourceService SHALL trả về PrismSourceFormat với kind là 'markdown' và không có filePath.
6. THE intentSourceService SHALL không throw exception với bất kỳ input nào — kể cả khi intent là null, metadata thiếu, hoặc auraBundleService lỗi — và luôn trả về đúng 1 PrismSourceFormat.
7. THE intentSourceService SHALL đánh giá sourcePath extension trước khi kiểm tra bundle trong store — nếu sourcePath khớp extension hợp lệ thì trả về kind tương ứng bất kể bundle có tồn tại hay không.

---

### Requirement 7: Quản lý variant — Thêm, Discard, Promote, Pin

**User Story:** As a người dùng, I want quản lý các biến thể nội dung (thêm, xóa, chọn bản chính, ghim), so that tôi kiểm soát được workflow so sánh và chọn lựa.

#### Acceptance Criteria

1. WHEN người dùng promote một variant, THE usePrismState SHALL đặt promotedVariantId bằng ID của variant được promote.
2. WHEN người dùng promote một variant, THE usePrismState SHALL cập nhật bundle.markdown bằng Markdown của variant được promote.
3. WHEN người dùng promote một variant, THE usePrismState SHALL archive tất cả variant khác không có pinned=true (đặt archivedAt = thời điểm hiện tại theo ISO 8601).
4. WHEN người dùng promote một variant, THE PrismState SHALL đặt slot 0 chứa nội dung promoted và đặt các slot chứa variant đã bị archive thành null; các slot chứa variant có pinned=true SHALL được giữ nguyên.
5. WHEN người dùng pin một variant, THE usePrismState SHALL đặt pinned=true cho variant đó, ngăn variant bị archive khi promote và ngăn bị ghi đè khi AuraSphere phân phối variant mới.
6. WHEN người dùng discard một variant ở slot có index khác 0, THE usePrismState SHALL đặt slot đó thành null và layout co lại tương ứng với số slot active còn lại.
7. IF người dùng thực hiện discard trên variant ở slot 0, THEN THE usePrismState SHALL từ chối thao tác và giữ nguyên state (slot 0 không bao giờ null).
8. WHEN người dùng unpin một variant đã có pinned=true, THE usePrismState SHALL đặt pinned=false cho variant đó, cho phép variant bị archive hoặc ghi đè trong các thao tác tiếp theo.
9. IF chỉ có 1 variant active (slot 0), THEN THE PrismCanvas SHALL vô hiệu hóa nút Promote vì variant ở slot 0 đã là bản chính.

---

### Requirement 8: Tích hợp AuraSphere

**User Story:** As a người dùng, I want nhận các biến thể do AI sinh ra và so sánh với bản gốc, so that tôi có thể chọn phiên bản nội dung tối ưu.

#### Acceptance Criteria

1. WHEN AuraSphere trả về AuraSphereSuggestion, THE PrismCanvas SHALL nhận và phân phối variant vào các slot trống theo thứ tự index tăng dần (slot có index thấp nhất được điền trước).
2. WHEN phân phối variant từ AuraSphere, THE usePrismState SHALL bỏ qua slot có pinned=true.
3. WHEN phân phối variant từ AuraSphere, THE usePrismState SHALL bỏ qua slot 0 nếu slot 0 đã có content.
4. WHEN phân phối variant từ AuraSphere, THE usePrismState SHALL bỏ qua slot có dirty=true (chưa save).
5. THE AuraSphereSuggestion SHALL chứa từ 1 đến 3 variant, mỗi variant có label (1–50 ký tự, không rỗng), markdown (không rỗng, tối đa 100.000 ký tự), và promptRef.
6. WHEN tất cả slot đều đầy hoặc được bảo vệ, THE usePrismState SHALL bỏ qua các variant thừa từ AuraSphere và không hiển thị thông báo lỗi.
7. WHEN phân phối variant từ AuraSphere thành công vào ít nhất một slot, THE PrismCanvas SHALL cập nhật layout hiển thị số cột tương ứng với số slot đang active.
8. WHEN AuraSphereSuggestion chứa variant có label rỗng hoặc markdown rỗng, THE usePrismState SHALL bỏ qua variant không hợp lệ đó và tiếp tục xử lý các variant còn lại.

---

### Requirement 9: Đồng bộ scroll giữa các pane

**User Story:** As a người dùng, I want scroll đồng bộ giữa các variant pane, so that tôi có thể so sánh cùng vị trí nội dung giữa các biến thể.

#### Acceptance Criteria

1. WHILE syncScroll được bật, WHEN người dùng scroll một variant pane bất kỳ, THE PrismCanvas SHALL cập nhật vị trí scroll của tất cả variant pane đang hiển thị khác về cùng tỷ lệ phần trăm scrollTop (không dùng pixel tuyệt đối) trong vòng 100ms.
2. WHEN người dùng toggle syncScroll từ tắt sang bật, THE PrismCanvas SHALL đồng bộ tất cả variant pane đang hiển thị về cùng tỷ lệ phần trăm scrollTop với pane đang được focus (focusedSlot).
3. WHEN người dùng toggle syncScroll, THE PrismToolbar SHALL cập nhật trạng thái hiển thị (icon/indicator) phản ánh trạng thái mới của syncScroll.
4. WHILE syncScroll được bật, THE PrismCanvas SHALL đồng bộ scroll cho cả view mode Preview và Code của các variant pane đang hiển thị.
5. IF chỉ có 1 variant pane đang hiển thị, THEN THE PrismCanvas SHALL không thực hiện đồng bộ scroll (không có pane đích để đồng bộ).

---

### Requirement 10: Xử lý lỗi

**User Story:** As a người dùng, I want được thông báo rõ ràng khi có lỗi xảy ra, so that tôi biết cách khắc phục và không mất dữ liệu.

#### Acceptance Criteria

1. WHEN markdownToBlock parse thất bại, THE PrismCodeView SHALL hiển thị error banner chỉ rõ lỗi cú pháp Markdown và thông báo rằng Preview giữ nguyên nội dung trước đó.
2. WHEN markdownToBlock parse thất bại, THE usePrismState SHALL giữ nguyên blockContent của lần parse thành công gần nhất và đặt dirty=true.
3. WHEN markdownToBlock parse thành công sau một lần thất bại trước đó, THE PrismCodeView SHALL ẩn error banner trong vòng 300ms.
4. WHEN auraBundleService load bundle thất bại (file corrupt hoặc không đọc được), THE auraBundleService SHALL trả về null và intentSourceService fallback sang kind 'markdown'.
5. WHEN auraBundleService save bundle thất bại, THE usePrismState SHALL hiển thị toast notification trong 5 giây với nội dung chỉ rõ lỗi lưu variant và gợi ý kiểm tra dung lượng ổ đĩa.
6. WHEN auraBundleService save bundle thất bại, THE usePrismState SHALL giữ variant trong memory (session state) và retry ở lần debounce tiếp theo, tối đa 3 lần retry liên tiếp cho cùng một thao tác save.
7. IF auraBundleService save bundle thất bại sau 3 lần retry liên tiếp, THEN THE usePrismState SHALL ngừng retry tự động và hiển thị toast notification yêu cầu người dùng thử lưu lại thủ công.
8. WHEN AuraSphere trả về suggestion với markdown không parse được cho một variant, THE usePrismState SHALL bỏ qua variant đó và xử lý các variant còn lại.
9. IF tất cả variant trong AuraSphereSuggestion đều parse thất bại, THEN THE PrismCanvas SHALL hiển thị toast notification trong 5 giây với nội dung chỉ rõ rằng không thể áp dụng suggestion từ AuraSphere do lỗi parse.

---

### Requirement 11: Hiệu năng

**User Story:** As a người dùng, I want editor hoạt động mượt mà ngay cả khi mở 3 variant cùng lúc, so that trải nghiệm chỉnh sửa không bị gián đoạn.

#### Acceptance Criteria

1. WHILE có nhiều hơn 1 variant đang mở, THE PrismCanvas SHALL chỉ gắn keyboard listeners và input handlers cho EditorCanvas ở slot đang có focus (focusedSlot), các EditorCanvas ở slot còn lại SHALL render ở chế độ read-only không đăng ký keyboard listeners global.
2. THE Transform_Pipeline SHALL thực hiện mỗi lần gọi parsing (blockToMarkdown hoặc markdownToBlock) thông qua requestIdleCallback và mỗi task SHALL hoàn thành trong tối đa 16ms trên main thread; nếu vượt 16ms, task SHALL được chia nhỏ (yield) và tiếp tục ở idle frame tiếp theo.
3. WHEN người dùng chuyển sang Code view trên một PrismVariantPane, THE PrismCodeView SHALL khởi tạo và mount CodeMirror 6 editor instance; CodeMirror SHALL không được load hoặc mount khi pane đang ở chế độ Preview.
4. WHEN layout thay đổi (thêm hoặc xóa variant), THE PrismCanvas SHALL animate transition bằng CSS Grid mà không unmount/remount các EditorCanvas pane đang tồn tại — React key của các pane hiện có SHALL không thay đổi trong quá trình transition.
5. WHEN layout thay đổi (thêm hoặc xóa variant), THE PrismCanvas SHALL hoàn thành layout shift (từ lúc action dispatch đến lúc tất cả pane đạt kích thước ổn định) trong vòng 50ms.
6. WHEN PrismCanvas mount lần đầu với 3 variant, THE PrismCanvas SHALL hiển thị tất cả 3 pane với nội dung visible trong vòng 1000ms kể từ khi component bắt đầu render.
