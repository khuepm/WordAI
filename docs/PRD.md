# PRD: Preferences behavior updates

## Mục tiêu
- Làm rõ hành vi nút **Restore defaults** chỉ áp dụng cho tab đang mở.
- Lưu toàn bộ thiết lập ưu tiên trên máy người dùng (local) để giữ nguyên giữa các phiên.

## Phạm vi
- Dialog/khung Preferences hiện tại (mọi tab cấu hình bên trong).
- Không thay đổi nội dung/giá trị mặc định của các tab; chỉ thay đổi cách reset và lưu trữ.

## Yêu cầu chức năng
1) Restore defaults theo tab hiện tại
   - Khi người dùng nhấn **Restore defaults** trong một tab, chỉ các trường/thiết lập của tab đó được trả về giá trị mặc định.
   - Các tab khác giữ nguyên giá trị hiện tại (không bị reset).
   - Sau khi reset, UI hiển thị ngay giá trị mặc định của tab đó và trạng thái lưu trữ được cập nhật.

2) Lưu settings ở local
   - Mọi thay đổi thiết lập (theo tab hoặc toàn bộ) được lưu ở storage cục bộ trên máy người dùng.
   - Khi mở lại ứng dụng, các giá trị cuối cùng đã lưu được nạp lại và hiển thị đúng cho từng tab.
   - Nếu storage trống (lần đầu), dùng giá trị mặc định của từng tab.

## Yêu cầu phi chức năng
- Không cần đăng nhập hoặc đồng bộ đám mây cho phần lưu settings.
- Hành vi phải hoạt động offline.

## Kiểm thử chấp nhận
- Nhấn Restore defaults trong Tab A chỉ reset Tab A; chuyển sang Tab B vẫn giữ giá trị đã chỉnh trước đó.
- Reload ứng dụng sau khi chỉnh sửa giữ nguyên các thiết lập đã lưu (được nạp từ local).
- Lần đầu mở, tất cả tab hiển thị giá trị mặc định.
