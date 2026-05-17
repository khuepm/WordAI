/**
 * firebaseAuthService — Firebase Authentication operations for the Client App.
 *
 * Provides functions for email/password sign-in, account creation with
 * display name, password reset, and sign-out using the Firebase Auth SDK.
 *
 * Requirements: 2.5, 4.7, 5.6, 11.1
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { auth } from './firebaseApp';

/**
 * Signs in a user with email and password and returns the Firebase ID token.
 */
export async function firebaseSignIn(email: string, password: string): Promise<string> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user.getIdToken();
}

/**
 * Creates a new user account, sets the display name, and returns the Firebase ID token.
 */
export async function firebaseSignUp(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  return credential.user.getIdToken();
}

/**
 * Sends a password reset email to the specified address.
 */
export async function firebaseResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Signs out the current user from Firebase.
 */
export async function firebaseSignOut(): Promise<void> {
  await signOut(auth);
}
