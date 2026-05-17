# Technical Design: Auth UI Flow

## Overview

This design describes the architecture for the Authentication UI Flow and User Personalization system in the WordAI desktop application. It covers the component hierarchy, state management integration, Firebase authentication wiring, preference cloud sync, and the data flow between UI components, auth store, and Bridge API.

The implementation builds on top of existing infrastructure:
- `authService.ts` — Firebase token exchange, session management
- `authStore.tsx` — React Context + useReducer for auth state
- `TopNavBar.tsx` — already has `onSignIn`/`onSignOut` props
- `preferencesService.ts` — Tauri-based preference persistence

## Components and Interfaces

### AuthModal Interface

```typescript
// src/components/auth/AuthModal.tsx
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup';
}

interface AuthModalState {
  currentView: 'login' | 'signup' | 'forgot-password' | 'reset-success';
  sharedEmail: string;
  isSubmitting: boolean;
  formError: string | null;
}
```

### Form Component Interfaces

```typescript
// Shared props pattern for all form components
interface AuthFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: AuthModalState['currentView']) => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

// src/components/auth/LoginForm.tsx
interface LoginFormProps extends AuthFormProps {}

// src/components/auth/SignUpForm.tsx
interface SignUpFormProps extends AuthFormProps {}

// src/components/auth/ForgotPasswordForm.tsx
interface ForgotPasswordFormProps extends Omit<AuthFormProps, 'onSuccess'> {
  onSuccess: () => void; // navigates to reset-success
}

// src/components/auth/ResetSuccessView.tsx
interface ResetSuccessViewProps {
  onNavigate: (view: 'login') => void;
}
```

### Cloud Settings Service Interface

```typescript
// src/services/cloudSettingsService.ts
export async function fetchCloudSettings(sessionId: string): Promise<Record<string, unknown>>;
export async function patchCloudSetting(sessionId: string, key: string, value: unknown): Promise<void>;
export async function uploadAllCloudSettings(sessionId: string, settings: Record<string, unknown>): Promise<void>;
export function resetCloudSettingsToDefaults(): void;
```

### Firebase Auth Service Interface

```typescript
// src/services/firebaseAuthService.ts
export async function firebaseSignIn(email: string, password: string): Promise<string>;
export async function firebaseSignUp(email: string, password: string, displayName: string): Promise<string>;
export async function firebaseResetPassword(email: string): Promise<void>;
export async function firebaseSignOut(): Promise<void>;
```

## Data Models

### Setting Classification

```typescript
// src/data/settingClassification.ts
export const CLOUD_SETTINGS: string[] = [
  'general.theme', 'general.language', 'general.focusMode',
  'general.autoSave', 'general.autoSyncEnabled', 'general.autoSyncInterval',
  'general.defaultExportFormat',
  'ai-engine.agent', 'ai-engine.model', 'ai-engine.creativity',
  'ai-engine.contextWindowTokens', 'ai-engine.responseLanguage', 'ai-engine.webAccess',
  'typography.fontFamily', 'typography.fontSize', 'typography.lineSpacing',
  'typography.smartQuotes', 'typography.autoCapitalize', 'typography.ligatures',
  'privacy.allowAITraining', 'privacy.localProcessingOnly',
];

export const LOCAL_SETTINGS: string[] = [
  'general.defaultExportPath',
  'about.auraBrainStoragePath',
  'privacy.crashReports',
  'privacy.analyticsEnabled',
];
```

### Bridge API Preference Endpoints

```typescript
// GET /user/preferences → Response
interface CloudSettingsResponse {
  settings: Record<string, unknown>;
  updated_at: string;
}

// PATCH /user/preferences → Request
interface PatchSettingsRequest {
  settings: Record<string, unknown>;
}
```

## Architecture

### Component Hierarchy

```
App.tsx
├── AuthModal (portal, rendered at document root)
│   ├── LoginForm
│   ├── SignUpForm
│   ├── ForgotPasswordForm
│   └── ResetSuccessView
├── TopNavBar
│   └── UserMenu (popover)
│       ├── UserMenuAuthenticated
│       └── UserMenuGuest
└── PreferencesWindow (separate Tauri window)
    ├── PreferencesSidebar
    ├── GeneralTab (updated with sync indicators)
    └── AIEngineTab (updated with credits card + gating)
```

### State Management

```
AuthStateProvider (React Context)
│
├── authState.accessContext: AccessContext | null
├── authState.aiAccessState: AIAccessState
├── authState.isLoading: boolean
├── authState.authError: string | null
│
├── setAuthLoading()
├── setAccessContext(ctx)
├── setAuthError(msg)
├── clearAuth()
└── refreshContext(ctx)
```

New state additions for Auth Modal:
```typescript
// Local state within AuthModal component
interface AuthModalState {
  isOpen: boolean;
  currentView: 'login' | 'signup' | 'forgot-password' | 'reset-success';
  sharedEmail: string; // preserved across view transitions
  isSubmitting: boolean;
  formError: string | null;
}
```

## Component Designs

### 1. AuthModal Component

**File:** `src/components/AuthModal.tsx`

Manages the modal overlay lifecycle and view routing. Renders as a React Portal attached to `document.body`.

```typescript
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'signup';
}
```

**Key behaviors:**
- Focus trap using a custom `useFocusTrap` hook
- Backdrop click and Escape key close (suppressed during loading)
- View transitions with CSS `transition-all duration-200 ease-out`
- Email preservation across view switches via `sharedEmail` state
- 30-second timeout for all async operations

**Rendering structure (from mockup):**
```
<div backdrop bg-inverse-surface/40 backdrop-blur-sm>
  <div modal-container bg-surface-container-lowest/80 backdrop-blur-[20px] rounded-xl>
    <div gradient-bar h-1 bg-gradient-to-r from-primary to-primary-container />
    <div content p-10>
      {currentView === 'login' && <LoginForm />}
      {currentView === 'signup' && <SignUpForm />}
      {currentView === 'forgot-password' && <ForgotPasswordForm />}
      {currentView === 'reset-success' && <ResetSuccessView />}
    </div>
  </div>
</div>
```

### 2. LoginForm Component

**File:** `src/components/auth/LoginForm.tsx`

```typescript
interface LoginFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'signup' | 'forgot-password') => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}
```

**Flow:**
1. User fills email + password
2. Client-side validation (non-empty)
3. Call `signInWithEmailAndPassword(auth, email, password)`
4. Get `idToken` from `user.getIdToken()`
5. Call `authService.login(idToken)` → returns `AccessContext`
6. Call `setAccessContext(context)` on auth store
7. Trigger `syncCloudSettings()` 
8. Call `onSuccess()` → modal closes

### 3. SignUpForm Component

**File:** `src/components/auth/SignUpForm.tsx`

```typescript
interface SignUpFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'login') => void;
  onSuccess: () => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}
```

**Validation rules:**
- Display name: 1-100 chars, trimmed, non-whitespace-only
- Email: HTML5 email validation
- Password: ≥6 characters
- Confirm password: must match password

**Flow:**
1. Validate all fields client-side
2. Call `createUserWithEmailAndPassword(auth, email, password)`
3. Call `updateProfile(user, { displayName })` 
4. Get `idToken` from `user.getIdToken()`
5. Call `authService.login(idToken)` → returns `AccessContext`
6. Call `setAccessContext(context)`
7. Call `uploadInitialCloudSettings()` (new user → upload local prefs)
8. Call `onSuccess()`

### 4. ForgotPasswordForm Component

**File:** `src/components/auth/ForgotPasswordForm.tsx`

```typescript
interface ForgotPasswordFormProps {
  email: string;
  onEmailChange: (email: string) => void;
  onNavigate: (view: 'login' | 'reset-success') => void;
  onError: (error: string) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}
```

### 5. UserMenu Component

**File:** `src/components/UserMenu.tsx` (replaces inline menu in TopNavBar)

Renders conditionally based on `accessContext`:
- `accessContext !== null` → `UserMenuAuthenticated`
- `accessContext === null` → `UserMenuGuest`

**Key behaviors:**
- Keyboard navigation (ArrowUp/Down, Enter, Escape)
- Click-outside close via existing `useRef` + `mousedown` listener
- Window blur close via `window.addEventListener('blur', ...)`
- Fade-out animation on close (`opacity-0 transition-opacity duration-150`)

## Preference Sync Architecture

### Setting Classification

```typescript
// src/data/settingClassification.ts

export const CLOUD_SETTINGS: string[] = [
  'general.theme', 'general.language', 'general.focusMode',
  'general.autoSave', 'general.autoSyncEnabled', 'general.autoSyncInterval',
  'general.defaultExportFormat',
  'ai-engine.agent', 'ai-engine.model', 'ai-engine.creativity',
  'ai-engine.contextWindowTokens', 'ai-engine.responseLanguage', 'ai-engine.webAccess',
  'typography.fontFamily', 'typography.fontSize', 'typography.lineSpacing',
  'typography.smartQuotes', 'typography.autoCapitalize', 'typography.ligatures',
  'privacy.allowAITraining', 'privacy.localProcessingOnly',
];

export const LOCAL_SETTINGS: string[] = [
  'general.defaultExportPath',
  'about.auraBrainStoragePath',
  'privacy.crashReports',
  'privacy.analyticsEnabled',
];

export function isCloudSetting(key: string): boolean {
  return CLOUD_SETTINGS.includes(key);
}
```

### Cloud Settings Service

**File:** `src/services/cloudSettingsService.ts`

```typescript
export async function fetchCloudSettings(sessionId: string): Promise<Record<string, unknown>>;
export async function patchCloudSetting(sessionId: string, key: string, value: unknown): Promise<void>;
export async function uploadAllCloudSettings(sessionId: string, settings: Record<string, unknown>): Promise<void>;
```

**Debounce strategy:**
- Each setting change queues a patch
- Debounce timer: 1000ms
- If multiple settings change within the window, batch them into a single PATCH
- On failure: queue for retry, do not revert UI

### Data Flow Diagram

```
User changes setting
       │
       ▼
┌─────────────────────┐
│ Zustand/Context      │ ← Immediate optimistic update
│ store.updateSetting()│
└─────────┬───────────┘
          │
          ▼
┌─────────────────────────────────┐
│ isCloudSetting(key)?            │
│   YES + authenticated:          │
│     → debounce 1s               │
│     → PATCH /user/preferences   │
│   NO or guest:                  │
│     → localStorage.setItem()    │
└─────────────────────────────────┘
```

### Login Sync Flow

```
Login success (AccessContext received)
       │
       ▼
┌──────────────────────────┐
│ fetchCloudSettings()      │
│ from Bridge API           │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Merge: server wins        │
│ for all CLOUD_SETTINGS    │
│ keys                      │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ Apply to store            │
│ → UI re-renders           │
│ (theme, font, AI model)   │
└──────────────────────────┘
```

## Firebase Integration

### Firebase App Initialization

**File:** `src/services/firebaseApp.ts`

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Firebase Auth Operations

**File:** `src/services/firebaseAuthService.ts`

```typescript
import { signInWithEmailAndPassword, createUserWithEmailAndPassword,
         sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { auth } from './firebaseApp';

export async function firebaseSignIn(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user.getIdToken();
}

export async function firebaseSignUp(email: string, password: string, displayName: string): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return credential.user.getIdToken();
}

export async function firebaseResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function firebaseSignOut(): Promise<void> {
  await signOut(auth);
}
```

### Error Mapping

```typescript
// src/utils/authErrorMapper.ts

export function mapFirebaseError(code: string, t: TFunction): string {
  switch (code) {
    case 'auth/invalid-credential':
      return t('auth.errors.invalidCredential');
    case 'auth/user-not-found':
      return t('auth.errors.userNotFound');
    case 'auth/email-already-in-use':
      return t('auth.errors.emailInUse');
    case 'auth/weak-password':
      return t('auth.errors.weakPassword');
    case 'auth/too-many-requests':
      return t('auth.errors.tooManyRequests');
    default:
      return t('auth.errors.generic');
  }
}

export function mapBridgeError(code: BridgeErrorCodeValue, t: TFunction): string {
  switch (code) {
    case 'ACCOUNT_SUSPENDED':
      return t('auth.errors.accountSuspended');
    case 'TOKEN_EXPIRED_OR_INVALID':
      return t('auth.errors.tokenInvalid');
    default:
      return t('auth.errors.generic');
  }
}
```

## Session Restoration Flow

```
App startup
    │
    ▼
┌────────────────────────────┐
│ getPersistedSessionId()     │
│ from localStorage           │
└──────────┬─────────────────┘
           │
     ┌─────┴─────┐
     │ null?     │
     └─────┬─────┘
       YES │         NO
           │          │
           ▼          ▼
    Set guest    ┌──────────────────┐
    state        │ fetchAccessContext│
                 │ (10s timeout)     │
                 └────────┬─────────┘
                          │
                    ┌─────┴─────┐
                    │ success?  │
                    └─────┬─────┘
                  YES │         NO
                      │          │
                      ▼          ▼
              setAccessContext  clearLocalAuthCache
              syncCloudSettings  set guest state
```

## Sign Out Flow

```
User clicks "Sign Out"
    │
    ▼
┌────────────────────────────┐
│ Show spinner on button      │
│ Disable menu items          │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ authService.logout(sessionId)│
│ (revoke session + clear cache)│
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ firebaseSignOut()           │
└──────────┬─────────────────┘
           │
           ▼
┌────────────────────────────┐
│ clearAuth() on store        │
│ resetCloudSettingsToDefaults│
│ Close menu, show guest state│
└────────────────────────────┘
```

## Bridge API Endpoints (New)

### GET /user/preferences
Returns the user's cloud settings as a JSON object.

### PATCH /user/preferences
Updates one or more cloud settings. Body: `{ settings: { key: value, ... } }`

## i18n Keys Structure

```json
{
  "auth": {
    "login": {
      "title": "Đăng nhập",
      "emailLabel": "Email",
      "passwordLabel": "Mật khẩu",
      "forgotPassword": "Quên mật khẩu?",
      "submit": "Đăng nhập",
      "noAccount": "Chưa có tài khoản?",
      "signUp": "Đăng ký"
    },
    "signup": {
      "title": "Tạo tài khoản",
      "subtitle": "Bắt đầu không gian sáng tạo của bạn.",
      "displayNameLabel": "Tên hiển thị",
      "emailLabel": "Email",
      "passwordLabel": "Mật khẩu",
      "confirmPasswordLabel": "Xác nhận mật khẩu",
      "submit": "Đăng ký",
      "hasAccount": "Đã có tài khoản?",
      "backToLogin": "Quay lại đăng nhập"
    },
    "forgotPassword": {
      "title": "Khôi phục mật khẩu",
      "description": "Nhập email của bạn để nhận hướng dẫn khôi phục mật khẩu.",
      "emailLabel": "Email liên kết",
      "submit": "Gửi email khôi phục",
      "backToLogin": "Quay lại Đăng nhập"
    },
    "resetSuccess": {
      "title": "Đã gửi email thành công!",
      "subtitle": "Vui lòng kiểm tra hòm thư của bạn.",
      "backToLogin": "Về trang Đăng nhập"
    },
    "errors": {
      "invalidCredential": "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra lại email và mật khẩu.",
      "userNotFound": "Không tìm thấy tài khoản với email này.",
      "emailInUse": "Email này đã được đăng ký.",
      "weakPassword": "Mật khẩu không đủ mạnh. Vui lòng chọn mật khẩu dài hơn.",
      "tooManyRequests": "Quá nhiều lần thử. Vui lòng đợi một lát rồi thử lại.",
      "accountSuspended": "Tài khoản đã bị tạm khóa. Vui lòng liên hệ hỗ trợ.",
      "tokenInvalid": "Phiên đăng nhập không hợp lệ. Vui lòng thử lại.",
      "networkError": "Không thể kết nối. Vui lòng kiểm tra mạng và thử lại.",
      "timeout": "Thao tác quá thời gian. Vui lòng thử lại.",
      "generic": "Đã xảy ra lỗi. Vui lòng thử lại.",
      "passwordMismatch": "Mật khẩu không khớp",
      "passwordTooShort": "Mật khẩu phải có ít nhất 6 ký tự",
      "nameRequired": "Tên hiển thị không được để trống",
      "nameTooLong": "Tên hiển thị tối đa 100 ký tự",
      "emailRequired": "Vui lòng nhập email",
      "emailInvalid": "Email không hợp lệ",
      "passwordRequired": "Vui lòng nhập mật khẩu"
    }
  },
  "userMenu": {
    "myLibrary": "My Library",
    "signOut": "Sign Out",
    "guestBanner": "Sign in to sync your theme, typography, and unlock powerful AI models across all devices.",
    "signInSignUp": "Sign In / Sign Up",
    "exploreFeatures": "Explore Features"
  }
}
```

## File Structure

```
src/
├── components/
│   ├── auth/
│   │   ├── AuthModal.tsx          (Req 1, 9, 10)
│   │   ├── LoginForm.tsx          (Req 2, 3)
│   │   ├── SignUpForm.tsx         (Req 4)
│   │   ├── ForgotPasswordForm.tsx (Req 5)
│   │   ├── ResetSuccessView.tsx   (Req 6)
│   │   └── useFocusTrap.ts       (Req 1.5)
│   ├── UserMenu.tsx               (Req 7, 8)
│   ├── UserMenuAuthenticated.tsx  (Req 7)
│   └── UserMenuGuest.tsx          (Req 8)
├── services/
│   ├── firebaseApp.ts             (Firebase init)
│   ├── firebaseAuthService.ts     (Firebase auth operations)
│   ├── cloudSettingsService.ts    (Req 14, 15, 19)
│   └── authService.ts            (existing, unchanged)
├── data/
│   └── settingClassification.ts   (Req 14)
├── utils/
│   └── authErrorMapper.ts         (Req 3, 6)
└── i18n/locales/
    ├── en.json                    (Req 13 — auth keys added)
    └── vi.json                    (Req 13 — auth keys added)
```

## Traceability Matrix

| Requirement | Components | Services |
|---|---|---|
| Req 1 (Auth Modal) | AuthModal | — |
| Req 2 (Login Form) | LoginForm | firebaseAuthService, authService |
| Req 3 (Login Errors) | LoginForm | authErrorMapper |
| Req 4 (Sign Up) | SignUpForm | firebaseAuthService, authService |
| Req 5 (Forgot Password) | ForgotPasswordForm | firebaseAuthService |
| Req 6 (Reset Success) | ResetSuccessView | — |
| Req 7 (Menu Auth) | UserMenuAuthenticated | — |
| Req 8 (Menu Guest) | UserMenuGuest | — |
| Req 9 (Transitions) | AuthModal | — |
| Req 10 (Loading) | AuthModal, all forms | — |
| Req 11 (Sign Out) | UserMenuAuthenticated | authService, firebaseAuthService |
| Req 12 (Session Restore) | App.tsx | authService, cloudSettingsService |
| Req 13 (i18n) | All components | i18n locales |
| Req 14 (Cloud/Local) | — | settingClassification |
| Req 15 (Sync on Login) | App.tsx | cloudSettingsService |
| Req 16 (General Tab) | PreferencesWindow | — |
| Req 17 (AI Engine Tab) | PreferencesWindow | — |
| Req 18 (Sidebar Nav) | PreferencesWindow | — |
| Req 19 (Data Flow) | PreferencesWindow | cloudSettingsService, preferencesService |

## Error Handling

### Firebase Auth Errors

| Firebase Error Code | User-Facing Message (vi) | Form |
|---|---|---|
| auth/invalid-credential | Thông tin đăng nhập không hợp lệ | Login |
| auth/user-not-found | Không tìm thấy tài khoản với email này | Login |
| auth/email-already-in-use | Email này đã được đăng ký | SignUp |
| auth/weak-password | Mật khẩu không đủ mạnh | SignUp |
| auth/too-many-requests | Quá nhiều lần thử. Vui lòng đợi | Login/SignUp |
| (network error) | Không thể kết nối. Kiểm tra mạng | All |
| (unknown) | Đã xảy ra lỗi. Vui lòng thử lại | All |

### Bridge API Errors

| Bridge Error Code | User-Facing Message (vi) | Action |
|---|---|---|
| ACCOUNT_SUSPENDED | Tài khoản đã bị tạm khóa | Show error, no retry |
| TOKEN_EXPIRED_OR_INVALID | Phiên đăng nhập không hợp lệ | Show error, allow retry |
| RATE_LIMIT_EXCEEDED | Quá nhiều yêu cầu | Show error, suggest wait |

### Error Display Pattern

All errors use the same banner component:
- Container: `bg-error-container text-on-error-container rounded-lg p-4 mb-8 flex items-start gap-3`
- Icon: filled `error` Material Symbol
- Text: `font-headline text-sm font-medium leading-snug`
- Dismissal: any input field modification clears the error

### Timeout Handling

- All auth operations have a 30-second timeout
- On timeout: cancel the operation, re-enable form, show timeout error message
- Cloud settings sync has a 10-second timeout (session restoration)

## Correctness Properties

### Property 1: Auth State Consistency
After any auth operation (login, logout, session restore), the `accessContext` and `aiAccessState` in the store MUST be consistent — if `accessContext` is null, `aiAccessState` MUST be 'guest'.
**Validates: Requirements 11.2, 12.2, 12.3**

### Property 2: Session Persistence Integrity
The persisted session ID in localStorage MUST always correspond to a valid session. On any auth failure, the persisted ID MUST be cleared.
**Validates: Requirements 11.2, 12.3**

### Property 3: Cloud Settings Idempotence
Uploading the same cloud settings value multiple times MUST produce the same server state. The debounce mechanism MUST coalesce rapid changes into a single API call.
**Validates: Requirements 14.3, 19.2**

### Property 4: Optimistic Update Safety
If a cloud settings PATCH fails, the local UI value MUST NOT revert. The failed change MUST be queued for retry.
**Validates: Requirements 19.3**

### Property 5: Focus Trap Completeness
While the Auth Modal is open, no element outside the modal MUST be reachable via keyboard navigation (Tab/Shift+Tab).
**Validates: Requirements 1.5**

### Property 6: Email Preservation
When navigating between auth forms, the email field value MUST be preserved if non-empty, regardless of the navigation direction.
**Validates: Requirements 9.3**

### Property 7: Loading State Exclusivity
While `isSubmitting` is true, the modal MUST NOT close via backdrop click or Escape, and no form submission MUST be possible.
**Validates: Requirements 10.2, 10.3**

## Testing Strategy

### Unit Tests

- `authErrorMapper.ts` — verify all Firebase/Bridge error codes map to correct i18n keys
- `settingClassification.ts` — verify all settings are classified as either Cloud or Local
- `cloudSettingsService.ts` — verify debounce behavior, retry queue, merge logic
- `firebaseAuthService.ts` — mock Firebase SDK, verify correct function calls

### Component Tests (React Testing Library)

- `AuthModal` — open/close, focus trap, Escape key, backdrop click, view transitions
- `LoginForm` — validation, submission, error display, loading state
- `SignUpForm` — validation rules (name length, password match, min length), error states
- `ForgotPasswordForm` — validation, success navigation
- `UserMenuAuthenticated` — keyboard navigation, sign-out loading state
- `UserMenuGuest` — sign-in button opens modal

### Integration Tests

- Full login flow: Firebase mock → authService.login → store update → modal close → settings sync
- Full sign-out flow: button click → logout → store clear → settings reset → UI update
- Session restoration: persisted ID → fetchAccessContext → store update → settings sync
- Preference sync: change setting → debounce → API call → verify server state
