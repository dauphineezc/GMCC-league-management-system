import { adminAuth } from "@/lib/firebaseAdmin";

export const UNVERIFIED_EMAIL_MESSAGE =
  "That account hasn't verified its email address yet. Ask them to open Account Settings and send a verification email, then try again.";

/**
 * Admin roles are granted by email, so the account must prove it owns that
 * address; otherwise anyone could pre-register an admin's email and inherit the role.
 */
export async function hasVerifiedEmail(uid: string): Promise<boolean> {
  try {
    const user = await adminAuth.getUser(uid);
    return user.emailVerified === true;
  } catch {
    return false;
  }
}
