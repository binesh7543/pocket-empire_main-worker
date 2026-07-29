/**
 * ==========================================================
 * Pocket Empire - Reporter v4 (Strict Parameters, No Crashes)
 * ----------------------------------------------------------
 * PURPOSE:
 *   Send notifications to Telegram. This function is designed
 *   to be called with explicit `env` parameter (no global hacks).
 *   If parameters are missing, it logs errors and returns a
 *   safe response object – it NEVER throws, so the worker
 *   remains stable.
 *
 * ENVIRONMENT:
 *   The `env` object MUST contain:
 *     - TELEGRAM_BOT_TOKEN (string)
 *     - TELEGRAM_CHAT_ID   (string)
 *
 *   This `env` is typically passed from the caller (e.g., 
 *   dispatcher.js or run.js) which receives it from the 
 *   Cloudflare Worker's fetch/scheduled handler.
 *
 * MESSAGE TYPES:
 *   The `payload` parameter can be:
 *     - string: plain text message
 *     - any JSON-serializable object: will be stringified
 *       with indentation for readability.
 *
 * LOG PREFIXES:
 *   This module uses "PE-REP-" prefixes for its logs to
 *   distinguish from other modules (PE-GW-, PE-DP-, etc.).
 *   All logs are written via console.log/console.error.
 *
 * RETURN VALUE:
 *   Always returns a plain object:
 *     On success: { ok: true, result: <Telegram API response> }
 *     On failure: { ok: false, error: "description" }
 *
 * ==========================================================
 */

// Define the expected environment interface
export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

/**
 * Sends a message to Telegram.
 *
 * @param payload - The message content (string or object)
 * @param env - The environment object (required) containing
 *              TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
 * @returns Promise<{ ok: boolean; result?: any; error?: string }>
 */
export async function reporter(
  payload: unknown,
  env: Env
): Promise<{ ok: boolean; result?: any; error?: string }> {
  // ---------------------------------------------------------
  // 1. Strict Parameter Validation (no env → log & return)
  // ---------------------------------------------------------
  if (!env) {
    const msg = "PE-REP-001: env parameter is missing or undefined";
    console.error(msg);
    return { ok: false, error: msg };
  }

  if (!env.TELEGRAM_BOT_TOKEN) {
    const msg = "PE-REP-002: TELEGRAM_BOT_TOKEN is missing in env";
    console.error(msg);
    return { ok: false, error: msg };
  }

  if (!env.TELEGRAM_CHAT_ID) {
    const msg = "PE-REP-003: TELEGRAM_CHAT_ID is missing in env";
    console.error(msg);
    return { ok: false, error: msg };
  }

  // ---------------------------------------------------------
  // 2. Prepare the message text from the payload
  // ---------------------------------------------------------
  let message: string;
  if (typeof payload === "string") {
    message = payload;
  } else {
    try {
      message = JSON.stringify(payload, null, 2);
    } catch (stringifyError) {
      // Fallback to String() if JSON.stringify fails
      message = String(payload);
      console.warn("PE-REP-004: Payload stringify failed, using String()", stringifyError);
    }
  }

  // ---------------------------------------------------------
  // 3. Build Telegram API URL
  // ---------------------------------------------------------
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  // ---------------------------------------------------------
  // 4. Send the request with try-catch for network errors
  // ---------------------------------------------------------
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
    const msg = `PE-REP-005: Network error while calling Telegram API: ${fetchError?.message ?? String(fetchError)}`;
    console.error(msg);
    return { ok: false, error: msg };
  }

  // ---------------------------------------------------------
  // 5. Handle HTTP error status (non-2xx) – read error body
  // ---------------------------------------------------------
  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "Unable to read response body";
    }
    const msg = `PE-REP-006: Telegram API returned HTTP ${response.status} - ${errorBody}`;
    console.error(msg);
    return { ok: false, error: msg };
  }

  // ---------------------------------------------------------
  // 6. Parse JSON response – catch parsing errors
  // ---------------------------------------------------------
  let parsed: any;
  try {
    parsed = await response.json();
  } catch (jsonError: any) {
    // If response is not JSON, read as text for debugging
    let text = "";
    try {
      text = await response.text();
    } catch {
      text = "Unable to read response text";
    }
    const msg = `PE-REP-007: Invalid JSON response from Telegram: ${text}`;
    console.error(msg);
    return { ok: false, error: msg };
  }

  // ---------------------------------------------------------
  // 7. Success: return the parsed result
  // ---------------------------------------------------------
  console.log("PE-REP-008: Message sent successfully to Telegram");
  return { ok: true, result: parsed };
}
