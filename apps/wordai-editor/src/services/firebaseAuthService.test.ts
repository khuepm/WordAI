/**
 * Unit tests for firebaseAuthService.
 *
 * Mocks the Firebase Auth SDK to verify correct function calls and return values.
 * Requirements: 2.5, 4.7, 5.6, 11.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/auth module
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signOut: vi.fn(),
  updateProfile: vi.fn(),
  getAuth: vi.fn(() => ({})),
}));

// Mock firebaseApp module
vi.mock('./firebaseApp', () => ({
  auth: { currentUser: null },
}));

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { firebaseSignIn, firebaseSignUp, firebaseResetPassword, firebaseSignOut } from './firebaseAuthService';

const mockSignIn = vi.mocked(signInWithEmailAndPassword);
const mockCreateUser = vi.mocked(createUserWithEmailAndPassword);
const mockSendReset = vi.mocked(sendPasswordResetEmail);
const mockSignOut = vi.mocked(signOut);
const mockUpdateProfile = vi.mocked(updateProfile);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('firebaseSignIn', () => {
  it('calls signInWithEmailAndPassword and returns the ID token', async () => {
    const mockGetIdToken = vi.fn().mockResolvedValue('mock-id-token');
    mockSignIn.mockResolvedValue({
      user: { getIdToken: mockGetIdToken },
    } as any);

    const token = await firebaseSignIn('user@example.com', 'password123');

    expect(mockSignIn).toHaveBeenCalledWith(expect.anything(), 'user@example.com', 'password123');
    expect(mockGetIdToken).toHaveBeenCalled();
    expect(token).toBe('mock-id-token');
  });

  it('propagates Firebase errors', async () => {
    const error = new Error('auth/invalid-credential');
    mockSignIn.mockRejectedValue(error);

    await expect(firebaseSignIn('bad@example.com', 'wrong')).rejects.toThrow('auth/invalid-credential');
  });
});

describe('firebaseSignUp', () => {
  it('creates user, sets displayName, and returns the ID token', async () => {
    const mockUser = {
      getIdToken: vi.fn().mockResolvedValue('new-user-token'),
    };
    mockCreateUser.mockResolvedValue({ user: mockUser } as any);
    mockUpdateProfile.mockResolvedValue(undefined);

    const token = await firebaseSignUp('new@example.com', 'pass123', 'John Doe');

    expect(mockCreateUser).toHaveBeenCalledWith(expect.anything(), 'new@example.com', 'pass123');
    expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'John Doe' });
    expect(mockUser.getIdToken).toHaveBeenCalled();
    expect(token).toBe('new-user-token');
  });

  it('propagates Firebase errors from createUserWithEmailAndPassword', async () => {
    mockCreateUser.mockRejectedValue(new Error('auth/email-already-in-use'));

    await expect(firebaseSignUp('existing@example.com', 'pass', 'Name')).rejects.toThrow(
      'auth/email-already-in-use'
    );
  });
});

describe('firebaseResetPassword', () => {
  it('calls sendPasswordResetEmail with the correct email', async () => {
    mockSendReset.mockResolvedValue(undefined);

    await firebaseResetPassword('user@example.com');

    expect(mockSendReset).toHaveBeenCalledWith(expect.anything(), 'user@example.com');
  });

  it('propagates Firebase errors', async () => {
    mockSendReset.mockRejectedValue(new Error('auth/user-not-found'));

    await expect(firebaseResetPassword('unknown@example.com')).rejects.toThrow('auth/user-not-found');
  });
});

describe('firebaseSignOut', () => {
  it('calls signOut on the auth instance', async () => {
    mockSignOut.mockResolvedValue(undefined);

    await firebaseSignOut();

    expect(mockSignOut).toHaveBeenCalledWith(expect.anything());
  });

  it('propagates Firebase errors', async () => {
    mockSignOut.mockRejectedValue(new Error('auth/network-request-failed'));

    await expect(firebaseSignOut()).rejects.toThrow('auth/network-request-failed');
  });
});
