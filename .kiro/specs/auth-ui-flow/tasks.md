# Implementation Plan: Auth UI Flow

## Overview

Implement the Authentication UI Flow and User Personalization for the WordAI desktop application. This covers the Auth Modal (login/signup/forgot-password), User Menu dropdown (authenticated/guest states), preference cloud sync, and Preferences Window updates. All UI must strictly follow the HTML mockups in `ui/user-management/`.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1], "description": "Firebase SDK setup and error mapping" },
    { "wave": 2, "tasks": [2], "description": "AuthModal shell with focus trap and transitions" },
    { "wave": 3, "tasks": [3, 4, 5], "description": "Auth form components (login, signup, forgot password)" },
    { "wave": 4, "tasks": [6], "description": "Checkpoint — verify auth modal" },
    { "wave": 5, "tasks": [7], "description": "User Menu components (authenticated + guest)" },
    { "wave": 6, "tasks": [8], "description": "Sign out and session restoration" },
    { "wave": 7, "tasks": [9], "description": "Preference cloud sync service" },
    { "wave": 8, "tasks": [10], "description": "Preferences Window UI updates" },
    { "wave": 9, "tasks": [11], "description": "i18n translations" },
    { "wave": 10, "tasks": [12], "description": "Final integration and verification" }
  ]
}
```

## Tasks

- [x] 1. Set up Firebase client SDK and auth service
  - [x] 1.1 Create `src/services/firebaseApp.ts`
    - Initialize Firebase app with config from environment variables (VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID)
    - Export `app` and `auth` instances
    - _Requirements: 2.5, 4.6, 5.6_

  - [x] 1.2 Create `src/services/firebaseAuthService.ts`
    - Implement `firebaseSignIn(email, password): Promise<string>` — returns ID token
    - Implement `firebaseSignUp(email, password, displayName): Promise<string>` — creates user, sets displayName, returns ID token
    - Implement `firebaseResetPassword(email): Promise<void>` — sends reset email
    - Implement `firebaseSignOut(): Promise<void>` — signs out from Firebase
    - _Requirements: 2.5, 4.7, 5.6, 11.1_

  - [x] 1.3 Create `src/utils/authErrorMapper.ts`
    - Implement `mapFirebaseError(code, t): string` — maps Firebase error codes to localized messages
    - Implement `mapBridgeError(code, t): string` — maps Bridge API error codes to localized messages
    - Handle: auth/invalid-credential, auth/user-not-found, auth/email-already-in-use, auth/weak-password, auth/too-many-requests, ACCOUNT_SUSPENDED, TOKEN_EXPIRED_OR_INVALID, network errors, generic fallback
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 2. Implement AuthModal shell component
  - [x] 2.1 Create `src/components/auth/AuthModal.tsx`
    - Render as React Portal to `document.body`
    - Backdrop: `bg-inverse-surface/40 backdrop-blur-sm`, click-to-close (suppressed during loading)
    - Modal container: `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl shadow-ambient-glow`
    - Top gradient bar: `h-1 bg-gradient-to-r from-primary to-primary-container opacity-80`
    - ARIA: role="dialog", aria-modal="true", aria-labelledby
    - Escape key close (suppressed during loading)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.6, 1.7, 1.8_

  - [x] 2.2 Create `src/components/auth/useFocusTrap.ts` hook
    - Trap Tab/Shift+Tab within modal content
    - Return focus to previously focused element on close
    - _Requirements: 1.5_

  - [x] 2.3 Implement view routing and transitions in AuthModal
    - State: `currentView: 'login' | 'signup' | 'forgot-password' | 'reset-success'`
    - State: `sharedEmail: string` — preserved across transitions
    - Transition animation: outgoing `opacity-0 scale-95` (150ms ease-in), incoming `opacity-100 scale-100` (200ms ease-out)
    - Container height animation: `transition-[height] duration-200 ease-out`
    - Clear errors on view switch, clear non-email fields, auto-focus first input
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

- [x] 3. Implement LoginForm component
  - [x] 3.1 Create `src/components/auth/LoginForm.tsx`
    - Heading: `font-headline text-[2rem] font-bold tracking-tight mb-8`
    - Email input: label `font-headline text-xs font-bold uppercase tracking-wider text-on-surface-variant`, input `input-glow-focus bg-surface-container-low rounded-lg h-12 px-4`, focus state `bg-surface-container-lowest shadow-[inset_0_-2px_0_0_#4343d5]`
    - Password input: same styling, with "Quên mật khẩu?" link `font-headline text-xs text-primary font-medium` aligned right
    - Submit button: `w-full bg-primary text-on-primary rounded-xl h-12 font-headline font-semibold tracking-wide`
    - Footer: "Chưa có tài khoản? Đăng ký" in `font-headline text-sm text-on-surface-variant`, link in `text-primary font-bold`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.9, 2.10_

  - [x] 3.2 Implement login submission logic
    - Client-side validation: non-empty email and password
    - Call `firebaseSignIn(email, password)` → get idToken
    - Call `authService.login(idToken)` → get AccessContext
    - Call `setAccessContext(context)` on auth store
    - Persist session ID (already done in authService.login)
    - Close modal on success
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 3.3 Implement login loading state
    - Show spinning `progress_activity` icon in button during submission
    - Disable all inputs with `opacity-60 pointer-events-none` on form container
    - 30-second timeout → cancel and show timeout error
    - _Requirements: 2.8, 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 3.4 Implement login error banner
    - Error banner: `bg-error-container text-on-error-container rounded-lg p-4 mb-8 flex items-start gap-3`
    - Filled `error` Material Symbol icon
    - Error text: `font-headline text-sm font-medium leading-snug`
    - Dismiss on any input field change
    - Map errors via `authErrorMapper`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Implement SignUpForm component
  - [x] 4.1 Create `src/components/auth/SignUpForm.tsx`
    - Centered header: icon container `w-12 h-12 rounded-lg bg-surface-container-low` with filled `edit_note` in `text-primary text-2xl`
    - Heading: `font-headline text-3xl tracking-tighter font-bold`, subtitle: `font-body text-on-surface-variant text-base`
    - 4 input fields (display name, email, password, confirm password): label `font-headline text-label-md tracking-wider uppercase text-on-surface-variant`, input `bg-surface-container-low border-0 rounded-lg px-4 py-3.5 font-headline`, focus `focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme('colors.primary')]`
    - Error state on confirm password: `bg-error-container text-on-error-container` with `error` icon right-aligned, error text `text-error text-sm font-headline`
    - Disabled button: `bg-surface-container-highest text-outline font-headline font-bold py-4 px-6 rounded-lg cursor-not-allowed opacity-70`
    - Active button: `bg-primary text-on-primary font-headline font-bold py-4 px-6 rounded-lg`
    - Footer: "Đã có tài khoản? Quay lại đăng nhập" link
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

  - [x] 4.2 Implement sign-up validation and submission
    - Validate: display name 1-100 chars trimmed, valid email, password ≥6 chars, confirm matches
    - Call `firebaseSignUp(email, password, displayName)` → get idToken
    - Call `authService.login(idToken)` → get AccessContext
    - Call `setAccessContext(context)`, close modal
    - Handle Firebase errors (email-already-in-use, weak-password)
    - _Requirements: 4.6, 4.7, 4.8_

- [x] 5. Implement ForgotPasswordForm and ResetSuccessView
  - [x] 5.1 Create `src/components/auth/ForgotPasswordForm.tsx`
    - Glass panel: `bg-white/80 backdrop-blur-[20px] border border-outline-variant/15 rounded-xl p-10`
    - Header: filled `lock_reset` icon `text-primary text-2xl`, heading `font-headline font-bold text-2xl tracking-tight`, description `font-body text-on-surface-variant leading-relaxed`
    - Email input: `mail` icon left (`absolute left-4`), input `fluid-input rounded-lg py-4 pl-12 pr-4 font-body text-base`
    - Submit button: `fluid-button w-full rounded-md py-4 px-6 font-headline font-bold text-sm tracking-wide` with `arrow_forward` icon
    - Back link: `arrow_back` icon with `group-hover:-translate-x-1`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.2 Implement forgot password submission
    - Validate non-empty email
    - Call `firebaseResetPassword(email)`
    - On success: navigate to 'reset-success' view
    - On error: show error message
    - _Requirements: 5.6, 5.7_

  - [x] 5.3 Create `src/components/auth/ResetSuccessView.tsx`
    - Container: `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[24px] p-12 ring-1 ring-outline-variant/15`
    - Top glow: `bg-gradient-to-r from-transparent via-primary/30 to-transparent h-1`
    - Success icon: filled `check_circle` at `text-[80px] text-primary` with glow `bg-primary/10 rounded-full blur-[20px] scale-150`
    - Heading: `font-headline text-2xl md:text-3xl font-bold tracking-tight`
    - Subtitle: `font-body text-lg text-on-surface-variant`
    - Button: `bg-primary text-on-primary rounded-xl font-headline text-xs tracking-[0.05em] uppercase font-bold px-10 py-4`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 6. Checkpoint — Auth Modal complete
  - Verify all 4 views render correctly matching mockups
  - Verify transitions between views work (fade, email preservation, error clearing)
  - Verify loading states and error handling
  - Verify focus trap and keyboard accessibility

- [x] 7. Implement User Menu components
  - [x] 7.1 Create `src/components/UserMenuAuthenticated.tsx`
    - Popover: `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl outline outline-1 outline-outline-variant/15 shadow-[0_-5px_40px_rgba(25,28,29,0.04)]`
    - Header Block: button `w-full text-left p-5 flex items-center gap-4 hover:bg-surface-container-low`, avatar `w-12 h-12 rounded-full`, online indicator `w-3.5 h-3.5 bg-[#10b981] border-2 border-surface-container-lowest rounded-full`, name `font-bold tracking-tight`, plan badge `px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gradient-to-br from-primary to-primary-container text-on-primary`, email `text-sm text-on-surface-variant`
    - Tonal dividers: `h-2 bg-surface-container-low`
    - My Library: `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface hover:bg-surface-container-low text-sm font-medium`, `folder` icon in `text-outline`
    - Sign Out: `text-error hover:bg-error-container hover:text-on-error-container`, `logout` icon
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 7.2 Create `src/components/UserMenuGuest.tsx`
    - Popover: `w-[340px] bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[1.25rem] border border-outline-variant/15 shadow-[0_24px_60px_-10px_rgba(25,28,29,0.06)]`
    - Info banner: `p-6 bg-primary/5 border-b border-outline-variant/10`, icon `w-8 h-8 rounded-full bg-primary/10` with filled `auto_awesome` in `text-primary text-[1.125rem]`, text `text-[0.9rem] font-medium leading-[1.6] text-on-surface-variant`
    - Sign In button: `w-full bg-primary text-on-primary py-[0.875rem] px-5 rounded-[0.75rem] font-semibold text-[0.95rem] tracking-wide`, hover glow, `arrow_right_alt` icon
    - Explore Features link: `text-[0.8rem] font-medium text-outline hover:text-primary uppercase tracking-[0.05em]`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

  - [x] 7.3 Refactor `TopNavBar.tsx` to use new UserMenu components
    - Replace inline user menu with `UserMenuAuthenticated` or `UserMenuGuest` based on `accessContext`
    - Guest avatar trigger: `w-12 h-12 rounded-full bg-surface-container-low hover:bg-surface-container` with `account_circle` icon
    - Implement keyboard navigation (ArrowUp/Down, Enter, Escape)
    - Implement window blur close
    - Implement fade-out animation on close (`opacity-0 transition-opacity duration-150`)
    - _Requirements: 7.6, 7.7, 8.1_

  - [x] 7.4 Wire AuthModal open from User Menu
    - Add `isAuthModalOpen` state to App.tsx
    - Pass `onSignIn` to TopNavBar → opens AuthModal
    - UserMenuGuest "Sign In / Sign Up" button → opens AuthModal
    - _Requirements: 1.1, 8.6_

- [x] 8. Implement Sign Out and Session Restoration
  - [x] 8.1 Implement sign-out flow in App.tsx
    - `handleSignOut` callback: show spinner on Sign Out button (`progress_activity animate-spin text-error`), disable menu items
    - Call `authService.logout(sessionId)` then `firebaseSignOut()`
    - Call `clearAuth()` on store
    - Call `resetCloudSettingsToDefaults()`
    - Close menu, transition avatar to guest state
    - Handle network errors gracefully (still clear local state)
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 8.2 Implement session restoration in App.tsx
    - On app startup: check `getPersistedSessionId()`
    - If exists: show pulsing avatar (`animate-pulse opacity-60`), call `fetchAccessContext(sessionId)` with 10s timeout
    - On success: `setAccessContext(context)`, trigger cloud settings sync
    - On failure/timeout: `clearLocalAuthCache()`, set guest state
    - If no session ID: set guest state immediately
    - Non-blocking: editor loads normally during restoration
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 9. Implement Preference Cloud Sync
  - [x] 9.1 Create `src/data/settingClassification.ts`
    - Define `CLOUD_SETTINGS` array with all cloud-synced setting keys
    - Define `LOCAL_SETTINGS` array with device-only setting keys
    - Export `isCloudSetting(key): boolean` helper
    - _Requirements: 14.1, 14.2_

  - [x] 9.2 Create `src/services/cloudSettingsService.ts`
    - Implement `fetchCloudSettings(sessionId): Promise<Record<string, unknown>>`
    - Implement `patchCloudSetting(sessionId, key, value): Promise<void>` with 1s debounce
    - Implement `uploadAllCloudSettings(sessionId, settings): Promise<void>`
    - Implement `resetCloudSettingsToDefaults()` — resets all cloud keys to SETTING_REGISTRY defaults
    - Handle network failures: queue for retry, never revert UI
    - _Requirements: 14.3, 14.4, 14.5, 19.1, 19.2, 19.3, 19.4_

  - [x] 9.3 Implement sync-on-login flow
    - After successful login/session-restore: call `fetchCloudSettings()`
    - Merge server values over local (server wins for all CLOUD_SETTINGS keys)
    - Apply immediately to store → UI re-renders (theme, font, AI model, etc.)
    - On failure: show non-blocking toast "Settings sync failed. Using local preferences."
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 9.4 Implement upload-on-signup flow
    - After new user sign-up: collect current local values for all CLOUD_SETTINGS keys
    - Call `uploadAllCloudSettings(sessionId, settings)`
    - _Requirements: 15.4_

  - [x] 9.5 Wire preference change handler
    - When any setting changes: update store immediately (optimistic)
    - If Cloud_Setting + authenticated: debounce 1s → `patchCloudSetting()`
    - If Local_Setting or guest: `localStorage.setItem()` only
    - On sign-out: reset all Cloud_Settings to defaults, retain Local_Settings
    - On sign-in with existing local changes: server wins (overwrite)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_

- [x] 10. Update Preferences Window UI
  - [x] 10.1 Update Preferences sidebar navigation
    - Sidebar: `w-64 py-6 px-4 bg-zinc-50 border-r border-zinc-200/20 rounded-l-lg`
    - Header: "Preferences" `text-lg font-black tracking-tight`, subtitle "System Configuration" `text-sm text-zinc-500`
    - Active tab: `bg-white text-indigo-600 shadow-sm border-r-4 border-indigo-500` with filled icon
    - Inactive tabs: `text-zinc-500 hover:bg-zinc-100 hover:translate-x-1 transition-transform duration-200`
    - Items: `font-['Manrope'] text-sm font-medium tracking-wide uppercase`, icons `text-[20px]`
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 10.2 Update General tab UI
    - Header: `font-headline text-3xl font-extrabold tracking-tight`
    - Theme selection: 3-column grid buttons with preview thumbnails, active `ring-1 ring-outline-variant/30 shadow-[0_8px_30px_-5px_rgba(67,67,213,0.12)]`
    - Toggle switches: `h-6 w-11 rounded-full`, active `bg-primary shadow-[0_0_8px_-1px_rgba(67,67,213,0.5)]`
    - Sync section: AuraBrain card `bg-surface-container rounded-2xl p-6` with aura blob, slider with gradient fill
    - Local section: dropdown + readonly path input with Browse button
    - Cloud sync icon: `cloud_sync` in `text-primary text-[18px]` next to synced section titles (authenticated only)
    - Guest info banner: `p-6 bg-primary/5 rounded-xl border border-outline-variant/10 mb-8` with `auto_awesome` icon and Sign In button
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7_

  - [x] 10.3 Update AI Engine tab UI
    - Header: `text-3xl font-bold tracking-tight`
    - Credits card (authenticated): `bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15`, plan badge, progress bar `h-2 bg-gradient-to-r from-primary to-primary-container`, "Get more credits" button
    - Capabilities: 2-column grid dropdowns `bg-surface-container-low border-0 rounded-md px-4 py-3`
    - Web Access toggle: `p-4 bg-surface-container-low rounded-lg` with PRO badge
    - Creativity slider: card with value display `text-lg font-bold text-primary bg-primary/5 px-3 py-1 rounded-md`
    - Guest gating: premium models disabled/grayed with 🔒 icon, Web Access disabled with 🔒
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 11. Implement i18n translations
  - [x] 11.1 Add auth translation keys to `src/i18n/locales/en.json`
    - Add `auth.login.*`, `auth.signup.*`, `auth.forgotPassword.*`, `auth.resetSuccess.*`, `auth.errors.*` keys
    - Add `userMenu.*` keys
    - _Requirements: 13.1, 13.2_

  - [x] 11.2 Add auth translation keys to `src/i18n/locales/vi.json`
    - Mirror all keys from en.json with Vietnamese translations
    - _Requirements: 13.1, 13.2_

  - [x] 11.3 Replace all hardcoded strings in auth components with `t()` calls
    - Verify no hardcoded strings remain in AuthModal, LoginForm, SignUpForm, ForgotPasswordForm, ResetSuccessView, UserMenuAuthenticated, UserMenuGuest
    - _Requirements: 13.1, 13.3, 13.4_

- [x] 12. Final integration and checkpoint
  - [x] 12.1 Wire everything together in App.tsx
    - Add `isAuthModalOpen` state
    - Pass `onSignIn` and `onSignOut` to TopNavBar
    - Render `<AuthModal>` with proper props
    - Session restoration on startup
    - Cloud settings sync after login/restore
    - _Requirements: 1.1, 7.4, 8.6, 11.1, 12.1_

  - [x] 12.2 Verify complete flow end-to-end
    - Guest → Sign In → Login → Authenticated (settings sync)
    - Guest → Sign In → Sign Up → Authenticated (settings upload)
    - Authenticated → Sign Out → Guest (settings reset)
    - Forgot Password → Reset Success → Back to Login
    - Session restoration on app restart
    - Preference changes sync to cloud (authenticated) or localStorage (guest)
    - AI Engine tab gating for guest users
    - All UI matches mockups exactly (colors, spacing, fonts, shadows)

## Notes

- All UI styling must strictly follow the HTML mockups in `ui/user-management/`. Only text content may change for i18n.
- Firebase config values come from environment variables (VITE_FIREBASE_*).
- The Bridge API endpoints for user preferences (GET/PATCH /user/preferences) need to be implemented on the backend side separately.
- The existing `preferencesService.ts` (Tauri-based) continues to handle local persistence; `cloudSettingsService.ts` handles cloud sync on top of it.
- Error handling follows a "graceful degradation" pattern: network failures never block the user, local state is always preserved.
