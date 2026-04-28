# Naming — Bảng thuật ngữ chính thức của Prism

> Mọi code, doc, copy UI, test data về sau **phải** dùng đúng các tên dưới đây. Đổi tên là một thay đổi public API.

## Thuật ngữ cấp cao

| Tên | Loại | Định nghĩa |
|-----|------|------------|
| **Prism** | Feature codename | Toàn bộ surface multi-variant + dual-mode (Preview/Code) trong WordAI editor. |
| **Intent** | Domain entity | Đơn vị nội dung mà người dùng đang sửa (đã tồn tại — không đổi). |
| **AuraSphere** | Subsystem | Lớp AI sinh nội dung và đề xuất Variant (đã tồn tại — không đổi). |

## Thuật ngữ riêng của Prism

| Tên | Loại | Định nghĩa |
|-----|------|------------|
| **Variant** | UI primitive | Một trong tối đa 3 cột song song của Prism. Mỗi Variant trỏ tới đúng 1 bản nháp của Intent (do AuraSphere sinh hoặc do user clone). |
| **Variant slot** | UI primitive | Vị trí cố định 1/2/3 trong layout. Slot có thể trống hoặc chứa 1 Variant. |
| **Preview** | View mode | Chế độ render giàu (block UI hiện tại của react-block-text). Mặc định khi vào Variant. |
| **Code** | View mode | Chế độ raw source. Nội dung phụ thuộc vào nguồn của Intent (xem `Source format` bên dưới). |
| **Promote** | Action | Đẩy 1 Variant lên thành nội dung chính của Intent (ghi đè block content), các Variant còn lại được lưu vào history. |
| **Discard** | Action | Bỏ Variant khỏi Prism mà không Promote. |
| **Pin** | Action | Khoá Variant ở slot hiện tại để không bị AuraSphere ghi đè khi sinh nháp mới. |

## Source format trong Code view

| Nguồn Intent | Code view hiển thị | Round-trip về Preview? |
|--------------|--------------------|------------------------|
| File `.md` import vào | **Markdown source** giống file gốc | ✅ |
| File `.docx` import vào | **OOXML** (`word/document.xml`) — readonly trong giai đoạn 1 | ⚠️ chỉ xem |
| File `.html` import vào | **HTML source** | ✅ |
| Intent thuần do AuraSphere tổng hợp (Synthesis) | **Markdown** *(canonical)* + sub-tab **`.aura`** *(JSON đầy đủ context AI)* | ✅ |

## File format mới: `.aura`

Bundle JSON do dự án tự định nghĩa, dùng khi Intent không có file gốc cụ thể. Cấu trúc tham chiếu chi tiết tại `technical-design.md#aura-bundle`.

```jsonc
{
  "$schema": "https://wordai.app/schemas/aura/v1.json",
  "version": 1,
  "intentId": "intent_...",
  "canonical": "markdown",         // format được dùng làm chuẩn
  "markdown": "...",               // text Markdown chính
  "variants": [
    { "id": "v_formal",   "label": "Trang trọng", "markdown": "...", "createdBy": "aurasphere", "promptRef": "..." },
    { "id": "v_friendly", "label": "Thân mật",    "markdown": "...", "createdBy": "aurasphere", "promptRef": "..." },
    { "id": "v_concise",  "label": "Súc tích",    "markdown": "...", "createdBy": "aurasphere", "promptRef": "..." }
  ],
  "promotedVariantId": "v_formal", // null nếu chưa promote
  "lastModified": "2026-04-28T03:00:00Z"
}
```

## Alias cũ — KHÔNG dùng

Trong quá trình thảo luận có xuất hiện các alias bên dưới. **Không** đưa vào code/doc:

- ~~Triptych~~ → dùng **Prism**
- ~~Facet~~ → dùng **Variant**
- ~~Source view~~ → dùng **Code**
- ~~Glyph / Rune~~ → dùng **Preview / Code**
- ~~Synthesis~~ → vẫn dùng được như mô tả tự nhiên ("Intent là một synthesis của AuraSphere") nhưng **không** là entity name trong code.

## Quy ước đặt tên trong code

| Layer | Convention | Ví dụ |
|-------|-----------|-------|
| TypeScript types | PascalCase | `PrismVariant`, `PrismSlotIndex`, `PrismViewMode`, `AuraBundle` |
| React components | PascalCase, prefix `Prism` | `PrismCanvas`, `PrismVariantPane`, `PrismCodeView` |
| Hooks | camelCase, prefix `usePrism` | `usePrismVariants`, `usePrismViewMode` |
| Test IDs | kebab-case, prefix `prism-` | `prism-variant-1`, `prism-view-toggle`, `prism-promote-btn` |
| i18n keys | dot-path, prefix `prism.` | `prism.variant.promote`, `prism.view.preview`, `prism.view.code` |
| File extension | lowercase, có chấm | `.aura` |
