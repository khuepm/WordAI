# Prism — Multi-Variant Preview & Code View

> Codename: **Prism**. Mở rộng EditorCanvas để hiển thị tối đa **3 Variant** của Intent đang sửa cạnh nhau, mỗi Variant chuyển được giữa **Preview** và **Code**.

## Mục lục

- [`README.md`](./README.md) — overview (file này)
- [`naming.md`](./naming.md) — bảng thuật ngữ chính thức của feature
- [`ux-spec.md`](./ux-spec.md) — hành vi UI, layout, keyboard, edge cases
- [`technical-design.md`](./technical-design.md) — data model, integration với editor & AuraSphere

---

## Tóm tắt 1 phút

Hôm nay editor chỉ render 1 Intent ở 1 góc nhìn (block UI). Prism thêm 2 trục:

- **Trục dọc** — `Preview` (rendered) vs `Code` (raw source).
- **Trục ngang** — chia canvas làm tối đa **3 Variant** chạy song song, đồng bộ scroll/cursor optional.

Khi AuraSphere đề xuất nhiều bản nháp (vd: *trang trọng*, *thân mật*, *súc tích*), người dùng thấy cả 3 cùng lúc, đối chiếu, rồi **Promote** một Variant lên thành nội dung chính.

## Mục tiêu

| # | Mục tiêu | Đo bằng |
|---|----------|---------|
| G1 | So sánh nhanh ≥ 2 bản nháp AI mà không phải bấm qua lại | Time-to-pick giảm ≥ 40% so với single-pane |
| G2 | Xem/chỉnh **source code** của Intent (Markdown / docx XML / .aura JSON) | Code view round-trip không mất data |
| G3 | Không phá vỡ single-pane workflow hiện tại | Mở app lần đầu vẫn thấy 1 pane như cũ |
| G4 | Cảm giác "Ethereal" — không nặng nề, không lộn xộn | < 16ms frame time với 3 pane đồng thời |

## Phi mục tiêu (giai đoạn 1)

- **Không** hỗ trợ > 3 Variant — giới hạn cứng để giữ UI rõ ràng và performance ổn định.
- **Không** đồng bộ realtime giữa nhiều device (đã thuộc spec sync khác).
- **Không** thay thế Version History — Prism so sánh *biến thể đề xuất*, không phải *snapshot lịch sử*.
- **Không** tách Variant thành nhiều file riêng — tất cả nằm trong cùng 1 Intent (bundle).

## Liên kết

- Editor surface hiện tại: `apps/wordai-editor/src/components/EditorCanvas.tsx`
- Export/Import drawer (sẽ tái dùng cho Code → file): `apps/wordai-editor/src/components/RenderDrawer.tsx`
- AI panel sinh Variant: `apps/wordai-editor/src/components/AuraSpherePanel.tsx`
- Negotiation flow (đã có UI 2 cột, có thể tham chiếu): `apps/wordai-editor/src/components/NegotiationPanel.tsx`

## Trạng thái

| Mốc | Trạng thái |
|-----|-----------|
| Naming chốt (Prism / Variant / Preview / Code / .aura) | ✅ |
| Spec docs (folder này) | 🟡 đang viết |
| Kiro spec (`.kiro/specs/prism/`) | ⬜ chưa bắt đầu |
| Implementation | ⬜ chưa bắt đầu |
