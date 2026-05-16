# Prism — Technical Design

> Cách triển khai, không bàn UX (xem `ux-spec.md`). Mục tiêu: **không re-architect** editor hiện tại, chỉ **bọc** thêm layer Prism.

## 1. Nguyên tắc

1. **Single source of truth = Intent**. Variant chỉ là *biểu diễn* của 1 trạng thái nội dung, không phải entity độc lập có lifecycle riêng. Nhờ vậy không phát sinh sync hell.
2. **Reuse `EditorCanvas`**. Mỗi Variant slot = 1 instance của `EditorCanvas` được khởi tạo với content riêng. Không viết block editor mới.
3. **Code view là transformer**, không phải editor riêng. Block JSON ↔ Markdown là nguồn duy nhất; Code view chỉ chỉnh Markdown rồi parse ngược lại.
4. **Persist tối thiểu**. Trạng thái UI (slot nào đang mở, mode nào) lưu *per-session*; nội dung Variant lưu trong Intent (hoặc `.aura` bundle).

## 2. Kiến trúc thành phần

```
┌─────────────────────────────────────────────────────────┐
│                       PrismCanvas                        │
│  - layout 1/2/3 cột                                     │
│  - quản lý slots: PrismVariant[3]                       │
│  - dispatch action: addVariant / discard / promote      │
│                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │PrismVariant  │ │PrismVariant  │ │PrismVariant  │     │
│  │   Pane 1     │ │   Pane 2     │ │   Pane 3     │     │
│  │              │ │              │ │              │     │
│  │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │     │
│  │ │View tabs │ │ │ │View tabs │ │ │ │View tabs │ │     │
│  │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │     │
│  │              │ │              │ │              │     │
│  │ Preview:     │ │ Preview:     │ │ Preview:     │     │
│  │ <EditorCanvas│ │ <EditorCanvas│ │ <EditorCanvas│     │
│  │   readonly?> │ │   readonly?> │ │   readonly?> │     │
│  │              │ │              │ │              │     │
│  │ Code:        │ │ Code:        │ │ Code:        │     │
│  │ <PrismCode   │ │ <PrismCode   │ │ <PrismCode   │     │
│  │  View />     │ │  View />     │ │  View />     │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### File mới đề xuất

```
apps/wordai-editor/src/components/prism/
├── PrismCanvas.tsx          // root, thay thế cho lệnh render <EditorCanvas/> ở App
├── PrismVariantPane.tsx     // 1 cột — view tabs + Preview/Code
├── PrismCodeView.tsx        // tabs Markdown / .aura / OOXML / HTML
├── PrismToolbar.tsx         // header chung: + Variant, Sync scroll
└── usePrismState.ts         // hook quản lý slots[], mode[], focus
```

```
apps/wordai-editor/src/services/
├── auraBundleService.ts     // load/save .aura JSON
└── intentSourceService.ts   // detect format gốc của Intent (md / docx / html / aura)
```

```
apps/wordai-editor/src/utils/
├── blockToMarkdown.ts       // block JSON → Markdown (đã có một phần trong export)
├── markdownToBlock.ts       // Markdown → block JSON (cần làm mới)
└── auraSchema.ts            // zod hoặc json-schema cho .aura v1
```

## 3. Data model

### 3.1. Trạng thái runtime của Prism

```ts
type PrismSlotIndex = 0 | 1 | 2;
type PrismViewMode = 'preview' | 'code';
type PrismCodeSubTab = 'markdown' | 'aura' | 'ooxml' | 'html';

interface PrismVariant {
  id: string;                  // ổn định trong session, dùng làm React key
  label: string;               // "Trang trọng" / "Thân mật" / ...
  blockContent: string;        // JSON cho react-block-text
  source: PrismSourceFormat;   // nguồn gốc (xem 3.2)
  promptRef?: string;          // nếu do AuraSphere sinh
  pinned: boolean;
  dirty: boolean;
}

interface PrismState {
  slots: (PrismVariant | null)[];   // length === 3
  modes: PrismViewMode[];           // length === 3, song song với slots
  codeSubTabs: PrismCodeSubTab[];   // length === 3
  focusedSlot: PrismSlotIndex;
  syncScroll: boolean;
}
```

### 3.2. Nguồn của Intent

```ts
type PrismSourceFormat =
  | { kind: 'markdown';  filePath?: string }
  | { kind: 'html';      filePath?: string }
  | { kind: 'docx';      filePath: string }   // bắt buộc có file path vì readonly
  | { kind: 'aura';      bundle: AuraBundle };
```

`intentSourceService.detectSource(intent)` trả về 1 trong 4. Logic:

1. Nếu Intent có `metadata.sourcePath` trỏ tới `.docx` / `.md` / `.html` → trả kind tương ứng.
2. Nếu không có file path → load `.aura` bundle từ store (nếu có).
3. Fallback: coi như Markdown thuần.

### 3.3. `.aura` bundle <a id="aura-bundle"></a>

Schema v1 (nguồn duy nhất, đặt ở `auraSchema.ts`):

```ts
interface AuraBundle {
  $schema: 'https://wordai.app/schemas/aura/v1.json';
  version: 1;
  intentId: string;
  canonical: 'markdown';
  markdown: string;            // bản đang được Promote (hoặc bản gần nhất)
  variants: AuraVariantEntry[];
  promotedVariantId: string | null;
  lastModified: string;        // ISO 8601
}

interface AuraVariantEntry {
  id: string;
  label: string;
  markdown: string;
  createdBy: 'user' | 'aurasphere';
  promptRef?: string;          // ID dẫn tới prompt + ngữ cảnh AuraSphere đã dùng
  createdAt: string;
}
```

### 3.4. Lưu trữ

| Loại Intent | Code view sửa Markdown → lưu vào đâu |
|-------------|--------------------------------------|
| `.md` có file path | Ghi đè file `.md` (qua `exportMarkdown` hiện có hoặc save trực tiếp) |
| `.html` có file path | Ghi đè file `.html` |
| `.docx` | **Không ghi** từ Code view (readonly). Chỉ Preview chỉnh và export ra `.docx` mới. |
| `.aura` | Cập nhật `markdown` + tương ứng `variants[i].markdown` trong bundle, lưu vào app data dir |

## 4. Pipeline transform

```
[Block JSON]  ⇄  [Markdown]  ⇄  [.aura.markdown]
       ↑                ↑
       └─ react-block   └─ blockToMarkdown / markdownToBlock
```

- Khi user gõ trong **Preview** → `blockContent` thay đổi → debounce 500ms → `blockToMarkdown` → cập nhật `.aura.markdown` (hoặc file `.md`).
- Khi user gõ trong **Code** (Markdown) → debounce 500ms → `markdownToBlock` → cập nhật `blockContent` → re-render Preview.
- Lỗi parse Markdown → giữ `blockContent` cũ, set `dirty=true` + show banner.

> Lưu ý: `react-block-text` block model không hỗ trợ mọi cú pháp Markdown (vd: bảng phức tạp). Trong giai đoạn 1 chấp nhận **lossy round-trip**: phần không hỗ trợ sẽ render thành code block thuần. Document rõ trong release notes.

## 5. AuraSphere integration

Hiện `AuraSpherePanel.tsx` chỉ trả về 1 đoạn text duy nhất. Cần mở rộng:

```ts
interface AuraSphereSuggestion {
  variants: { label: string; markdown: string; promptRef: string }[];
}
```

- Số phần tử trong `variants`: 1 ≤ n ≤ 3.
- `PrismCanvas` nhận `AuraSphereSuggestion`, đẩy vào các slot trống (giữ slot 1 = bản user). Slot bị `pinned=true` không bị ghi đè.

## 6. Performance

| Vấn đề | Giải pháp |
|--------|-----------|
| 3 instance `EditorCanvas` cùng render | Lazy mount: Variant ngoài focus dùng `<EditorCanvas/>` ở mode read-mostly (không setup keyboard listeners global) |
| Debounce parse 3 lần song song | Mỗi pane có hook `useMarkdownSync` riêng, `requestIdleCallback` cho parse, timeout 500ms |
| Sync scroll | Dùng `IntersectionObserver` + `% scrollTop`, không listen `scroll` event raw để giảm jank |
| Code view với file lớn | Virtualize bằng CodeMirror 6 (đã quen với React, dependency nhẹ) — chỉ load lazy khi user mở Code view |

## 7. Test strategy

| Layer | Tool | Phải có |
|-------|------|---------|
| Unit | Vitest | `blockToMarkdown` / `markdownToBlock` round-trip cho 20 ví dụ chuẩn (heading, list, todo, quote, code, link, …) |
| Unit | Vitest | `auraSchema` validate accept/reject các bundle bịa |
| Component | RTL | `PrismCanvas` mount → mở 2 Variant → Promote slot 2 → state về 1 Variant với content slot 2 |
| Component | RTL | View toggle giữ scroll position |
| Component | RTL | Code view nhập Markdown sai → banner lỗi, Preview không thay đổi |
| E2E (sau) | Playwright | Keyboard shortcuts (`Cmd+1`, `Cmd+P`, `Cmd+Enter`) |

> **Quan trọng**: viết test cho `markdownToBlock` **trước** khi implement parser — tham số đầu vào dễ rò rỉ edge case.

## 8. Migration & backward compat

- Intent đã tồn tại không có `sourcePath` → coi là `aura` mặc định, sinh bundle `.aura` lazy khi user mở Code view lần đầu.
- App version bump: `1.x` → `1.(x+1)` (minor — feature mới, không breaking).
- Setting mới trong preferences:
  ```jsonc
  "prism": {
    "defaultVariantCount": 1,        // 1 | 2 | 3
    "syncScroll": false,
    "codeViewFontSize": 13
  }
  ```

## 9. Lộ trình triển khai gợi ý

1. **M1 — Foundation** (1-2 ngày): types + `usePrismState` + skeleton `PrismCanvas` ôm 1 instance `EditorCanvas` (chưa có multi).
2. **M2 — Multi slot** (2 ngày): mở rộng layout 1/2/3 cột, action add/discard, slot trống.
3. **M3 — Code view + Markdown round-trip** (3 ngày): `blockToMarkdown`, `markdownToBlock`, view toggle, debounce parse, banner lỗi.
4. **M4 — `.aura` bundle** (2 ngày): schema, service load/save, sub-tab `.aura`.
5. **M5 — AuraSphere wiring** (2 ngày): panel sinh ra ≥ 2 Variant, lấp slot, Pin / Promote.
6. **M6 — Polish** (2 ngày): keyboard, sync scroll, accessibility, perf review.

## 10. Quyết định (đã resolved)

| # | Câu hỏi | Quyết định | Lý do |
|---|---------|-----------|-------|
| 1 | Tạo Intent mới hoàn toàn từ Code view? | **Không** | Code view là transformer (nguyên tắc #3), không phải creation tool. Flow tạo Intent mới phức tạp, nằm ngoài scope Prism. |
| 2 | OOXML editable ở milestone sau? | **Không — giữ readonly vĩnh viễn** | Không có library JS nào hỗ trợ in-place OOXML editing đáng tin cậy. User edit qua Preview + export `.docx` mới. |
| 3 | `.aura` versioned hay overwrite? | **Overwrite** | Nguyên tắc #4 "Persist tối thiểu". Delegate history cho Git / App Version History. Giữ schema đơn giản, dễ migrate. |
| 4 | Variant không Pin khi Promote: xoá hay archive? | **Archive** (thêm `archivedAt` field) | Tránh mất dữ liệu không phục hồi. Variant archived ẩn khỏi UI nhưng có thể truy cập qua "Variant History" sau này. |

### Chi tiết quyết định #4 — Schema update

```ts
interface AuraVariantEntry {
  id: string;
  label: string;
  markdown: string;
  createdBy: 'user' | 'aurasphere';
  promptRef?: string;
  createdAt: string;
  archivedAt?: string;  // ISO 8601, null/undefined = active
}
```

Khi Promote variant X:
1. `promotedVariantId = X.id`
2. `bundle.markdown = X.markdown`
3. Mỗi variant khác không có `pinned=true` → set `archivedAt = now()`
4. UI chỉ render variants có `archivedAt == null`
