// Email verification for new accounts.
import { reload, sendEmailVerification } from "firebase/auth";
import { auth } from "../../FirebaseConfig";

const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

// Asks the backend to send the branded verification email. Returns false when
// the backend is unavailable so the caller can fall back to Firebase's own email.
const sendViaBackend = async (fullName?: string): Promise<boolean> => {
  if (!BACKEND_URL) return false;

  const user = auth.currentUser;
  if (!user) return false;

  const token = await user.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BACKEND_URL}/auth/send-verification`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fullName: (fullName || "").trim() }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) return false;

    if (data.alreadyVerified) {
      await reload(user);
      return true;
    }

    return data.sent === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

// Sends a new verification link using only the email address, so a user whose
// registration was interrupted can still finish without signing in again.
export const resendVerificationByEmail = async (
  email: string
): Promise<{
  sent: boolean;
  alreadyVerified?: boolean;
  exists?: boolean;
}> => {
  if (!BACKEND_URL) return { sent: false };
  const trimmed = email.trim();
  if (!trimmed) return { sent: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${BACKEND_URL}/auth/resend-verification`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { sent: false };
    if (data.success === false && !data.alreadyVerified && data.exists !== false) {
      return { sent: false };
    }
    return {
      sent: data.sent === true,
      alreadyVerified: data.alreadyVerified === true,
      exists: data.exists !== false,
    };
  } catch {
    return { sent: false };
  } finally {
    clearTimeout(timer);
  }
};

// Sends the verification email to the signed-in user, or reports that the
// address is already verified.
export const sendBrandedVerificationEmail = async (
  fullName?: string
): Promise<{
  alreadyVerified: boolean;
}> => {
  const user = auth.currentUser;

  if (!user) {
    const error: any = new Error("No signed-in user to verify.");
    error.code = "auth/no-current-user";
    throw error;
  }

  // Skipping the reload before sending avoids an extra auth call. The status
  // is checked later by the verify button.
  if (user.emailVerified) {
    return { alreadyVerified: true };
  }

  // Firebase sends the email directly, which is faster than the backend route.
  await sendEmailVerification(user);

  return { alreadyVerified: false };
};
