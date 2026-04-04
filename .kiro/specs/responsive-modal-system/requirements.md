# Requirements Document

## Introduction

Tính năng này thiết kế và triển khai cơ chế responsive thống nhất cho toàn bộ các Popup và Modal trong ứng dụng WordAI Editor (Tauri/React). Khi cửa sổ ứng dụng bị thay đổi kích thước (resize), các hộp thoại phải co giãn phù hợp, nội dung bên trong có thể cuộn (scroll) khi cần, và layout không bị vỡ ở bất kỳ kích thước viewport nào. Các thành phần chịu ảnh hưởng bao gồm `PreferencesDialog` (modal nhiều tab với sidebar) và `QuickSearchPopup` (popup tìm kiếm nhanh), cùng mọi modal/popup được thêm vào trong tương lai.

## Glossary

- **Modal_System**: Hệ thống quản lý responsive cho tất cả các modal và popup trong ứng dụng.
- **PreferencesDialog**: Hộp thoại cài đặt gồm sidebar điều hướng và vùng nội dung nhiều tab (General, AI Engine, Typography, Privacy).
- **QuickSearchPopup**: Popup tìm kiếm nhanh các cài đặt, kích hoạt bằng phím tắt Cmd/Ctrl+Shift+P.
- **Viewport**: Vùng hiển thị của cửa sổ ứng dụng tại thời điểm hiện tại.
- **Breakpoint**: Ngưỡng kích thước viewport mà tại đó layout của modal thay đổi.
- **Overlay**: Lớp nền mờ phủ toàn màn hình phía sau modal.
- **Content_Area**: Vùng nội dung chính bên trong modal, có thể cuộn khi nội dung vượt quá chiều cao hiển thị.
- **Sidebar**: Thanh điều hướng tab bên trái của `PreferencesDialog`.
- **Collapsed_Sidebar**: Trạng thái sidebar thu gọn chỉ hiển thị icon khi viewport nhỏ hơn breakpoint.

---

## Requirements

### Requirement 1: Kích thước Modal Thích Ứng Viewport

**User Story:** As a người dùng WordAI Editor, I want các hộp thoại tự động điều chỉnh kích thước theo cửa sổ ứng dụng, so that tôi có thể sử dụng đầy đủ chức năng dù cửa sổ ở bất kỳ kích thước nào.

#### Acceptance Criteria

1. THE `Modal_System` SHALL giới hạn chiều rộng tối đa của `PreferencesDialog` ở mức `min(900px, calc(100vw - 48px))`.
2. THE `Modal_System` SHALL giới hạn chiều cao tối đa của `PreferencesDialog` ở mức `min(680px, calc(100vh - 80px))`.
3. THE `Modal_System` SHALL giới hạn chiều rộng tối đa của `QuickSearchPopup` ở mức `min(560px, calc(100vw - 32px))`.
4. WHEN viewport width nhỏ hơn 600px, THE `Modal_System` SHALL đặt `PreferencesDialog` chiếm toàn bộ chiều rộng viewport với padding ngang tối thiểu 16px mỗi bên.
5. WHEN viewport height nhỏ hơn 500px, THE `Modal_System` SHALL đặt `PreferencesDialog` chiếm toàn bộ chiều cao viewport với padding dọc tối thiểu 16px mỗi bên.

---

### Requirement 2: Cuộn Nội Dung Bên Trong Modal

**User Story:** As a người dùng, I want nội dung bên trong hộp thoại có thể cuộn khi vượt quá chiều cao hiển thị, so that tôi không bị mất quyền truy cập vào bất kỳ cài đặt nào.

#### Acceptance Criteria

1. THE `Content_Area` của `PreferencesDialog` SHALL có thuộc tính `overflow-y: auto` để hiển thị thanh cuộn dọc khi nội dung vượt quá chiều cao khả dụng.
2. WHILE `PreferencesDialog` đang hiển thị, THE `Sidebar` SHALL giữ nguyên vị trí cố định (không cuộn cùng nội dung) khi `Content_Area` được cuộn.
3. THE `Content_Area` SHALL có chiều cao được tính toán để lấp đầy phần còn lại của modal sau khi trừ đi header (nếu có) và padding.
4. THE `QuickSearchPopup` SHALL giới hạn chiều cao danh sách kết quả ở mức `min(8 * 64px, calc(100vh - 200px))` và hiển thị thanh cuộn khi danh sách vượt quá giới hạn này.
5. IF nội dung tab trong `PreferencesDialog` vượt quá chiều cao `Content_Area`, THEN THE `Content_Area` SHALL hiển thị thanh cuộn webkit tùy chỉnh với chiều rộng 6px và màu sắc theo design token `--md-sys-color-surface-container`.

---

### Requirement 3: Ngăn Vỡ Layout Khi Resize

**User Story:** As a người dùng, I want layout bên trong hộp thoại không bị vỡ khi cửa sổ thay đổi kích thước, so that giao diện luôn nhất quán và dễ sử dụng.

#### Acceptance Criteria

1. WHEN viewport width nhỏ hơn 720px, THE `Sidebar` của `PreferencesDialog` SHALL chuyển sang trạng thái `Collapsed_Sidebar` chỉ hiển thị icon (width: 64px) thay vì text đầy đủ (width: 256px).
2. WHEN viewport width nhỏ hơn 480px, THE `Modal_System` SHALL chuyển layout `PreferencesDialog` từ dạng hai cột (sidebar + content) sang dạng một cột (tab bar ngang ở trên, content ở dưới).
3. THE `Content_Area` SHALL sử dụng `min-width: 0` trên các flex children để ngăn nội dung tràn ra ngoài container.
4. WHEN `PreferencesDialog` đang hiển thị và viewport bị resize, THE `Modal_System` SHALL cập nhật kích thước modal trong vòng một animation frame (≤ 16ms) mà không cần reload component.
5. THE `Modal_System` SHALL đảm bảo tất cả grid layout bên trong `Content_Area` (ví dụ: lưới 4 cột theme, lưới 3 cột agent) sử dụng `auto-fit` hoặc `auto-fill` với `minmax` để tự động wrap khi không đủ không gian.
6. IF một grid item trong `Content_Area` không đủ không gian để hiển thị ở kích thước tối thiểu, THEN THE grid SHALL wrap item đó xuống hàng tiếp theo thay vì tràn ra ngoài container.

---

### Requirement 4: Trải Nghiệm Người Dùng Khi Tương Tác Với Modal

**User Story:** As a người dùng, I want các hộp thoại phản hồi mượt mà khi tôi thay đổi kích thước cửa sổ, so that trải nghiệm sử dụng không bị gián đoạn.

#### Acceptance Criteria

1. WHEN `PreferencesDialog` đang mở và viewport thay đổi kích thước, THE `Modal_System` SHALL duy trì vị trí cuộn hiện tại của `Content_Area` (không reset về đầu trang).
2. WHEN `PreferencesDialog` đang mở và viewport thay đổi kích thước, THE `Modal_System` SHALL giữ nguyên tab đang được chọn.
3. THE `Overlay` SHALL luôn phủ toàn bộ viewport (`position: fixed; inset: 0`) bất kể kích thước cửa sổ.
4. THE `Modal_System` SHALL căn giữa modal theo cả chiều ngang và chiều dọc trong viewport bằng flexbox (`align-items: center; justify-content: center`).
5. WHEN `Collapsed_Sidebar` đang hiển thị, THE `Collapsed_Sidebar` SHALL hiển thị tooltip với tên đầy đủ của tab khi người dùng hover vào icon.

---

### Requirement 5: CSS Variables và Design Tokens Cho Responsive Modal

**User Story:** As a developer, I want hệ thống responsive modal sử dụng CSS variables tập trung, so that việc bảo trì và mở rộng trong tương lai trở nên dễ dàng.

#### Acceptance Criteria

1. THE `Modal_System` SHALL định nghĩa các CSS variables sau trong `:root` của `variables.css`:
   - `--modal-max-width-preferences: min(900px, calc(100vw - 48px))`
   - `--modal-max-height-preferences: min(680px, calc(100vh - 80px))`
   - `--modal-max-width-popup: min(560px, calc(100vw - 32px))`
   - `--modal-sidebar-width: 256px`
   - `--modal-sidebar-collapsed-width: 64px`
   - `--modal-breakpoint-collapse: 720px`
   - `--modal-breakpoint-stack: 480px`
2. THE `Modal_System` SHALL sử dụng các CSS variables này trong tất cả các component modal thay vì hardcode giá trị pixel.
3. WHERE một modal mới được thêm vào ứng dụng, THE `Modal_System` SHALL yêu cầu modal đó sử dụng các CSS variables đã định nghĩa để đảm bảo tính nhất quán.

---

### Requirement 6: Khả Năng Tiếp Cận (Accessibility) Của Responsive Modal

**User Story:** As a người dùng sử dụng bàn phím hoặc công nghệ hỗ trợ, I want các hộp thoại responsive vẫn hoạt động đúng với keyboard navigation và screen reader, so that tôi không bị mất khả năng tiếp cận khi layout thay đổi.

#### Acceptance Criteria

1. WHEN `Collapsed_Sidebar` đang hiển thị, THE `Collapsed_Sidebar` SHALL duy trì thuộc tính `aria-label` đầy đủ trên mỗi nút tab để screen reader đọc được tên tab.
2. WHEN layout chuyển sang dạng một cột (viewport < 480px), THE tab bar ngang SHALL duy trì `role="tablist"` và mỗi tab SHALL có `role="tab"` với `aria-selected` đúng trạng thái.
3. THE `Modal_System` SHALL đảm bảo focus trap hoạt động đúng ở mọi kích thước viewport — focus không thoát ra ngoài modal khi đang mở.
4. WHEN `PreferencesDialog` mở, THE `Modal_System` SHALL đặt focus vào phần tử đầu tiên có thể tương tác trong modal.
5. THE `Overlay` SHALL có `aria-hidden="true"` để screen reader bỏ qua lớp nền.
