# Implementation Plan: Quick Settings Search

## Overview

Implement a Command Palette-style popup (`QuickSearch_Popup`) triggered by `Cmd+Shift+P` / `Ctrl+Shift+P` that lets users search and navigate to any setting in `PreferencesDialog`. The work spans: TypeScript types and `SettingRegistry`, a Rust `PreferencesStore` backend, a `PreferencesService` frontend service, the `QuickSearchPopup` React component, and wiring everything into `App.tsx` and `PreferencesDialog`.

## Tasks

- [x] 1. Define TypeScript types and SettingRegistry
  - [x] 1.1 Create `src/types/preferences.ts` with `Preferences`, `SettingEntry`, `Tab` union type, and `defaultPreferences` object
    - Define `Tab = 'general' | 'ai-engine' | 'typography' | 'privacy'`
    - Define `SettingEntry` interface with fields: `id`, `label`, `description`, `tab`, `keywords`, `type`, `defaultValue`
    - Define `Preferences` interface with groups: `general`, `aiEngine`, `typography`, `privacy`
    - Export `defaultPreferences` constant with all default values
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.2 Create `src/data/settingRegistry.ts` with the flat `SETTING_REGISTRY` array
    - Add entries for General tab: `theme`, `autoSave`, `focusMode`, `language`
    - Add entries for AI Engine tab: `agent`, `model`, `creativity`, `contextWindowTokens`, `responseLanguage`, `webAccess`
    - Add entries for Typography tab: `fontFamily`, `fontSize`, `lineSpacing`, `smartQuotes`, `autoCapitalize`, `ligatures`
    - Add entries for Privacy tab: `allowAITraining`, `analyticsEnabled`, `crashReports`, `localProcessingOnly`
    - Each entry must have `id` in `"tab.settingName"` format
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [x] 1.3 Write property test for SettingRegistry completeness
    - **Property 1: Every SettingEntry has all required fields non-empty**
    - **Property 2: Every `id` follows the `"tab.settingName"` format and `tab` field matches the prefix**
    - **Validates: Requirements 5.6**

- [x] 2. Create Rust PreferencesStore backend
  - [x] 2.1 Create `src-tauri/src/preferences_store.rs` with load/save/reset logic
    - Implement `load_preferences(user_id)` — reads `user_{userId}.json`, merges with `default.json` for missing keys
    - Implement `save_preferences(user_id, preferences)` — writes `user_{userId}.json`
    - Implement `reset_preferences(user_id, group)` — resets one group or all to `default.json` values
    - Return descriptive `IPCError` on any file I/O failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 2.2 Create `public/preferences/default.json` with all default preference values
    - Must include all keys matching `defaultPreferences` in `src/types/preferences.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 2.3 Register `load_preferences`, `save_preferences`, `reset_preferences` commands in `src-tauri/src/lib.rs`
    - Add `pub mod preferences_store;` and wire commands into `invoke_handler`
    - _Requirements: 7.1, 7.3, 7.4_

  - [x] 2.4 Write unit tests for PreferencesStore in Rust
    - Test `load_preferences` returns defaults when file missing
    - Test `save_preferences` then `load_preferences` round-trips correctly
    - Test `reset_preferences` with group resets only that group
    - _Requirements: 7.2, 7.5, 7.6_

- [-] 3. Create PreferencesService frontend
  - [x] 3.1 Create `src/services/preferencesService.ts` with `loadPreferences`, `savePreferences`, `resetPreferences` functions
    - Each function calls the corresponding Tauri IPC command via `invoke`
    - Add mock handlers for `load_preferences`, `save_preferences`, `reset_preferences` in `src/mocks/tauri.ts`
    - _Requirements: 6.1, 7.1, 7.3, 7.4_

  - [-] 3.2 Write unit tests for PreferencesService
    - Test that each function calls the correct IPC command with correct args
    - Test error propagation when IPC returns an error
    - _Requirements: 7.7_

- [~] 4. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement QuickSearchPopup component
  - [~] 5.1 Create `src/components/QuickSearchPopup.tsx` with search input, filtered results list, and keyboard navigation
    - Render as a centered overlay modal with a backdrop
    - Auto-focus the search input on open
    - Filter `SETTING_REGISTRY` by `label`, `description`, and `keywords` (case-insensitive, real-time)
    - Show full list when input is empty; show "No settings found" when no matches
    - Cap visible results at 8 with scroll
    - Highlight first result by default; support arrow-up/arrow-down to move highlight
    - Show `label`, `description`, and a tab badge per result item
    - Close on `Escape` or backdrop click
    - Call `onSelect(entry)` on `Enter` or result click
    - _Requirements: 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 4.4_

  - [~] 5.2 Write property test for search filtering
    - **Property 3: For any non-empty query string, every result item contains the query in label, description, or at least one keyword (case-insensitive)**
    - **Property 4: When query is empty, result count equals total SETTING_REGISTRY length**
    - **Validates: Requirements 2.2, 2.3, 2.4**

  - [~] 5.3 Write unit tests for QuickSearchPopup
    - Test Escape closes the popup
    - Test backdrop click closes the popup
    - Test "No settings found" renders when no matches
    - Test arrow key navigation moves highlight
    - Test Enter on highlighted item calls onSelect
    - _Requirements: 1.3, 1.4, 3.4, 3.5, 4.1, 4.2_

- [ ] 6. Wire keyboard shortcut and navigation into App.tsx and PreferencesDialog
  - [~] 6.1 Add `isQuickSearchOpen` state and `Cmd+Shift+P` / `Ctrl+Shift+P` global keydown listener in `App.tsx`
    - Register listener in a `useEffect`, clean up on unmount
    - Pass `isQuickSearchOpen`, `onClose`, and `onSelect` props to `QuickSearchPopup`
    - _Requirements: 1.1, 1.2_

  - [~] 6.2 Handle `onSelect` in `App.tsx`: close popup, open `PreferencesDialog` on the correct tab, pass `targetSettingId`
    - Add `initialTab` and `targetSettingId` props to `PreferencesDialog`
    - _Requirements: 4.1, 4.2_

  - [~] 6.3 In `PreferencesDialog`, scroll to the target setting within 300ms of opening
    - Add `data-setting-id` attributes to each setting row in all four tab components
    - On mount (or when `targetSettingId` changes), use `scrollIntoView` with a short delay
    - _Requirements: 4.3_

  - [~] 6.4 Write unit tests for keyboard shortcut activation
    - Test that `Cmd+Shift+P` fires and sets `isQuickSearchOpen` to true
    - Test that `Ctrl+Shift+P` fires and sets `isQuickSearchOpen` to true
    - _Requirements: 1.1, 1.2_

- [~] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The Rust backend (tasks 2.x) and TypeScript types (task 1.x) can be developed in parallel
- Property tests validate universal correctness properties; unit tests cover specific edge cases
