/**
 * authService — Client App authentication service.
 *
 * Handles the Firebase login/logout flow and Bridge API token exchange.
 * All Bridge API calls go through this module; the auth store is updated
 * by the caller after each operation.
 *
 * Requirements: 1.1, 1.2, 7.1, 7.2, 7.5, 7.7, 13.12
 */

import type { AccessContext, BridgeErrorCodeValue } from '../types/auth';
import { BridgeErrorCode } from '../types/auth';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Base URL for the Bridge API.
 * In production this is injected via environment variable; in tests it is
 * overridden by mocking `fetchJson`.
 */
const BRIDGE_API_BASE_URL =
  import.meta.env.VITE_BRIDGE_API_URL || 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Thin wrapper around `fetch` that throws a typed error when the response is
 * not 2xx.  Exported for testing purposes only.
 */
export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const code: BridgeErrorCodeValue =
      (body as { error?: { code?: BridgeErrorCodeValue } })?.error?.code ??
      'AUTH_REQUIRED';
    const message: string =
      (body as { error?: { message?: string } })?.error?.message ??
      `HTTP ${response.status}`;
    throw new BridgeApiError(code, message, response.status);
  }

  return response.json() as Promise<T>;
}

/** Typed error thrown when the Bridge API returns a non-2xx response. */
export class BridgeApiError extends Error {
  constructor(
    public readonly code: BridgeErrorCodeValue,
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'BridgeApiError';
  }
}

/** Returns true when the error code is one that requires an auth context refresh. */
export function requiresContextRefresh(code: BridgeErrorCodeValue): boolean {
  return (
    code === BridgeErrorCode.ACCOUNT_SUSPENDED ||
    code === BridgeErrorCode.SESSION_REVOKED ||
    code === BridgeErrorCode.AI_QUOTA_EXCEEDED
  );
}

// ---------------------------------------------------------------------------
// Device ID
// ---------------------------------------------------------------------------

const DEVICE_ID_KEY = 'wordai_device_id';

/**
 * Returns a stable device identifier for this installation.
 * Generated once and persisted in localStorage.
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Auth token cache
// ---------------------------------------------------------------------------

const AUTH_SESSION_KEY = 'wordai_auth_session_id';

/** Persist the current session ID so it survives page reloads. */
export function persistSessionId(sessionId: string): void {
  localStorage.setItem(AUTH_SESSION_KEY, sessionId);
}

/** Retrieve the persisted session ID, or null if none. */
export function getPersistedSessionId(): string | null {
  return localStorage.getItem(AUTH_SESSION_KEY);
}

/** Clear all locally cached auth data (tokens, session ID). */
export function clearLocalAuthCache(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
  // Device ID is intentionally retained across logouts.
}

// ---------------------------------------------------------------------------
// Bridge API calls
// ---------------------------------------------------------------------------

/**
 * Exchange a Firebase ID token for an Access Context.
 *
 * Requirements: 1.1, 1.2
 */
export async function exchangeToken(
  firebaseIdToken: string,
  deviceId: string,
): Promise<AccessContext> {
  const context = await fetchJson<AccessContext>(
    `${BRIDGE_API_BASE_URL}/auth/exchange`,
    {
      method: 'POST',
      body: JSON.stringify({ firebaseIdToken, deviceId }),
    },
  );
  persistSessionId(context.session.id);
  return context;
}

/**
 * Revoke the current session via the Bridge API.
 *
 * Requirements: 7.2, 7.3, 7.4
 */
export async function revokeSession(sessionId: string): Promise<void> {
  await fetchJson<{ revoked: boolean; revoked_at: string }>(
    `${BRIDGE_API_BASE_URL}/auth/logout`,
    {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    },
  );
}

/**
 * Fetch a fresh Access Context from the Bridge API.
 *
 * Requirements: 8.8, 13.12
 */
export async function fetchAccessContext(
  sessionId: string,
): Promise<AccessContext> {
  return fetchJson<AccessContext>(`${BRIDGE_API_BASE_URL}/auth/context`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Session-Id': sessionId,
    },
  });
}

// ---------------------------------------------------------------------------
// High-level login / logout flows
// ---------------------------------------------------------------------------

/**
 * Full login flow:
 * 1. Exchange the Firebase ID token for an Access Context via the Bridge API.
 * 2. Persist the session ID locally.
 *
 * The caller is responsible for calling Firebase `signInWithEmailAndPassword`
 * first and passing the resulting ID token here.
 *
 * Requirements: 1.1, 1.2
 */
export async function login(firebaseIdToken: string): Promise<AccessContext> {
  const deviceId = getDeviceId();
  return exchangeToken(firebaseIdToken, deviceId);
}

/**
 * Full logout flow:
 * 1. Revoke the session via the Bridge API.
 * 2. Clear all local auth cache and tokens.
 *
 * The caller is responsible for calling Firebase `signOut` before or after
 * this function (Req 7.7 requires all three steps to complete).
 *
 * Requirements: 7.2, 7.5, 7.7
 */
export async function logout(sessionId: string): Promise<void> {
  try {
    await revokeSession(sessionId);
  } finally {
    // Always clear local cache even if the API call fails (Req 7.5)
    clearLocalAuthCache();
  }
}

/**
 * Refresh the Access Context after receiving an error that indicates the
 * server-side state has changed (quota exceeded, session revoked, etc.).
 *
 * Requirements: 13.12
 */
export async function refreshAccessContext(
  sessionId: string,
): Promise<AccessContext | null> {
  try {
    return await fetchAccessContext(sessionId);
  } catch {
    return null;
  }
}
