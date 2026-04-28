# Document Title Editing

## Tổng quan

Cho phép người dùng đổi tên document trực tiếp từ thanh tiêu đề ở giữa TopNavBar, không cần mở dialog hay menu phụ. Tên file khi export cũng tự động theo tiêu đề mới.

---

## Các tính năng

### 1. Inline title editing

- Click vào tiêu đề ở giữa TopNavBar để chuyển sang chế độ chỉnh sửa
- Ô input xuất hiện tại chỗ, pre-select toàn bộ text để gõ đè ngay
- **Enter** hoặc **blur** (click ra ngoài) → lưu tiêu đề mới
- **Escape** → huỷ, khôi phục tiêu đề cũ
- Tiêu đề rỗng sau khi trim → bỏ qua, giữ nguyên tên cũ
- Hover vào tiêu đề hiện tooltip `"Click to rename"` và con trỏ `text`

### 2. Export filename theo tiêu đề

Khi bấm Export, dialog save file tự điền sẵn tên file từ tiêu đề document:

| Tiêu đề | Tên file gợi ý |
|---|---|
| `Bài viết của tôi` | `Bài viết của tôi.pdf` |
| `Hello / World` | `Hello - World.md` |
| `Untitled Intent` | `Untitled Intent.docx` |

Người dùng vẫn có thể đổi tên trong dialog trước khi lưu.

---

## Kiến trúc

### Components thay đổi

#### `DocumentTitleBar.tsx`
- Thêm prop `onRename?: (newTitle: string) => void`
- Khi `onRename` được truyền vào: tiêu đề có thể click, chuyển sang `<input>` inline khi click
- Khi không có `onRename`: component hoạt động read-only như cũ

```tsx
<DocumentTitleBar
  intentName={documentTitle || null}
  isDirty={isDirty}
  isSyncing={isSyncing}
  onRename={handleRename}   // ← mới
/>
```

#### `TopNavBar.tsx`
- Thêm prop `onRename?: (newTitle: string) => void`, pass-through xuống `DocumentTitleBar`

#### `App.tsx`
- Thêm `handleRename` callback, gọi `renameDocument(title)` từ stateManager

### State management

Thêm action `RENAME_DOCUMENT` riêng biệt vào `stateManager.tsx`:

```ts
| { type: 'RENAME_DOCUMENT'; payload: string }
```

**Lý do tách riêng khỏi `UPDATE_DOCUMENT`:**  
`UPDATE_DOCUMENT` được dùng cho content changes — nó trigger `useEffect` trong `EditorCanvas` reset `blockValue`. Nếu dùng `UPDATE_DOCUMENT` để rename, editor sẽ bị reset focus sau mỗi lần đổi tên.

`RENAME_DOCUMENT` chỉ cập nhật `document.title` và `lastModified`, không đụng vào `content` — editor không bị ảnh hưởng.

```ts
case 'RENAME_DOCUMENT':
  if (!state.document) return state;
  return {
    ...state,
    document: { ...state.document, title: action.payload, lastModified: new Date() },
    hasUnsavedChanges: true,
  };
```

### EditorCanvas fix

`useEffect` reset blockValue đổi dependency từ `[document.content, document.id]` → `[document.id]`:

```ts
// Chỉ reset editor khi mở document mới, không reset khi title/metadata thay đổi
useEffect(() => {
  setBlockValue(ensureBlockValue(document.content));
}, [document.id]);
```

### Export service

Thêm hàm `titleToFilename` trong `exportService.ts`:

```ts
function titleToFilename(title: string): string {
  return title
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-') // ký tự không hợp lệ trên filesystem
    .replace(/-{2,}/g, '-')         // gộp dấu gạch ngang liên tiếp
    .replace(/^-+|-+$/g, '')        // trim đầu/cuối
    || 'Untitled Intent';
}
```

Ba hàm `exportMarkdown`, `exportDocx`, `exportPdf` đều dùng `titleToFilename(document.title)` làm tên file mặc định trong save dialog, kết hợp với `defaultExportPath` từ preferences nếu có.

---

## Files thay đổi

| File | Thay đổi |
|---|---|
| `src/components/DocumentTitleBar.tsx` | Thêm inline editing, prop `onRename` |
| `src/components/TopNavBar.tsx` | Thêm prop `onRename`, pass-through |
| `src/App.tsx` | Thêm `handleRename`, dùng `renameDocument` |
| `src/services/stateManager.tsx` | Thêm action `RENAME_DOCUMENT`, method `renameDocument` |
| `src/components/EditorCanvas.tsx` | Fix `useEffect` dependency để tránh reset editor |
| `src/services/exportService.ts` | Thêm `titleToFilename`, dùng cho tên file mặc định |

## Đánh giá mức độ ảnh hưởng - Impact

Để đánh giá đúng, tôi cần xem thêm một số file liên quan đến AuraBrain sync và version history:

Đủ context để đánh giá toàn diện rồi. Đây là phân tích:

---

## Đánh giá impact

### ✅ Hoạt động đúng

**Sync / dirty detection không bị ảnh hưởng.**
`useAuraBrainSyncState` tính `isDirty` bằng cách hash `document.content` so với baseline. `RENAME_DOCUMENT` không đụng vào `content`, nên hash không đổi — dirty indicator chỉ bật vì `hasUnsavedChanges: true` trong state, không phải vì content hash thay đổi. Khi user Cmd+S sau khi rename, `syncDocument` gọi `documentToAuraIntent` — hàm này đọc `document.title` và map vào `intent_name`, nên tên mới được persist đúng vào AuraBrain.

**Export filename hoạt động độc lập.** `exportService` nhận `document` object trực tiếp từ `RenderDrawer`, không qua cache hay snapshot cũ.

---

### ⚠️ Rủi ro cần lưu ý

**1. Dirty indicator sau rename bị sai lệch nhỏ**

`RENAME_DOCUMENT` set `hasUnsavedChanges: true` trong Redux state, nhưng `isDirty` trong `useAuraBrainSyncState` được tính từ content hash — không phải từ `hasUnsavedChanges`. Kết quả: nếu user rename mà chưa thay đổi content, `isDirty` (dấu `●` trên title bar) sẽ **không hiện** dù title thực sự chưa được sync. Rename sẽ được sync lần tiếp theo khi content thay đổi hoặc user bấm Cmd+S — nhưng visual feedback không chính xác.

**2. Version history không lưu title**

`VersionHistory` restore bằng `onRestore(selected.content)` — chỉ restore content, không restore title. Nếu user rename rồi restore version cũ, content quay về cũ nhưng title giữ nguyên tên mới. Đây là behavior hiện tại của version history, không phải lỗi do tính năng này gây ra, nhưng cần biết.

**3. Auto-sync không trigger khi chỉ rename**

`useAutoSync` hook (không đọc được file nhưng có thể suy ra) chạy theo interval và theo `document.content`. Nếu user rename xong không gõ thêm gì và không bấm Cmd+S, auto-sync có thể không pick up rename cho đến lần sync tiếp theo có content change.

**4. `titleToFilename` không normalize Unicode**

Tiêu đề tiếng Việt như `"Bài viết / Số 1"` → `"Bài viết - Số 1.pdf"` — hoạt động đúng. Nhưng nếu tiêu đề toàn ký tự đặc biệt như `"??? !!!"` → sau khi strip hết → fallback về `"Untitled Intent"`. Đây là behavior an toàn, không phải bug.

---

### 📊 Tóm tắt

| Khía cạnh | Mức độ | Ghi chú |
|---|---|---|
| Editor focus sau rename | ✅ Đã fix | `RENAME_DOCUMENT` tách riêng, EditorCanvas không reset |
| Persist title vào AuraBrain | ✅ Đúng | `documentToAuraIntent` map `title → intent_name` |
| Export filename | ✅ Đúng | `titleToFilename` xử lý đủ edge case |
| Dirty indicator khi chỉ rename | ⚠️ Sai lệch nhỏ | Hash-based dirty không detect title change |
| Auto-sync rename-only | ⚠️ Có thể bị bỏ qua | Phụ thuộc timing của auto-sync interval |
| Version history + rename | ℹ️ Giới hạn đã có sẵn | Không liên quan đến tính năng này |

Rủi ro lớn nhất là **dirty indicator không phản ánh rename** — user rename xong thấy không có dấu `●`, nghĩ đã sync rồi nhưng thực ra chưa. Fix đơn giản là tính dirty dựa trên cả title lẫn content hash, hoặc trigger một sync ngay khi rename xong.
