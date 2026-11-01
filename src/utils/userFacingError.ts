import { auth } from "../../FirebaseConfig";

const DEFAULT_USER_ERROR =
  "Something went wrong. Please try again in a moment.";
const BACKEND_URL = String(process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(
  /\/+$/,
  ""
);

const redactDiagnosticText = (value: string) =>
  value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(
      /\b(password|token|secret|authorization)\s*[:=]\s*[^\s,;]+/gi,
      "$1=[redacted]"
    )
    .replace(
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      "[email]"
    )
    .replace(/\b(?:\+?63|0)9\d{9}\b/g, "[phone]")
    .replace(/https?:\/\/\S+/gi, "[url]")
    .slice(0, 1200);

async function reportTechnicalError(error: unknown, context: string) {
  const user = auth.currentUser;
  if (!BACKEND_URL || !user) return;

  try {
    const token = await user.getIdToken();
    const technicalError =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown error");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(`${BACKEND_URL}/client-errors`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context: redactDiagnosticText(context),
          name: redactDiagnosticText(technicalError.name),
          code: redactDiagnosticText(
            String((technicalError as Error & { code?: unknown }).code || "")
          ),
          message: redactDiagnosticText(technicalError.message),
          stack: redactDiagnosticText(technicalError.stack || ""),
        }),
      });

      if (!response.ok) {
        console.warn("Could not send diagnostic report:", response.status);
      }
    } finally {
      clearTimeout(timeout);
    }
  } catch (reportError) {
    console.warn("Could not send diagnostic report:", reportError);
  }
}

export function getUserFriendlyErrorMessage(
  error: unknown,
  context: string,
  fallback = DEFAULT_USER_ERROR
): string {
  console.log(`[${context}]`, error);
  void reportTechnicalError(error, context);
  return fallback;
}
