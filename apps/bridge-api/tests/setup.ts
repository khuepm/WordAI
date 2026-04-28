/**
 * Vitest setup file — runs in the same worker context as tests.
 *
 * Patches Node's require cache to inject a mock for 'firebase-admin' before
 * any test file imports the source modules that use it.
 */

import { vi } from 'vitest';

// Shared mock function — exported so tests can import and configure it.
export const mockVerifyIdToken = vi.fn();

// Build the mock module object
const firebaseAdminMock = {
  apps: [{}],
  auth: () => ({ verifyIdToken: mockVerifyIdToken }),
  credential: {
    cert: vi.fn(),
    applicationDefault: vi.fn(),
  },
  initializeApp: vi.fn(),
};

// In Vitest's worker environment, we can access require.cache via the
// createRequire utility from the 'module' built-in.
// We need to inject the mock BEFORE the source module is loaded.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Module = require('module');
  const resolvedPath = Module._resolveFilename(
    'firebase-admin',
    // Use a fake parent module rooted at the project src directory
    { id: 'test', filename: __filename, paths: Module._nodeModulePaths(__dirname) },
  );

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require.cache[resolvedPath] = {
    id: resolvedPath,
    filename: resolvedPath,
    loaded: true,
    exports: firebaseAdminMock,
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
} catch {
  // If resolution fails, fall back to a direct key injection
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require.cache['firebase-admin'] = {
    id: 'firebase-admin',
    filename: 'firebase-admin',
    loaded: true,
    exports: firebaseAdminMock,
    parent: null,
    children: [],
    paths: [],
  } as unknown as NodeJS.Module;
}
