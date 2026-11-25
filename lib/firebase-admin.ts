// Server-side Firebase Admin SDK: verifies the ID token the browser got
// from Firebase Auth, so only a real Google/Facebook sign-in can create a
// session. The Admin SDK never trusts a token the client merely claims.
//
// Credentials come from FIREBASE_SERVICE_ACCOUNT (the service-account JSON,
// set as an env var in Vercel — never committed to the repo). When it is
// missing or invalid, verification returns null and the social route
// answers 503 instead of crashing.

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

function getAdminApp(): App | null {
  if (getApps().length > 0) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const serviceAccount = JSON.parse(raw);
    return initializeApp({ credential: cert(serviceAccount) });
  } catch (error) {
    console.error("FIREBASE_SERVICE_ACCOUNT is not valid JSON:", error);
    return null;
  }
}

export function isFirebaseAdminConfigured(): boolean {
  return getAdminApp() !== null;
}

/** Verify a Firebase ID token. Returns the decoded token, or null. */
export async function verifyFirebaseIdToken(
  idToken: string
): Promise<DecodedIdToken | null> {
  const app = getAdminApp();
  if (!app) return null;
  try {
    return await getAuth(app).verifyIdToken(idToken);
  } catch (error) {
    console.error("Firebase ID token verification failed:", error);
    return null;
  }
}
