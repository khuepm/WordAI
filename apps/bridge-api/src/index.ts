import 'dotenv/config';
import express from 'express';
import { errorHandler, notFoundHandler, requestLogger } from './middleware';
import {
  createFullEmptyState,
  FullDatabaseState,
} from './services/accessContextService';
import { verifyFirebaseToken, type FirebaseClaims } from './auth';
import {
  createRateLimiterState,
} from './routes/auth';
import { createLogoutHandler } from './routes/logout';
import { createGetContextHandler } from './routes/context';

const app = express();
const PORT = process.env.PORT ?? 3001;

// ---------------------------------------------------------------------------
// Firebase token verification strategy
// ---------------------------------------------------------------------------

/**
 * In development (no service account configured), decode the Firebase ID token
 * without signature verification. This allows local testing without needing
 * a service account key file.
 *
 * In production, use the full Firebase Admin SDK verification.
 */
async function verifyToken(idToken: string): Promise<FirebaseClaims> {
  const hasCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (hasCredentials) {
    return verifyFirebaseToken(idToken);
  }

  // Dev mode: decode JWT payload without signature verification
  // Firebase ID tokens are JWTs with claims in the payload (second segment)
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8'),
    );

    return {
      firebase_uid: payload.user_id || payload.sub || '',
      email: payload.email || '',
      display_name: payload.name || null,
      avatar_url: payload.picture || null,
    };
  } catch (err) {
    throw new Error(
      `Failed to decode Firebase ID token (dev mode): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

let dbState: FullDatabaseState = createFullEmptyState();

// Seed default roles and permissions
dbState.roles = [
  { role_code: 'user', description: 'Standard user' },
  { role_code: 'pro', description: 'Pro subscriber' },
];
dbState.permissions = [
  { permission_code: 'ai.use', description: 'Use AI features' },
  { permission_code: 'ai.export', description: 'Export AI content' },
  { permission_code: 'settings.sync', description: 'Sync settings to cloud' },
];
dbState.rolePermissions = [
  { role_code: 'user', permission_code: 'ai.use' },
  { role_code: 'user', permission_code: 'settings.sync' },
  { role_code: 'pro', permission_code: 'ai.use' },
  { role_code: 'pro', permission_code: 'ai.export' },
  { role_code: 'pro', permission_code: 'settings.sync' },
];

function getState(): FullDatabaseState {
  return dbState;
}

function setState(newState: FullDatabaseState): void {
  dbState = newState;
}

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(express.json());
app.use(requestLogger);

// CORS for local development
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Session-Id');
  if (_req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// --- Auth routes ---

// Rate limiter state (shared across requests, in-memory)
const rateLimiter = { state: createRateLimiterState() };

// POST /auth/exchange — exchange Firebase ID token for Access Context
app.post('/auth/exchange', async (req, res) => {
  const { firebaseIdToken, deviceId } = req.body;

  if (!firebaseIdToken || !deviceId) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'firebaseIdToken and deviceId are required',
        trace_id: crypto.randomUUID(),
      },
    });
    return;
  }

  // Rate limiting
  const { checkRateLimit } = require('./routes/auth');
  const { allowed, state: newRlState } = checkRateLimit(
    rateLimiter.state, deviceId, 10, 60_000, Date.now(),
  );
  rateLimiter.state = newRlState;
  if (!allowed) {
    res.status(429).json({
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests', trace_id: crypto.randomUUID() },
    });
    return;
  }

  try {
    const claims = await verifyToken(firebaseIdToken);

    // Run token exchange (upsert user + session)
    const { processTokenExchange } = require('./routes/auth');
    const { state: newState } = processTokenExchange(getState(), claims, deviceId);

    // Auto-assign 'user' role if missing
    let finalState = newState as FullDatabaseState;
    const user = finalState.users.find((u: any) => u.firebase_uid === claims.firebase_uid);
    if (user) {
      const hasRole = finalState.userRoles.some((ur: any) => ur.user_id === user.id);
      if (!hasRole) {
        finalState = {
          ...finalState,
          userRoles: [
            ...finalState.userRoles,
            {
              id: crypto.randomUUID(),
              user_id: user.id,
              role_code: 'user',
              assigned_at: new Date().toISOString(),
              assigned_by: null,
            },
          ],
        };
      }
    }

    setState(finalState);

    // Rebuild access context with roles included
    const { buildAccessContext } = require('./services/accessContextService');
    const session = finalState.sessions.find(
      (s: any) => s.user_id === user?.id && s.device_id === deviceId,
    );
    const response = buildAccessContext(finalState, user!.id, session!.id);

    res.json(response);
  } catch (err: any) {
    if (err.code && err.statusCode) {
      res.status(err.statusCode).json({
        error: { code: err.code, message: err.message, trace_id: crypto.randomUUID() },
      });
    } else {
      res.status(500).json({
        error: { code: 'INTERNAL_SERVER_ERROR', message: err.message || 'An unexpected error occurred', trace_id: crypto.randomUUID() },
      });
    }
  }
});

// POST /auth/logout — revoke a session
const logoutHandler = createLogoutHandler(
  getState,
  setState,
  (req) => {
    // Extract user ID from session ID lookup
    const sessionId = (req as any).body?.sessionId;
    if (!sessionId) return null;
    const session = getState().sessions.find((s) => s.id === sessionId);
    return session?.user_id ?? null;
  },
);

app.post('/auth/logout', (req, res) => {
  logoutHandler(req as any, res as any);
});

// GET /auth/context — get fresh Access Context for authenticated session
const getContextHandler = createGetContextHandler(
  getState,
  (req) => {
    // Look up user from session
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return null;
    const session = getState().sessions.find((s) => s.id === sessionId);
    return session?.user_id ?? null;
  },
  (req) => {
    return req.headers['x-session-id'] ?? null;
  },
);

app.get('/auth/context', (req, res) => {
  getContextHandler(req as any, res as any);
});

// ---------------------------------------------------------------------------
// User preferences (cloud settings sync) — in-memory store
// ---------------------------------------------------------------------------

const userPreferences = new Map<string, Record<string, unknown>>();

function getUserIdFromSession(req: express.Request): string | null {
  const sessionId = req.headers['x-session-id'];
  if (typeof sessionId !== 'string' || !sessionId) return null;
  const session = getState().sessions.find((s) => s.id === sessionId);
  return session?.user_id ?? null;
}

// GET /user/preferences — fetch cloud settings for current user
app.get('/user/preferences', (req, res) => {
  const userId = getUserIdFromSession(req);
  if (!userId) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required', trace_id: crypto.randomUUID() },
    });
    return;
  }
  const settings = userPreferences.get(userId) ?? {};
  res.json({ settings, updated_at: new Date().toISOString() });
});

// PATCH /user/preferences — partial update of cloud settings
app.patch('/user/preferences', (req, res) => {
  const userId = getUserIdFromSession(req);
  if (!userId) {
    res.status(401).json({
      error: { code: 'AUTH_REQUIRED', message: 'Authentication required', trace_id: crypto.randomUUID() },
    });
    return;
  }
  const existing = userPreferences.get(userId) ?? {};
  const patch = (req.body && typeof req.body === 'object') ? req.body : {};
  userPreferences.set(userId, { ...existing, ...patch });
  res.json({ updated_at: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Error handling — must be registered after all routes
// ---------------------------------------------------------------------------

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Bridge API listening on port ${PORT}`);
});

export default app;
