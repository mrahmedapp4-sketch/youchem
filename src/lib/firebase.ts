import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Opens the Google sign-in popup and returns the Google ID token.
 * The backend verifies this token (see /api/student/google-login) before
 * creating a session, so we never trust the client-side profile alone.
 */
export async function signInWithGoogle(): Promise<{ idToken: string }> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.idToken) {
    throw new Error('لم يتم الحصول على بيانات جوجل، حاول مرة أخرى');
  }
  return { idToken: credential.idToken };
}
