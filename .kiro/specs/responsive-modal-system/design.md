# Design Document: Responsive Modal System

## Overview

Tính năng này xây dựng cơ chế responsive thống nhất cho toàn bộ các Popup và Modal trong WordAI Editor (Tauri/React). Mục tiêu là đảm bảo `PreferencesDialog` và `QuickSearchPopup` — cùng mọi modal được thêm vào sau này — tự động co giãn theo viewport, không bị vỡ layout, và duy trì khả năng tiếp cận (accessibility) ở mọi kích thước cửa sổ.

Giải pháp tập trung vào ba trụ cột:
1. **CSS Variables tập trung** — tất cả kích thước, breakpoint, và spacing của modal được định nghĩa một lần trong `variables.css`.
2. **CSS-first responsiveness** — dùng `min()`, `clamp()`, media queries, và CSS Grid `auto-fit/minmax` thay vì JavaScript resize listeners.
3. **React hook `useViewportSize`** — chỉ dùng cho logic layout phức tạp (collapsed sidebar, single-column stack) cần điều kiện render.

---

## Architecture

```mermaid
graph TD
    A[variables.css<br/>CSS Design Tokens] --> B[PreferencesDialog.tsx]
    A --> C[QuickSearchPopup.tsx]
    A --> D[Future Modals]

    B --> E[useViewportSize hook]
    E --> F{viewport < 720px?}
    F -->|Yes| G[CollapsedSidebar<br/>icon-only, 64px]
    F -->|No| H[FullSidebar<br/>256px]

    E --> I{viewport < 480px?}
    I -->|Yes| J[Single-column layout<br/>horizontal tab bar]
    I -->|No| K[Two-column layout<br/>sidebar + content]

    B --> L[Content Area<br/>overflow-y: auto<br/>custom scrollbar]
    C --> M[Results List<br/>max-height: min(512px, 100vh-200px)]
```

Luồng dữ liệu:
- CSS variables được đọc trực tiếp bởi các component qua `var(--modal-*)`.
- `useViewportSize` subscribe vào `window.resize` event và trả về `{ width, height }` hiện tại.
- Các component dùng giá trị từ hook để quyết định render variant nào (collapsed/full sidebar, stacked/side-by-side layout).
- Scroll position và active tab được giữ trong React state — không bị reset khi resize vì chúng không phụ thuộc vào viewport size.

---

## Components and Interfaces

### 1. `useViewportSize` hook

```typescript
// src/hooks/useViewportSize.ts
interface ViewportSize {
  width: number;
  height: number;
}

function useViewportSize(): ViewportSize
```

- Subscribe vào `window.resize` với debounce ~16ms (một animation frame).
- Trả về kích thước viewport hiện tại.
- Cleanup listener khi component unmount.

### 2. CSS Variables mới trong `variables.css`

```css
/* Modal System */
--modal-max-width-preferences: min(900px, calc(100vw - 48px));
--modal-max-height-preferences: min(680px, calc(100vh - 80px));
--modal-max-width-popup: min(560px, calc(100vw - 32px));
--modal-sidebar-width: 256px;
--modal-sidebar-collapsed-width: 64px;
--modal-breakpoint-collapse: 720px;
--modal-breakpoint-stack: 480px;
```

### 3. `PreferencesDialog` — thay đổi layout

**Props không thay đổi:**
```typescript
interface PreferencesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: Tab;
  targetSettingId?: string;
}
```

**Thay đổi nội bộ:**
- Dùng `useViewportSize()` để xác định `isCollapsed` (width < 720px) và `isStacked` (width < 480px).
- Khi `isCollapsed`: Sidebar chỉ hiển thị icon + tooltip.
- Khi `isStacked`: Layout chuyển sang một cột, sidebar thành horizontal tab bar ở trên.
- `Content_Area` luôn có `overflow-y: auto` và `height: 100%`.

### 4. `CollapsedSidebar` sub-component

```typescript
interface CollapsedSidebarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  isSearching: boolean;
  onClearSearch: () => void;
}
```

- Render các nút icon-only (width: 64px).
- Mỗi nút có `aria-label` đầy đủ tên tab.
- Tooltip hiển thị tên tab khi hover.

### 5. `HorizontalTabBar` sub-component (stacked layout)

```typescript
interface HorizontalTabBarProps {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
}
```

- `role="tablist"`, mỗi tab có `role="tab"` và `aria-selected`.
- Hiển thị ở trên cùng khi viewport < 480px.

### 6. `QuickSearchPopup` — thay đổi

- Thay `width: 560` hardcode bằng `maxWidth: 'var(--modal-max-width-popup)'`.
- Thay `maxHeight: 8 * 64` bằng `maxHeight: 'min(512px, calc(100vh - 200px))'`.

---

## Data Models

Không có data model mới. Các thay đổi chỉ ảnh hưởng đến presentation layer.

### Breakpoint Constants (TypeScript)

Để dùng trong hook và tests:

```typescript
// src/hooks/useViewportSize.ts
export const MODAL_BREAKPOINTS = {
  COLLAPSE_SIDEBAR: 720,  // px — sidebar thu gọn thành icon-only
  STACK_LAYOUT: 480,      // px — layout chuyển sang một cột
} as const;
```

### Scroll Position Preservation

Scroll position của `Content_Area` được giữ tự nhiên vì:
- Component không unmount/remount khi resize.
- `overflow-y: auto` trên container giữ scroll position trong DOM.
- Chỉ khi tab thay đổi mới reset scroll về 0 (behavior hiện tại, không thay đổi).

### Grid Layout Patterns

Các grid bên trong `Content_Area` chuyển từ fixed columns sang responsive:

| Grid hiện tại | Grid mới |
|---|---|
| `repeat(4, 1fr)` (theme) | `repeat(auto-fit, minmax(120px, 1fr))` |
| `repeat(3, 1fr)` (agent) | `repeat(auto-fit, minmax(140px, 1fr))` |
| `repeat(2, 1fr)` (model) | `repeat(auto-fit, minmax(200px, 1fr))` |
| `1fr 1fr` (language+knowledge) | `repeat(auto-fit, minmax(200px, 1fr))` |


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Property Reflection:** Sau khi phân tích prework, các property được hợp nhất như sau:
- 1.1 và 1.2 (PreferencesDialog size constraints) → **Property 1** (gộp width + height).
- 1.3 (QuickSearchPopup width constraint) → **Property 2**.
- 3.1 (collapsed sidebar khi width < 720) và 6.1 (aria-label trên collapsed sidebar) → **Property 3** (gộp layout + accessibility).
- 3.2 (stacked layout khi width < 480) và 6.2 (ARIA roles trong stacked layout) → **Property 4** (gộp layout + accessibility).
- 4.1 (scroll position preserved) và 4.2 (active tab preserved) → **Property 5** (gộp state preservation).
- 2.4 (QuickSearchPopup results height) → **Property 6**.
- 6.3 (focus trap) → **Property 7**.

---

### Property 1: PreferencesDialog size constraints

*For any* viewport width and height, the `PreferencesDialog` SHALL have `maxWidth = min(900px, vw - 48px)` and `maxHeight = min(680px, vh - 80px)`, ensuring the dialog never exceeds the viewport bounds.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: QuickSearchPopup width constraint

*For any* viewport width, the `QuickSearchPopup` SHALL have `maxWidth = min(560px, vw - 32px)`, ensuring the popup never overflows the viewport horizontally.

**Validates: Requirements 1.3**

---

### Property 3: Collapsed sidebar layout and accessibility

*For any* viewport width less than 720px, the `PreferencesDialog` sidebar SHALL be in collapsed state (icon-only, width 64px), and each collapsed tab button SHALL have an `aria-label` attribute containing the full tab name.

**Validates: Requirements 3.1, 6.1**

---

### Property 4: Stacked layout and ARIA roles

*For any* viewport width less than 480px, the `PreferencesDialog` SHALL render a single-column layout with a horizontal tab bar, where the tab bar has `role="tablist"`, each tab has `role="tab"`, and the active tab has `aria-selected="true"`.

**Validates: Requirements 3.2, 6.2**

---

### Property 5: State preservation across resize

*For any* scroll position and active tab in `PreferencesDialog`, resizing the viewport SHALL NOT change the scroll position of the `Content_Area` nor the currently active tab.

**Validates: Requirements 4.1, 4.2**

---

### Property 6: QuickSearchPopup results list height constraint

*For any* viewport height, the results list in `QuickSearchPopup` SHALL have `maxHeight = min(512px, vh - 200px)`, ensuring the list never overflows the viewport vertically.

**Validates: Requirements 2.4**

---

### Property 7: Focus trap within modal

*For any* open modal state and any sequence of Tab key presses, focus SHALL remain within the modal's focusable elements and SHALL NOT escape to elements outside the modal.

**Validates: Requirements 6.3**

---

## Error Handling

### Viewport Size Edge Cases

| Tình huống | Xử lý |
|---|---|
| Viewport width = 0 hoặc rất nhỏ | `min()` CSS function tự xử lý — modal sẽ có width = vw - padding, không âm |
| Viewport height < 80px | `calc(100vh - 80px)` có thể âm — cần clamp tối thiểu 200px cho height |
| `window.innerWidth` không khả dụng (SSR) | `useViewportSize` trả về default values `{ width: 1024, height: 768 }` |
| Resize event fired quá nhanh | Debounce 16ms trong `useViewportSize` ngăn re-render quá nhiều |

### Focus Trap Failures

- Nếu modal không có focusable elements: focus trap không kích hoạt, tránh infinite loop.
- Nếu `targetSettingId` không tồn tại trong DOM: scroll-to-setting bị bỏ qua silently, không throw error.

### CSS Variable Fallbacks

Mọi `var(--modal-*)` đều có fallback value inline để tránh layout broken nếu CSS file chưa load:

```css
max-width: var(--modal-max-width-preferences, min(900px, calc(100vw - 48px)));
```

---

## Testing Strategy

### Công cụ

- **Unit/Component tests**: Vitest + React Testing Library (đã có trong project).
- **Property-based tests**: `fast-check` — thư viện PBT cho TypeScript/JavaScript, tích hợp tốt với Vitest.

### Cài đặt fast-check

```bash
npm install --save-dev fast-check
```

### Unit Tests (Example-based)

Các test cụ thể cho behavior không phù hợp với PBT:

- `PreferencesDialog` renders với `overflow-y: auto` trên content area.
- Sidebar không scroll khi content area scroll.
- Overlay có `position: fixed`, `inset: 0`, và `aria-hidden="true"`.
- Modal được căn giữa bằng flexbox.
- Focus được đặt vào phần tử đầu tiên khi dialog mở.
- Tooltip hiển thị tên đầy đủ khi hover vào collapsed sidebar icon.
- CSS variables được định nghĩa trong `variables.css`.

### Property-Based Tests (fast-check, tối thiểu 100 iterations mỗi property)

Mỗi property test phải có comment tag theo format:
`// Feature: responsive-modal-system, Property {N}: {property_text}`

**Property 1 — PreferencesDialog size constraints:**
```typescript
// Feature: responsive-modal-system, Property 1: PreferencesDialog size constraints
fc.assert(fc.property(
  fc.integer({ min: 200, max: 2560 }), // viewport width
  fc.integer({ min: 200, max: 1440 }), // viewport height
  (vw, vh) => {
    // render với mock viewport size
    // verify maxWidth = min(900, vw - 48)
    // verify maxHeight = min(680, vh - 80)
  }
), { numRuns: 100 });
```

**Property 2 — QuickSearchPopup width constraint:**
```typescript
// Feature: responsive-modal-system, Property 2: QuickSearchPopup width constraint
fc.assert(fc.property(
  fc.integer({ min: 200, max: 2560 }),
  (vw) => {
    // verify maxWidth = min(560, vw - 32)
  }
), { numRuns: 100 });
```

**Property 3 — Collapsed sidebar layout and accessibility:**
```typescript
// Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility
fc.assert(fc.property(
  fc.integer({ min: 200, max: 719 }), // width < 720
  (vw) => {
    // render PreferencesDialog với viewport width = vw
    // verify sidebar is collapsed (width 64px)
    // verify each tab button has aria-label with full tab name
  }
), { numRuns: 100 });
```

**Property 4 — Stacked layout and ARIA roles:**
```typescript
// Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles
fc.assert(fc.property(
  fc.integer({ min: 200, max: 479 }), // width < 480
  fc.constantFrom('general', 'ai-engine', 'typography', 'privacy'),
  (vw, activeTab) => {
    // render PreferencesDialog với viewport width = vw, activeTab
    // verify single-column layout
    // verify tablist role, tab roles, aria-selected on active tab
  }
), { numRuns: 100 });
```

**Property 5 — State preservation across resize:**
```typescript
// Feature: responsive-modal-system, Property 5: State preservation across resize
fc.assert(fc.property(
  fc.integer({ min: 0, max: 500 }),    // scroll position
  fc.constantFrom('general', 'ai-engine', 'typography', 'privacy'),
  fc.integer({ min: 400, max: 1200 }), // new viewport width after resize
  (scrollPos, activeTab, newVw) => {
    // render dialog, set scroll + active tab
    // trigger resize to newVw
    // verify scroll position unchanged, active tab unchanged
  }
), { numRuns: 100 });
```

**Property 6 — QuickSearchPopup results list height:**
```typescript
// Feature: responsive-modal-system, Property 6: QuickSearchPopup results list height constraint
fc.assert(fc.property(
  fc.integer({ min: 300, max: 1440 }),
  (vh) => {
    // render QuickSearchPopup với viewport height = vh
    // verify results list maxHeight = min(512, vh - 200)
  }
), { numRuns: 100 });
```

**Property 7 — Focus trap:**
```typescript
// Feature: responsive-modal-system, Property 7: Focus trap within modal
fc.assert(fc.property(
  fc.integer({ min: 1, max: 20 }), // number of Tab key presses
  (tabPresses) => {
    // render PreferencesDialog
    // press Tab N times
    // verify focused element is always within modal
  }
), { numRuns: 100 });
```

### Integration Tests

- Mở `PreferencesDialog`, resize window, verify modal vẫn hiển thị đúng.
- Keyboard navigation (Tab, Shift+Tab, Escape) hoạt động đúng ở mọi layout variant.
