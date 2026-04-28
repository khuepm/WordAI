# Prism — UX Spec

> Mô tả hành vi UI nhìn từ phía người dùng. Không bàn cấu trúc code (xem `technical-design.md`).

## 1. Layout

### 1.1. Single Variant (mặc định khi mở Intent)

```
┌─────────────────────────────────────────────────┐
│  Top nav                                         │
├─────────────────────────────────────────────────┤
│  Title bar                                       │
│  ┌────────┬────────┐                             │
│  │Preview │  Code  │   ← View toggle (per-Variant) │
│  └────────┴────────┘                             │
│                                                  │
│           [   single Variant pane   ]            │
│                                                  │
├─────────────────────────────────────────────────┤
│  Status bar                                      │
└─────────────────────────────────────────────────┘
```

Đây là behavior **giống editor hiện tại**, chỉ thêm View toggle. Người dùng không thấy khác biệt cho tới khi muốn dùng nhiều Variant.

### 1.2. Multi-Variant (2 hoặc 3 cột)

```
┌─────────────────────────────────────────────────┐
│  Top nav                                         │
├─────────────────────────────────────────────────┤
│  Title bar    ⋯   [+ Variant]  [Sync scroll ▢]   │
├─────────────┬───────────────┬───────────────────┤
│ Variant 1   │ Variant 2     │ Variant 3         │
│ Trang trọng │ Thân mật      │ Súc tích          │
│ [Pre|Code]  │ [Pre|Code]    │ [Pre|Code]        │
│             │               │                   │
│  ...        │  ...          │  ...              │
│             │               │                   │
│ Promote ⤴   │ Promote ⤴     │ Promote ⤴         │
└─────────────┴───────────────┴───────────────────┘
```

- Mỗi Variant có **toggle Preview/Code riêng** — có thể mix (vd: V1 Preview, V2 Code, V3 Preview).
- Thanh **header chung** ở trên: nút `+ Variant` (mở slot kế tiếp), checkbox `Sync scroll`.
- Mỗi pane có `Promote`, `Discard`, `Pin` ở footer.

## 2. Vào / ra Multi-Variant

| Hành động | Kết quả |
|-----------|---------|
| Mở Intent mới | Hiển thị 1 Variant duy nhất ở slot 1. Slot 2, 3 trống. |
| Bấm `+ Variant` (khi đang single) | Slot 2 hiện ra với clone của Variant 1. |
| Bấm `+ Variant` (khi đang 2 Variant) | Slot 3 hiện ra. Sau đó nút `+` bị disable. |
| AuraSphere sinh ≥ 2 đề xuất | Tự động lấp đầy slot 2 (và 3 nếu có) bằng các đề xuất. Slot 1 giữ nguyên bản hiện tại của user. |
| Bấm `Discard` ở Variant n | Slot n trống. Các slot phía sau **không** dồn lên — giữ vị trí cố định để mắt đỡ "nhảy". |
| Bấm `Promote` ở Variant n | Variant n trở thành nội dung chính. Các Variant khác được Discard (nếu chưa Pin). Layout về single. |

## 3. Toggle Preview ↔ Code

- Tab bar đặt ở **đầu mỗi Variant pane**, không dùng global toggle (vì cần mix mode).
- Animation: cross-fade 150ms, không trượt — giữ vị trí scroll.
- State persist trong session, không persist sang lần mở Intent khác (giữ default = Preview).

### Code view — sub-tab khi nguồn là `.aura`

```
[ Markdown ]  [ .aura ]
```

- `Markdown` mặc định, syntax highlight nhẹ (heading, list, link).
- `.aura` hiển thị JSON, **readonly** trong giai đoạn 1.
- Chuyển sub-tab không reload nội dung — giữ scroll position riêng.

### Code view — file gốc khác

| Nguồn | Sub-tab | Editable? |
|-------|---------|-----------|
| `.md` | (chỉ 1 tab `Markdown`) | ✅ |
| `.html` | (chỉ 1 tab `HTML`) | ✅ |
| `.docx` | (chỉ 1 tab `OOXML`) | ❌ readonly |
| AuraSphere synthesis | `Markdown` + `.aura` | ✅ Markdown / ❌ .aura |

## 4. Edit trong Code view

- Khi user gõ trong Code view, **sau 500ms debounce** parse lại sang block và cập nhật Preview của cùng Variant.
- Lỗi parse → banner đỏ trên đầu pane: *"Cú pháp Markdown không hợp lệ ở dòng 12"*. Preview giữ nội dung cũ cho tới khi parse OK.
- Trong khi đang gõ Code, nếu user chuyển slot khác → giữ buffer chưa parse, không mất nội dung.

## 5. Keyboard

| Phím | Hành động |
|------|-----------|
| `Cmd+1` / `Cmd+2` / `Cmd+3` | Focus vào Variant slot 1 / 2 / 3 |
| `Cmd+\\` | Mở thêm Variant slot kế tiếp (≡ nút `+ Variant`) |
| `Cmd+Shift+\\` | Đóng Variant đang focus (≡ Discard) |
| `Cmd+P` | Toggle Preview/Code của Variant đang focus |
| `Cmd+Enter` | Promote Variant đang focus |
| `Cmd+Shift+P` | Pin / Unpin Variant đang focus |

> Các phím cũ (`Cmd+S`, `Cmd+E`, `Cmd+H`, `Cmd+K` từ `EditorCanvas.tsx:130-151`) **giữ nguyên** và áp dụng cho Variant đang focus.

## 6. Trạng thái rỗng / lỗi

| Tình huống | Hiển thị |
|------------|---------|
| Slot trống | Nút lớn `+ Add Variant` + hint *"Dùng AuraSphere để gợi ý hoặc clone từ Variant khác"* |
| Code view khi Intent quá dài (> 200KB) | Banner *"Code view tạm tắt — nội dung quá lớn"* + nút `Show anyway` |
| AuraSphere đang sinh Variant | Skeleton shimmer trong slot, không block các Variant khác |
| Sync scroll bật nhưng 2 pane khác chiều dài | Sync theo **% chiều dài**, không theo px |

## 7. Accessibility

- Mỗi Variant pane là một `role="region"` với `aria-label="Variant {n}: {label}"`.
- View toggle dùng `role="tablist"` + `role="tab"` chuẩn ARIA.
- Promote / Discard có `aria-label` đầy đủ, không chỉ icon.
- Focus ring rõ rệt khi điều hướng bằng `Tab`.
- Cảnh báo lỗi parse Code có `role="alert"` + `aria-live="assertive"`.

## 8. Out of scope (giai đoạn 1)

- Drag-to-reorder Variant slot.
- Diff inline giữa các Variant (highlight đoạn khác nhau).
- Chia dọc thay vì chia ngang.
- Kéo Variant ra cửa sổ riêng (detach window).
- Edit trực tiếp `.aura` JSON.
- Edit trực tiếp `.docx` OOXML.
