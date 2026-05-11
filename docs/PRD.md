<html><head></head><body># Tài liệu Yêu cầu Thiết kế (PRD)

## 1. Tổng quan Tầm nhìn
WordAI là một trình soạn thảo văn bản thế hệ mới dựa trên AI, tập trung vào mô hình "Người đạo diễn" (Director Model). Hệ thống tách biệt hoàn toàn quá trình tư duy (soạn thảo thô) khỏi quá trình trình bày (định dạng/render), sử dụng dữ liệu động (AuraSphere) và tương tác định hướng ý định.

## 2. Các Khu vực Chức năng &amp; Tính năng Chính (Mobile Optimized)

### A. Workspace Navigation (Điều hướng Không gian làm việc)
- **Top Bar Features:** Thanh công cụ phía trên tích hợp các lối tắt điều hướng nhanh.
- **Quản lý Bản thảo (Manuscript Management):** Hệ thống phân loại trạng thái văn bản gồm:
    - **Drafts (Nháp):** Nơi chứa các nội dung đang trong quá trình sáng tác và tư duy thô.
    - **Archive (Lưu trữ):** Kho lưu trữ các phiên bản cũ hoặc các dự án đã tạm dừng nhưng cần giữ lại dữ liệu.
    - **Library (Thư viện):** Nơi lưu trữ các văn bản đã hoàn thiện, các template mẫu và tài liệu tham khảo hệ thống.

### B. Trình soạn thảo "Zero-UI" (Khu vực Trung tâm)
- **Nội dung thô (Raw Content):** Hiển thị văn bản tối giản, không định dạng phức tạp để tập trung vào nội dung.
- **Menu ngữ cảnh "Bôi đen để hành động":** Xuất hiện khi chọn văn bản với các lệnh nhanh: *Súc tích hơn, Phản biện, Mở rộng, Đổi giọng*. Điều khiển bằng ý định thay vì toolbar truyền thống.

### C. Trợ lý AuraSphere Assistant
- **Giao diện Hội thoại:** Ô nhập liệu lệnh AI tích hợp ngay trong luồng làm việc.
- **Dữ liệu lỏng (Liquid Data):** Sử dụng ký hiệu `@` để gọi dữ liệu từ các file khác (@Báo_cáo_Q1, @Nghiên_cứu).
- **Curation (Lựa chọn &amp; Tạo):** AI tạo ra nhiều phiên bản (v1, v2, v3) và đánh dấu "Gợi ý tốt nhất" để người dùng chọn.

### D. Bảng Thương lượng (Negotiation Panel)
- **So sánh Song song:** Cửa sổ nổi so sánh "Bản gốc" vs "Bản AI đề xuất".
- **Quyền kiểm soát:** Các nút chức năng: *Chấp nhận, Yêu cầu lại, Hủy bỏ*. Đảm bảo người dùng luôn là người quyết định cuối cùng.

### E. Render-on-Demand (Định dạng &amp; Xuất file)
- **Xem trước bản in (Render Preview):** Chế độ xem văn bản sau khi áp dụng template chuẩn (Auto-layout).
- **Kho Template AI:** Các mẫu định dạng nhanh: Báo cáo, Blog, APA...
- **Can thiệp vi mô (Progressive Override):** Công cụ fine-tuning để chỉnh sửa thủ công các chi tiết nhỏ (căn lề, in đậm...) nếu cần.
- **Xuất file:** PDF, AuraSphere Format, Nháp.

## 3. Nguyên tắc Thiết kế
- **Focus-first:** Ưu tiên không gian cho nội dung.
- **Intent-driven:** Ưu tiên ra lệnh bằng ngôn ngữ tự nhiên và ngữ cảnh.
- **Safety:** Luôn có bước xác nhận/so sánh trước khi thay đổi văn bản gốc.
- **Modern &amp; Fluid:** Cảm giác dữ liệu "lỏng", linh hoạt và thông minh.</body></html>
