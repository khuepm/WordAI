/**
 * firebaseApp — Firebase App initialization for the Client App.
 *
 * Initializes the Firebase app instance using environment variables and
 * exports the shared `app` and `auth` instances used throughout the
 * application.
 *
 * Requirements: 2.5, 4.6, 5.6
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
