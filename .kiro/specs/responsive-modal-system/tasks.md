# Implementation Plan: Responsive Modal System

## Overview

Triển khai cơ chế responsive thống nhất cho `PreferencesDialog` và `QuickSearchPopup` trong WordAI Editor. Kế hoạch bao gồm: thêm CSS variables vào `variables.css`, tạo hook `useViewportSize`, refactor `PreferencesDialog` với `CollapsedSidebar` và `HorizontalTabBar`, cập nhật `QuickSearchPopup`, và cài đặt `fast-check` để viết property-based tests.

## Tasks

- [x] 1. Thêm CSS variables cho Modal System vào `variables.css`
  - Thêm block `/* Modal System */` vào `:root` trong `apps/wordai-editor/src/styles/variables.css`
  - Định nghĩa đủ 7 variables: `--modal-max-width-preferences`, `--modal-max-height-preferences`, `--modal-max-width-popup`, `--modal-sidebar-width`, `--modal-sidebar-collapsed-width`, `--modal-breakpoint-collapse`, `--modal-breakpoint-stack`
  - Đảm bảo mọi `var(--modal-*)` có fallback value inline
  - _Requirements: 5.1, 5.2_

- [x] 2. Tạo hook `useViewportSize`
  - [x] 2.1 Tạo file `apps/wordai-editor/src/hooks/useViewportSize.ts`
    - Export interface `ViewportSize { width: number; height: number }`
    - Export constant `MODAL_BREAKPOINTS = { COLLAPSE_SIDEBAR: 720, STACK_LAYOUT: 480 }`
    - Implement `useViewportSize()`: subscribe `window.resize` với debounce ~16ms, trả về `{ width, height }`, cleanup on unmount
    - Fallback `{ width: 1024, height: 768 }` khi `window` không khả dụng
    - _Requirements: 3.4_

  - [x] 2.2 Viết unit tests cho `useViewportSize`
    - Test initial value từ `window.innerWidth/innerHeight`
    - Test cleanup listener khi unmount
    - Test fallback values khi `window` không khả dụng
    - _Requirements: 3.4_

- [x] 3. Cập nhật `QuickSearchPopup` để dùng CSS variables
  - [x] 3.1 Sửa `apps/wordai-editor/src/components/QuickSearchPopup.tsx`
    - Thay `width: 560` bằng `maxWidth: 'var(--modal-max-width-popup, min(560px, calc(100vw - 32px)))'`
    - Thay `maxHeight: 8 * 64` bằng `maxHeight: 'min(512px, calc(100vh - 200px))'`
    - _Requirements: 1.3, 2.4_

  - [x] 3.2 Viết property test cho QuickSearchPopup width constraint (Property 2)
    - **Property 2: QuickSearchPopup width constraint**
    - **Validates: Requirements 1.3**
    - Cài `fast-check` nếu chưa có: `npm install --save-dev fast-check`
    - Tạo hoặc cập nhật `apps/wordai-editor/src/components/QuickSearchPopup.property.test.ts`
    - `fc.integer({ min: 200, max: 2560 })` → verify `maxWidth = min(560, vw - 32)`
    - Tag comment: `// Feature: responsive-modal-system, Property 2: QuickSearchPopup width constraint`
    - _Requirements: 1.3_

  - [x] 3.3 Viết property test cho QuickSearchPopup results height (Property 6)
    - **Property 6: QuickSearchPopup results list height constraint**
    - **Validates: Requirements 2.4**
    - `fc.integer({ min: 300, max: 1440 })` → verify `maxHeight = min(512, vh - 200)`
    - Tag comment: `// Feature: responsive-modal-system, Property 6: QuickSearchPopup results list height constraint`
    - _Requirements: 2.4_

- [x] 4. Checkpoint — Đảm bảo tests pass cho QuickSearchPopup
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Tạo `CollapsedSidebar` sub-component trong `PreferencesDialog`
  - [x] 5.1 Thêm `CollapsedSidebar` vào `apps/wordai-editor/src/components/PreferencesDialog.tsx`
    - Interface `CollapsedSidebarProps { activeTab, onTabChange, isSearching, onClearSearch }`
    - Render icon-only buttons với `width: var(--modal-sidebar-collapsed-width, 64px)`
    - Mỗi button có `aria-label` chứa tên đầy đủ của tab
    - Tích hợp `Tooltip` component hiện có để hiển thị tên tab khi hover
    - _Requirements: 3.1, 4.5, 6.1_

  - [x] 5.2 Viết property test cho collapsed sidebar (Property 3)
    - **Property 3: Collapsed sidebar layout and accessibility**
    - **Validates: Requirements 3.1, 6.1**
    - `fc.integer({ min: 200, max: 719 })` → verify sidebar collapsed + aria-label đầy đủ
    - Tag comment: `// Feature: responsive-modal-system, Property 3: Collapsed sidebar layout and accessibility`
    - _Requirements: 3.1, 6.1_

- [x] 6. Tạo `HorizontalTabBar` sub-component trong `PreferencesDialog`
  - [x] 6.1 Thêm `HorizontalTabBar` vào `apps/wordai-editor/src/components/PreferencesDialog.tsx`
    - Interface `HorizontalTabBarProps { activeTab, onTabChange }`
    - `role="tablist"` trên container, mỗi tab có `role="tab"` và `aria-selected`
    - Hiển thị ở trên cùng khi layout stacked
    - _Requirements: 3.2, 6.2_

  - [x] 6.2 Viết property test cho stacked layout và ARIA roles (Property 4)
    - **Property 4: Stacked layout and ARIA roles**
    - **Validates: Requirements 3.2, 6.2**
    - `fc.integer({ min: 200, max: 479 })` + `fc.constantFrom(...)` → verify tablist/tab roles + aria-selected
    - Tag comment: `// Feature: responsive-modal-system, Property 4: Stacked layout and ARIA roles`
    - _Requirements: 3.2, 6.2_

- [x] 7. Refactor `PreferencesDialog` — responsive layout và CSS variables
  - [x] 7.1 Tích hợp `useViewportSize` vào `PreferencesDialog`
    - Import và gọi `useViewportSize()` để lấy `{ width, height }`
    - Tính `isCollapsed = width < MODAL_BREAKPOINTS.COLLAPSE_SIDEBAR`
    - Tính `isStacked = width < MODAL_BREAKPOINTS.STACK_LAYOUT`
    - Render `CollapsedSidebar` khi `isCollapsed && !isStacked`, `HorizontalTabBar` khi `isStacked`
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 7.2 Cập nhật kích thước modal dùng CSS variables
    - Thay hardcode `width`/`height` bằng `maxWidth: 'var(--modal-max-width-preferences, ...)'` và `maxHeight: 'var(--modal-max-height-preferences, ...)'`
    - Đảm bảo `Content_Area` có `overflow-y: auto`, `height: '100%'`, và `minWidth: 0` trên flex children
    - Đảm bảo `Overlay` có `position: fixed`, `inset: 0`, `aria-hidden="true"`
    - Đảm bảo modal được căn giữa bằng `alignItems: 'center'`, `justifyContent: 'center'`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.3, 4.4, 5.2_

  - [x] 7.3 Cập nhật grid layouts bên trong `Content_Area` sang `auto-fit/minmax`
    - `repeat(4, 1fr)` (theme) → `repeat(auto-fit, minmax(120px, 1fr))`
    - `repeat(3, 1fr)` (agent) → `repeat(auto-fit, minmax(140px, 1fr))`
    - `repeat(2, 1fr)` (model, language+knowledge) → `repeat(auto-fit, minmax(200px, 1fr))`
    - _Requirements: 3.5, 3.6_

  - [x] 7.4 Viết property test cho PreferencesDialog size constraints (Property 1)
    - **Property 1: PreferencesDialog size constraints**
    - **Validates: Requirements 1.1, 1.2**
    - `fc.integer({ min: 200, max: 2560 })` × `fc.integer({ min: 200, max: 1440 })` → verify maxWidth + maxHeight
    - Tag comment: `// Feature: responsive-modal-system, Property 1: PreferencesDialog size constraints`
    - _Requirements: 1.1, 1.2_

  - [x] 7.5 Viết property test cho state preservation (Property 5)
    - **Property 5: State preservation across resize**
    - **Validates: Requirements 4.1, 4.2**
    - Render dialog, set scroll + active tab, trigger resize → verify không thay đổi
    - Tag comment: `// Feature: responsive-modal-system, Property 5: State preservation across resize`
    - _Requirements: 4.1, 4.2_

- [x] 8. Triển khai focus trap và accessibility
  - [x] 8.1 Thêm focus trap vào `PreferencesDialog`
    - Khi dialog mở, đặt focus vào phần tử đầu tiên có thể tương tác
    - Xử lý Tab/Shift+Tab để giữ focus trong modal (focus trap)
    - Không kích hoạt focus trap nếu modal không có focusable elements
    - _Requirements: 6.3, 6.4_

  - [x] 8.2 Viết property test cho focus trap (Property 7)
    - **Property 7: Focus trap within modal**
    - **Validates: Requirements 6.3**
    - `fc.integer({ min: 1, max: 20 })` Tab presses → verify focused element luôn trong modal
    - Tag comment: `// Feature: responsive-modal-system, Property 7: Focus trap within modal`
    - _Requirements: 6.3_

  - [x] 8.3 Viết unit tests cho accessibility
    - Test `Overlay` có `aria-hidden="true"`
    - Test focus được đặt vào phần tử đầu tiên khi dialog mở
    - Test tooltip hiển thị tên đầy đủ khi hover vào collapsed sidebar icon
    - _Requirements: 4.5, 6.4, 6.5_

- [x] 9. Final checkpoint — Đảm bảo toàn bộ tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks đánh dấu `*` là optional, có thể bỏ qua để ra MVP nhanh hơn
- `fast-check` cần được cài thêm: `npm install --save-dev fast-check` trong `apps/wordai-editor/`
- Mỗi property test phải có comment tag `// Feature: responsive-modal-system, Property N: ...`
- Property tests chạy tối thiểu 100 iterations (`numRuns: 100`)
- Scroll position và active tab được giữ tự nhiên — không cần logic đặc biệt nếu component không unmount khi resize
