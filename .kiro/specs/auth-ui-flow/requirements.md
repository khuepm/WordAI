# Requirements Document

## Introduction

This document defines the requirements for the Authentication UI Flow and User Personalization in WordAI — a Tauri desktop application. The backend authentication system (Bridge API with Firebase Authentication) and client-side auth state management are already fully implemented. This feature covers the missing UI layer: modal-based login, sign-up, forgot-password screens, user menu dropdown behavior, preference personalization (cloud sync vs local-only), and integration with the existing TopNavBar.

**UI Compliance Rule:** All UI implementations MUST strictly follow the HTML mockups in `ui/user-management/`. Colors, font sizes, font families, spacing, padding, border-radius, shadows, backgrounds, and layout structure defined in the mockups are canonical. Only text content (labels, messages) may be changed for i18n purposes.

## Glossary

- **Auth_Modal**: The modal overlay component hosting authentication forms, rendered as a glassmorphism panel with `bg-surface-container-lowest/80 backdrop-blur-[20px]` and `rounded-xl`.
- **Login_Form**: The login form within Auth_Modal. Reference: `ui/user-management/authentication_login_error_loading/code.html`.
- **SignUp_Form**: The sign-up form. Reference: `ui/user-management/authentication_sign_up_validation/code.html`.
- **ForgotPassword_Form**: The forgot password form. Reference: `ui/user-management/authentication_forgot_password/code.html`.
- **ResetSuccess_View**: The password reset success confirmation. Reference: `ui/user-management/authentication_reset_success/code.html`.
- **User_Menu**: The dropdown/popover below the Avatar. References: `ui/user-management/user_menu_authenticated/code.html` and `ui/user-management/user_menu_guest_state/code.html`.
- **Preferences_AI_Engine**: The AI Engine tab in Preferences. Reference: `ui/user-management/preferences_ai_engine_credits_progress/code.html`.
- **Preferences_General**: The General tab in Preferences. Reference: `ui/user-management/preferences_general_refined_ui/code.html`.
- **Auth_Service**: The existing client-side module (`authService.ts`) that handles Firebase login, Bridge API token exchange, session revocation, and access context refresh.
- **Auth_Store**: The existing React Context-based store (`authStore.tsx`) that manages AccessContext, AIAccessState, loading, and error state.
- **TopNavBar**: The existing top navigation bar component containing the Avatar button.
- **Firebase_Auth**: The Firebase Authentication SDK used for email/password sign-in, account creation, and password reset.
- **Bridge_API**: The backend API that exchanges Firebase ID tokens for Access Context sessions.
- **Access_Context**: The authorization payload containing user info, roles, permissions, entitlements, and session data.
- **Cloud_Settings**: Preferences synced to the user's account via Bridge API.
- **Local_Settings**: Preferences that are device-specific and never synced.
- **Preferences_Window**: The existing separate Tauri window for managing application settings.

## Requirements

### Requirement 1: Auth Modal Display

**User Story:** As a user, I want to see an authentication modal when I click Sign In, so that I can log in without leaving my current document.

**UI Reference:** `ui/user-management/authentication_login_error_loading/code.html` — the modal overlay structure.

#### Acceptance Criteria

1. WHEN the user clicks the Sign In button in the User_Menu (guest state), THE Auth_Modal SHALL open as a centered overlay above the application content and display the Login_Form as the default view.
2. WHILE the Auth_Modal is open, THE Auth_Modal SHALL display a backdrop using `bg-inverse-surface/40 backdrop-blur-sm` that prevents pointer and keyboard interaction with the underlying application.
3. WHEN the user clicks the backdrop area outside the Auth_Modal content, THE Auth_Modal SHALL close and return focus to the previously focused element.
4. WHEN the user presses the Escape key while the Auth_Modal is open, THE Auth_Modal SHALL close and return focus to the previously focused element.
5. THE Auth_Modal SHALL trap keyboard focus within its content while open, cycling through focusable elements with Tab and Shift+Tab.
6. THE Auth_Modal container SHALL use `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl shadow-ambient-glow` with a top gradient bar `bg-gradient-to-r from-primary to-primary-container opacity-80 h-1`.
7. THE Auth_Modal SHALL include role="dialog", aria-modal="true", and an aria-labelledby attribute referencing the modal's heading element.
8. IF the user clicks the Sign In button while the Auth_Modal is already open, THEN THE Auth_Modal SHALL remain open without resetting the current form view or form state.

### Requirement 2: Login Form

**User Story:** As a returning user, I want to enter my email and password to sign in, so that I can access AI features and my personalized settings.

**UI Reference:** `ui/user-management/authentication_login_error_loading/code.html`

#### Acceptance Criteria

1. THE Login_Form SHALL display a heading "Đăng nhập" (localized) using `font-headline text-[2rem] font-bold tracking-tight mb-8`.
2. THE Login_Form SHALL display an email input field with label styled as `font-headline text-xs font-bold uppercase tracking-wider text-on-surface-variant`, and input container using `input-glow-focus bg-surface-container-low rounded-lg h-12 px-4` that transitions to `bg-surface-container-lowest shadow-[inset_0_-2px_0_0_#4343d5]` on focus.
3. THE Login_Form SHALL display a password input field with the same label/input styling, and a "Quên mật khẩu?" link aligned right using `font-headline text-xs text-primary font-medium`.
4. THE Login_Form SHALL display a submit button using `w-full bg-primary text-on-primary rounded-xl h-12 font-headline font-semibold tracking-wide` with hover state `hover:bg-primary-container hover:shadow-[0_0_12px_-2px_rgba(67,67,213,0.4)]`.
5. WHEN the user submits the Login_Form with a non-empty email and non-empty password, THE Login_Form SHALL call Firebase signInWithEmailAndPassword, obtain the ID token, and pass it to the Auth_Service login function.
6. WHEN the Auth_Service login function returns a successful Access_Context, THE Auth_Store SHALL update with the new context, THE Auth_Modal SHALL close, and THE application SHALL trigger a Cloud_Settings sync.
7. WHEN the user submits the Login_Form with an empty email or empty password, THE Login_Form SHALL display an inline validation error without making a network request.
8. WHILE a login request is in progress, THE submit button SHALL display a spinning `progress_activity` Material Symbol icon alongside the button text, and all inputs SHALL be disabled.
9. THE Login_Form SHALL display a footer link "Chưa có tài khoản? Đăng ký" (localized) using `font-headline text-sm text-on-surface-variant` with the action link in `text-primary font-bold`.
10. THE Login_Form SHALL display a "Quên mật khẩu?" link that navigates to the ForgotPassword_Form.

### Requirement 3: Login Form Error State

**User Story:** As a user, I want to see clear error messages when login fails.

**UI Reference:** `ui/user-management/authentication_login_error_loading/code.html` — the error banner.

#### Acceptance Criteria

1. WHEN an authentication error occurs, THE Login_Form SHALL display an error banner using `bg-error-container text-on-error-container rounded-lg p-4 mb-8 flex items-start gap-3` with a filled `error` Material Symbol icon.
2. THE error message text SHALL use `font-headline text-sm font-medium leading-snug`.
3. WHEN Firebase returns "auth/invalid-credential", THE error message SHALL display a localized message indicating invalid email or password.
4. WHEN Firebase returns "auth/user-not-found", THE error message SHALL indicate no account exists for the provided email.
5. WHEN a network error occurs, THE error message SHALL indicate a connection problem.
6. WHEN the Bridge_API returns ACCOUNT_SUSPENDED, THE error message SHALL indicate the account is suspended.
7. WHEN Firebase returns "auth/too-many-requests", THE error message SHALL indicate too many attempts.
8. WHEN the user modifies any input field, THE error banner SHALL be dismissed.

### Requirement 4: Sign Up Form

**User Story:** As a new user, I want to create an account with my name, email, and password.

**UI Reference:** `ui/user-management/authentication_sign_up_validation/code.html`

#### Acceptance Criteria

1. THE SignUp_Form SHALL display a centered header with an icon container `w-12 h-12 rounded-lg bg-surface-container-low` containing a filled `edit_note` Material Symbol in `text-primary text-2xl`, followed by heading "Tạo tài khoản" (localized) in `font-headline text-3xl tracking-tighter font-bold` and subtitle in `font-body text-on-surface-variant text-base`.
2. THE SignUp_Form SHALL display input fields for: display name, email, password, and confirm password, each with label `font-headline text-label-md tracking-wider uppercase text-on-surface-variant` and input `bg-surface-container-low border-0 rounded-lg px-4 py-3.5 text-on-surface font-headline` with focus state `focus:bg-surface-container-lowest focus:shadow-[0_2px_0_0_theme('colors.primary')]`.
3. WHEN validation fails on confirm password, THE input SHALL use `bg-error-container text-on-error-container` with a `error` Material Symbol icon on the right, and error text below in `text-error text-sm font-headline`.
4. WHEN validation errors exist, THE submit button SHALL be disabled using `bg-surface-container-highest text-outline font-headline font-bold py-4 px-6 rounded-lg cursor-not-allowed opacity-70`.
5. WHEN all fields are valid, THE submit button SHALL use `bg-primary text-on-primary font-headline font-bold py-4 px-6 rounded-lg`.
6. THE SignUp_Form SHALL validate: display name 1-100 chars, valid email, password ≥6 chars, confirm password matches.
7. WHEN the user submits with valid inputs, THE SignUp_Form SHALL call Firebase createUserWithEmailAndPassword, obtain the ID token, and pass it to Auth_Service login.
8. THE SignUp_Form SHALL display a footer link "Đã có tài khoản? Quay lại đăng nhập" (localized) using `font-headline text-sm text-on-surface-variant`.

### Requirement 5: Forgot Password Form

**User Story:** As a user who forgot my password, I want to request a password reset email.

**UI Reference:** `ui/user-management/authentication_forgot_password/code.html`

#### Acceptance Criteria

1. THE ForgotPassword_Form SHALL use a `glass-panel` container (`bg-white/80 backdrop-blur-[20px] border border-outline-variant/15 rounded-xl p-10`) with ambient aura background blobs (`bg-primary/primary-container blur-[60px] opacity-0.08`).
2. THE header SHALL display a filled `lock_reset` Material Symbol in `text-primary text-2xl` alongside heading "Khôi phục mật khẩu" (localized) in `font-headline font-bold text-2xl tracking-tight`, and description in `font-body text-on-surface-variant leading-relaxed`.
3. THE email input SHALL have a `mail` Material Symbol icon on the left (`absolute left-4`) with input using `fluid-input rounded-lg py-4 pl-12 pr-4 font-body text-base` and focus state with bottom border color primary and glow shadow.
4. THE submit button SHALL use `fluid-button w-full rounded-md py-4 px-6 font-headline font-bold text-sm tracking-wide` (bg-primary, text-on-primary) with an `arrow_forward` icon, and hover state `bg-primary-container shadow-[0_0_15px_rgba(67,67,213,0.4)]`.
5. THE "Quay lại Đăng nhập" link SHALL display with an `arrow_back` icon that translates left on hover (`group-hover:-translate-x-1`).
6. WHEN the user submits with a valid email, THE form SHALL call Firebase sendPasswordResetEmail.
7. WHEN the user submits with an empty or invalid email, THE form SHALL display an inline validation error.

### Requirement 6: Password Reset Success

**User Story:** As a user, I want confirmation that my reset email was sent.

**UI Reference:** `ui/user-management/authentication_reset_success/code.html`

#### Acceptance Criteria

1. THE ResetSuccess_View SHALL display inside a glassmorphism container `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[24px] p-12 ring-1 ring-outline-variant/15` with a subtle top glow `bg-gradient-to-r from-transparent via-primary/30 to-transparent h-1`.
2. THE success icon SHALL be a filled `check_circle` Material Symbol at `text-[80px] text-primary` with a background glow `bg-primary/10 rounded-full blur-[20px] scale-150`.
3. THE heading SHALL display "Đã gửi email thành công!" (localized) in `font-headline text-2xl md:text-3xl font-bold tracking-tight`.
4. THE subtitle SHALL display "Vui lòng kiểm tra hòm thư của bạn." (localized) in `font-body text-lg text-on-surface-variant`.
5. THE "Về trang Đăng nhập" button SHALL use `bg-primary text-on-primary rounded-xl font-headline text-xs tracking-[0.05em] uppercase font-bold px-10 py-4` with hover `hover:bg-primary-container hover:shadow-[0_0_20px_-2px_rgba(67,67,213,0.3)]`.

### Requirement 7: User Menu — Authenticated State

**User Story:** As an authenticated user, I want a rich user menu showing my account info and quick navigation.

**UI Reference:** `ui/user-management/user_menu_authenticated/code.html`

#### Acceptance Criteria

1. THE User_Menu SHALL render as a popover using `bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl outline outline-1 outline-outline-variant/15 shadow-[0_-5px_40px_rgba(25,28,29,0.04)]` positioned below the Avatar.
2. THE Header Block SHALL be a full-width button (`w-full text-left p-5 flex items-center gap-4 hover:bg-surface-container-low`) containing: user avatar image (`w-12 h-12 rounded-full`), an online status indicator (`w-3.5 h-3.5 bg-[#10b981] border-2 border-surface-container-lowest rounded-full` positioned bottom-right), display name (`font-bold text-on-surface truncate tracking-tight`), plan badge (`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-gradient-to-br from-primary to-primary-container text-on-primary`), and email (`text-sm text-on-surface-variant truncate`).
3. SECTIONS SHALL be separated by tonal shift dividers (`h-2 bg-surface-container-low`).
4. THE "My Library" item SHALL use `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-on-surface hover:bg-surface-container-low text-sm font-medium` with a `folder` Material Symbol icon in `text-outline`.
5. THE "Sign Out" item SHALL use `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-error hover:bg-error-container hover:text-on-error-container text-sm font-medium` with a `logout` Material Symbol icon.
6. THE User_Menu SHALL support keyboard navigation: Arrow Up/Down to move between items, Enter to select, Escape to close.
7. THE User_Menu SHALL close with a fade-out animation (~150ms) when the user clicks an item, clicks outside, or the window loses focus.
8. WHEN the user clicks the Header Block, THE application SHALL open the Account & Plan management view.
9. WHILE sign-out is in progress, THE Sign Out button SHALL show a loading spinner and be disabled.

### Requirement 8: User Menu — Guest State

**User Story:** As a guest user, I want a minimal user menu that invites me to sign in.

**UI Reference:** `ui/user-management/user_menu_guest_state/code.html`

#### Acceptance Criteria

1. THE guest Avatar trigger SHALL be a button `w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-low hover:bg-surface-container` with an `account_circle` Material Symbol in `text-outline`.
2. THE User_Menu popover SHALL use `w-[340px] bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-[1.25rem] border border-outline-variant/15 shadow-[0_24px_60px_-10px_rgba(25,28,29,0.06)]`.
3. THE info banner section SHALL use `p-6 bg-primary/5 border-b border-outline-variant/10` containing a circular icon container `w-8 h-8 rounded-full bg-primary/10` with a filled `auto_awesome` Material Symbol in `text-primary text-[1.125rem]`, and value proposition text in `text-[0.9rem] font-medium leading-[1.6] text-on-surface-variant`.
4. THE "Sign In / Sign Up" button SHALL use `w-full bg-primary text-on-primary py-[0.875rem] px-5 rounded-[0.75rem] font-semibold text-[0.95rem] tracking-wide` with hover glow `shadow-[0_0_16px_rgba(67,67,213,0.4)]` and an `arrow_right_alt` icon that translates right on hover.
5. THE "Explore Features" link SHALL use `text-[0.8rem] font-medium text-outline hover:text-primary uppercase tracking-[0.05em]`.
6. WHEN the user clicks "Sign In / Sign Up", THE Auth_Modal SHALL open with the Login_Form.
7. THE User_Menu in guest state SHALL NOT display Profile, Subscription, My Library, or Sign Out items.

### Requirement 9: Form Navigation and Transitions

**User Story:** As a user, I want smooth transitions between login, sign-up, and forgot-password views.

**UI Derivation:** Based on the `transition-all duration-200` and `transition-colors duration-300` patterns used throughout all mockups.

#### Acceptance Criteria

1. WHEN the user navigates between Login_Form, SignUp_Form, ForgotPassword_Form, and ResetSuccess_View, THE Auth_Modal content SHALL transition with `opacity` and `transform` animation: outgoing view fades to `opacity-0 scale-95` over 150ms (`transition-all duration-150 ease-in`), then incoming view enters from `opacity-0 scale-95` to `opacity-100 scale-100` over 200ms (`transition-all duration-200 ease-out`).
2. WHEN the user navigates to a different form view, THE Auth_Modal SHALL clear any previously displayed error messages (the error banner with `bg-error-container` SHALL be removed).
3. WHEN the user navigates to a different form view and the email field contains a non-empty value, THE Auth_Modal SHALL preserve that email value in the destination form's email field.
4. WHEN the user navigates to a different form view, THE Auth_Modal SHALL clear all non-email field values (password, confirm password, display name).
5. WHEN a view transition completes, THE Auth_Modal SHALL set focus to the first input field of the newly displayed form.
6. THE Auth_Modal container dimensions SHALL animate smoothly using `transition-[height] duration-200 ease-out` when switching between forms of different heights (e.g., Login → SignUp which has more fields).

### Requirement 10: Loading States

**User Story:** As a user, I want visual feedback during authentication operations.

**UI Derivation:** Based on the login mockup's loading button state (`animate-spin` on `progress_activity` icon) and the disabled input patterns from the sign-up form (`cursor-not-allowed opacity-70`).

#### Acceptance Criteria

1. WHILE an authentication operation is in progress, THE submit button SHALL display a spinning `progress_activity` Material Symbol icon (`animate-spin text-on-primary`) to the left of the button text. The button SHALL retain its `bg-primary text-on-primary rounded-xl h-12` styling but add `cursor-not-allowed` and remove hover effects.
2. WHILE an authentication operation is in progress, ALL form inputs SHALL be disabled with `opacity-60 pointer-events-none` applied to the form container, preventing any user interaction.
3. WHILE an authentication operation is in progress, THE Auth_Modal backdrop SHALL ignore click events (no close on backdrop click) and Escape key SHALL be suppressed.
4. IF an authentication operation does not complete within 30 seconds, THEN THE Auth_Modal SHALL cancel the operation, re-enable inputs (remove `opacity-60 pointer-events-none`), remove the spinner, and display a timeout error using the same error banner styling as Requirement 3 (`bg-error-container text-on-error-container rounded-lg p-4 mb-8`).
5. WHEN an operation completes (success or failure), THE Auth_Modal SHALL remove the spinner from the button, restore the button to its normal interactive state, and remove `opacity-60 pointer-events-none` from the form container.

### Requirement 11: Sign Out Integration

**User Story:** As an authenticated user, I want to sign out from the user menu.

**UI Derivation:** Based on the User_Menu authenticated mockup's Sign Out button styling, combined with the loading spinner pattern from the login form (`progress_activity animate-spin`).

#### Acceptance Criteria

1. WHEN the authenticated user clicks the Sign Out button in the User_Menu, THE Auth_Service SHALL revoke the session via the logout function and then call Firebase signOut.
2. WHEN the logout operation completes, THE Auth_Store SHALL clear the Access_Context, clear the persisted session ID from local storage, and set AIAccessState to "guest".
3. IF the logout API call fails due to a network error, THEN THE Auth_Store SHALL still clear the local Access_Context and set AIAccessState to "guest".
4. WHILE sign-out is in progress, THE Sign Out button text SHALL be replaced with a spinning `progress_activity` Material Symbol icon (`animate-spin text-error text-[18px]`), the button SHALL add `opacity-70 pointer-events-none`, and all other User_Menu items SHALL be disabled with `pointer-events-none opacity-50`.
5. WHEN sign-out completes, THE User_Menu SHALL close with the standard fade-out animation (`opacity-0 transition-opacity duration-150`) and THE TopNavBar SHALL transition the avatar to the guest state button (`w-12 h-12 rounded-full bg-surface-container-low` with `account_circle` icon).
6. WHEN the user signs out, THE application SHALL reset all Cloud_Settings to their defaultValue and retain Local_Settings.

### Requirement 12: Session Restoration

**User Story:** As a returning user, I want my session automatically restored when I reopen the app.

**UI Derivation:** Based on the TopNavBar avatar area. During restoration, the avatar area shows a subtle loading state derived from the guest state button pattern.

#### Acceptance Criteria

1. WHEN the application starts and a persisted session ID exists in local storage, THE Auth_Service SHALL call fetchAccessContext to validate and restore the session within 10 seconds.
2. WHEN fetchAccessContext returns a valid Access_Context, THE Auth_Store SHALL update with the restored context and trigger Cloud_Settings sync without showing the Auth_Modal.
3. IF fetchAccessContext fails or times out, THEN THE Auth_Store SHALL clear the persisted session ID and set AIAccessState to "guest".
4. WHILE session restoration is in progress, THE TopNavBar avatar area SHALL display the guest avatar button (`w-12 h-12 rounded-full bg-surface-container-low` with `account_circle` icon) with a subtle pulsing animation (`animate-pulse opacity-60`) to indicate background activity. THE application SHALL continue loading the editor without blocking user interaction.
5. WHEN no persisted session ID exists, THE Auth_Store SHALL set AIAccessState to "guest" without calling fetchAccessContext, and THE avatar SHALL display in its normal guest state without pulsing.

### Requirement 13: Internationalization

**User Story:** As a user, I want the authentication UI to display in my selected language.

#### Acceptance Criteria

1. THE Auth_Modal and User_Menu SHALL render all user-visible text using react-i18next translation keys, with no hardcoded strings.
2. THE Auth_Modal and User_Menu SHALL provide complete translations for English (en) and Vietnamese (vi) locales.
3. WHEN the application language changes, all displayed text SHALL re-render immediately without page reload.
4. IF a translation key is missing, THE Auth_Modal SHALL fall back to the English (en) translation.

### Requirement 14: Preference Personalization — Cloud vs Local Classification

**User Story:** As an authenticated user, I want my preferences to sync across devices.

#### Acceptance Criteria

1. THE application SHALL classify as Cloud_Settings (synced to user account): `general.theme`, `general.language`, `general.focusMode`, `general.autoSave`, `general.autoSyncEnabled`, `general.autoSyncInterval`, `general.defaultExportFormat`, all `ai-engine.*` settings, all `typography.*` settings, `privacy.allowAITraining`, and `privacy.localProcessingOnly`.
2. THE application SHALL classify as Local_Settings (device-only): `general.defaultExportPath`, `about.auraBrainStoragePath`, `privacy.crashReports`, and `privacy.analyticsEnabled`.
3. WHEN an authenticated user modifies a Cloud_Setting, THE application SHALL update local state immediately and send the value to Bridge_API within a 1-second debounce window.
4. WHEN an authenticated user modifies a Local_Setting, THE application SHALL update only local storage without API calls.
5. WHEN a guest user modifies any setting, THE application SHALL store the value in localStorage only.

### Requirement 15: Preference Sync on Login

**User Story:** As a user logging in on a new device, I want my personalized settings downloaded and applied.

**UI Derivation:** Based on the `cloud_sync` icon pattern from the General tab and the toast notification pattern from the existing sync error notification in App.tsx.

#### Acceptance Criteria

1. WHEN a user successfully logs in, THE application SHALL fetch Cloud_Settings from Bridge_API.
2. WHEN Cloud_Settings are received, THE application SHALL merge them over local values (server wins) and immediately reflect changes in the UI (theme, font, AI model, etc.) without restart.
3. IF the Cloud_Settings fetch fails, THE application SHALL retain current local values, display a non-blocking toast notification at the bottom-left using the existing toast pattern (`position: fixed, bottom: 24px, left: 24px, background: #1f2937, color: #f9fafb, font-size: 12px, border-radius: 12px, padding: 10px 14px`) with message "Settings sync failed. Using local preferences." and a dismiss button.
4. WHEN a new user signs up, THE application SHALL upload current local preference values as initial Cloud_Settings.

### Requirement 16: Preferences General Tab UI

**User Story:** As a user, I want a refined General preferences tab that clearly separates appearance, sync, and local settings.

**UI Reference:** `ui/user-management/preferences_general_refined_ui/code.html`

#### Acceptance Criteria

1. THE General tab header SHALL display "General" in `font-headline text-3xl font-extrabold tracking-tight` with subtitle in `font-label text-sm text-on-surface-variant`.
2. THE Appearance section SHALL display theme selection as a 3-column grid of buttons (`grid-cols-3 gap-4`), each containing a preview thumbnail (`w-20 h-14 rounded-lg`) and label in `font-label text-xs font-semibold uppercase tracking-wider`. The active theme SHALL have `ring-1 ring-outline-variant/30 shadow-[0_8px_30px_-5px_rgba(67,67,213,0.12)]` and label in `text-primary`.
3. THE toggle switches SHALL use `h-6 w-11 rounded-full` with active state `bg-primary shadow-[0_0_8px_-1px_rgba(67,67,213,0.5)]` and knob `h-5 w-5 rounded-full bg-surface-container-lowest shadow`.
4. THE Synchronization section SHALL display an "Auto Sync (AuraBrain)" card with `bg-surface-container rounded-2xl p-6` containing a liquid aura gradient blob (`bg-primary/10 rounded-full blur-[50px]`), and a sync interval slider with custom track fill `bg-gradient-to-r from-primary to-primary-container rounded-full shadow-[0_0_8px_rgba(67,67,213,0.4)]` and visual thumb `w-6 h-6 bg-surface-container-lowest rounded-full shadow-md border border-outline-variant/20`.
5. THE Local Environment section SHALL display export format as a dropdown (`bg-surface-container-low rounded-xl py-3.5 ring-1 ring-outline-variant/10`) and export path as a readonly input with a "Browse" button (`bg-surface hover:bg-surface-container-high rounded-xl ring-1 ring-outline-variant/20`).
6. WHEN the user is authenticated, Cloud_Settings groups SHALL display a `cloud_sync` Material Symbol icon in `text-primary text-[18px]` next to the section title.
7. WHEN the user is a guest, THE Preferences content area SHALL display an info banner at the top using `p-6 bg-primary/5 rounded-xl border border-outline-variant/10 mb-8 flex items-start gap-4` (derived from the guest User_Menu info banner pattern) containing a circular icon `w-8 h-8 rounded-full bg-primary/10` with filled `auto_awesome` in `text-primary text-[1.125rem]`, value proposition text in `text-[0.9rem] font-medium leading-[1.6] text-on-surface-variant`, and a "Sign In" button using `bg-primary text-on-primary py-2 px-4 rounded-lg font-headline font-semibold text-sm`.

### Requirement 17: Preferences AI Engine Tab UI

**User Story:** As a user, I want to see my AI quota, model selection, and behavior settings in a polished interface.

**UI Reference:** `ui/user-management/preferences_ai_engine_credits_progress/code.html`

#### Acceptance Criteria

1. THE AI Engine tab header SHALL display "AI Engine Settings" in `text-3xl font-bold tracking-tight` with subtitle in `text-on-surface-variant text-base`.
2. THE Model & Credits card (authenticated only) SHALL use `bg-surface-container-lowest p-6 rounded-xl border border-outline-variant/15 shadow-[0_4px_24px_-4px_rgba(25,28,29,0.04)]` containing: an icon container `w-12 h-12 rounded-lg bg-primary/10 text-primary` with `auto_awesome` icon, plan name with PRO badge `px-2 py-0.5 rounded text-xs font-bold bg-primary text-on-primary`, remaining tokens in `text-2xl font-bold`, a progress bar `h-2 bg-surface-container-high rounded-full` with fill `bg-gradient-to-r from-primary to-primary-container`, and a "Get more credits" button `bg-primary text-on-primary px-5 py-2.5 rounded-md shadow-[0_0_12px_rgba(67,67,213,0.15)]`.
3. THE Capabilities section SHALL display AI Agent & Model and Context Window as dropdowns in a 2-column grid (`grid-cols-1 md:grid-cols-2 gap-6`), each using `bg-surface-container-low border-0 rounded-md px-4 py-3` with focus state `focus:shadow-[0_2px_0_0_rgba(67,67,213,1)]`.
4. THE Web Access toggle SHALL display in a container `p-4 bg-surface-container-low rounded-lg` with a PRO badge `px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-fixed-dim text-on-primary-fixed`.
5. THE Creativity slider SHALL display in a card `bg-surface-container-lowest rounded-xl border border-outline-variant/15 p-5` with current value shown as `text-lg font-bold text-primary bg-primary/5 px-3 py-1 rounded-md`, and labels "Focused (0)" / "Balanced" / "Creative (100)" below.
6. WHEN the user is a guest, premium AI models SHALL be disabled/grayed-out with a lock icon and tooltip "Sign in to unlock this model". The Web Access toggle SHALL also be disabled with a lock icon.

### Requirement 18: Preferences Sidebar Navigation

**User Story:** As a user, I want clear navigation between preference tabs.

**UI Reference:** `ui/user-management/preferences_general_refined_ui/code.html` and `ui/user-management/preferences_ai_engine_credits_progress/code.html` — the sidebar nav.

#### Acceptance Criteria

1. THE Preferences sidebar SHALL use `w-64 py-6 px-4 bg-zinc-50 border-r border-zinc-200/20 rounded-l-lg` with header "Preferences" in `text-lg font-black tracking-tight` and subtitle "System Configuration" in `text-sm text-zinc-500`.
2. THE active tab SHALL use `bg-white text-indigo-600 shadow-sm border-r-4 border-indigo-500` with a filled Material Symbol icon.
3. THE inactive tabs SHALL use `text-zinc-500 hover:bg-zinc-100 hover:translate-x-1 transition-transform duration-200` with outlined Material Symbol icons.
4. THE navigation items SHALL use `font-['Manrope'] text-sm font-medium tracking-wide uppercase` with icons at `text-[20px]`.

### Requirement 19: Preference Data Flow and Persistence

**User Story:** As a developer, I want a clear data flow for preference changes.

#### Acceptance Criteria

1. WHEN any setting is changed, THE store SHALL update immediately (optimistic update), causing all subscribed UI components to re-render.
2. IF the setting is a Cloud_Setting AND the user is authenticated, THEN THE application SHALL debounce for 1 second and send a PATCH request to Bridge_API.
3. IF the Bridge_API PATCH fails, THE application SHALL retain the optimistic local value and queue for retry without reverting the UI.
4. IF the setting is a Local_Setting OR the user is a guest, THE application SHALL persist to localStorage synchronously without API calls.
5. WHEN the user signs out, THE application SHALL reset all Cloud_Settings to their defaultValue from SETTING_REGISTRY and retain Local_Settings.
6. WHEN the user signs in on a device with locally-modified Cloud_Settings (from guest usage), THE application SHALL overwrite local values with server values (server wins).
