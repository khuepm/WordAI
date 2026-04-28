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
