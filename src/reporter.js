/**
 * ==========================================================
 * Pocket Empire - Reporter v2 (TypeScript)
 * ----------------------------------------------------------
 * Purpose:
 *   Receive reporting payload and send it to Telegram.
 * Environment:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 * No hardcoded values.
 * ==========================================================
 */

// Define the expected environment interface
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

/**
 * Sends a message to Telegram using the provided payload and environment variables.
 * 
 * @param payload - Can be a string or any JSON-serializable object.
 * @param env - The environment object containing TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.
 * @returns The JSON response from Telegram API.
 * @throws Will throw a detailed error if:
 *  - `env` is missing,
 *  - required env vars are missing,
 *  - Telegram API returns a non-OK response,
 *  - network errors occur,
 *  - response is not valid JSON.
 */
export async function reporter(payload: unknown, env?: Env): Promise<any> {
  // ---------------------------------------------------------
  // 1. Bulletproof Parameter Checking
  // ---------------------------------------------------------
  if (!env) {
    const error = new Error(
      "⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n" +
      "- Called function did not provide mandatory parameter [env].\n" +
      "- Status: Message sending failed."
    );
    // The stack trace helps identify which file called reporter without env
    throw error;
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error(
      "⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n" +
      "- Called function did not provide mandatory parameter [TELEGRAM_BOT_TOKEN].\n" +
      "- Status: Message sending failed."
    );
  }

  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error(
      "⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n" +
      "- Called function did not provide mandatory parameter [TELEGRAM_CHAT_ID].\n" +
      "- Status: Message sending failed."
    );
  }

  // ---------------------------------------------------------
  // 2. Message Formatting (supports string or object)
  // ---------------------------------------------------------
  let message: string;
  if (typeof payload === "string") {
    message = payload;
  } else {
    try {
      message = JSON.stringify(payload, null, 2);
    } catch {
      // Fallback if payload cannot be stringified
      message = String(payload);
    }
  }

  // ---------------------------------------------------------
  // 3. Prepare Telegram API Request
  // ---------------------------------------------------------
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
      }),
    });
  } catch (fetchError: any) {
    // Network or low‑level fetch errors
    throw new Error(
      `⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n` +
      `- Network error or failed to reach Telegram API.\n` +
      `- Error details: ${fetchError?.message ?? String(fetchError)}`
    );
  }

  // ---------------------------------------------------------
  // 4. Detailed Telegram API Error Handling
  // ---------------------------------------------------------
  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "Unable to read response body";
    }
    throw new Error(
      `⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n` +
      `- Telegram API returned HTTP ${response.status}.\n` +
      `- Error body: ${errorBody}`
    );
  }

  // ---------------------------------------------------------
  // 5. Parse and Return JSON Response
  // ---------------------------------------------------------
  try {
    return await response.json();
  } catch {
    // In case Telegram returns non‑JSON (should not happen, but defensive)
    const text = await response.text();
    throw new Error(
      `⚠️ Pocket Empire Reporter (reporter.ts) Error Report:\n` +
      `- Telegram API response was not valid JSON.\n` +
      `- Response text: ${text}`
    );
  }
}
