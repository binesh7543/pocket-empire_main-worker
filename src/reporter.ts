/**
 * ==========================================================
 * Pocket Empire - Reporter v3 (Self‑healing)
 * ----------------------------------------------------------
 * Purpose:
 *   Send notifications to Telegram. If `env` is not passed,
 *   it automatically fetches from globalThis.__ENV (set in
 *   the entry file). This makes it robust against callers
 *   forgetting to pass env.
 * ==========================================================
 */

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

/**
 * Sends a message to Telegram.
 * @param payload - string or JSON-serializable object
 * @param env - optional, if not provided, uses globalThis.__ENV
 * @returns Telegram API response or { ok: false, error: string }
 */
export async function reporter(payload: unknown, env?: Env): Promise<any> {
  // ---------------------------------------------------------
  // 1. ENV – पहले parameter, फिर global fallback
  // ---------------------------------------------------------
  let resolvedEnv = env;
  if (!resolvedEnv) {
    // Try to get from global (set by entry file)
    const globalEnv = (globalThis as any).__ENV as Env | undefined;
    if (globalEnv) {
      resolvedEnv = globalEnv;
      console.warn("⚠️ reporter: env not passed, using globalThis.__ENV");
    } else {
      // No env at all – log error and return gracefully, don't throw
      const errorMsg =
        "❌ reporter: No env provided and no globalThis.__ENV found. " +
        "Please set globalThis.__ENV in your entry file or pass env explicitly.";
      console.error(errorMsg);
      return { ok: false, error: errorMsg };
    }
  }

  // ---------------------------------------------------------
  // 2. Validate required fields
  // ---------------------------------------------------------
  if (!resolvedEnv.TELEGRAM_BOT_TOKEN) {
    const err = "❌ reporter: TELEGRAM_BOT_TOKEN missing in env";
    console.error(err);
    return { ok: false, error: err };
  }
  if (!resolvedEnv.TELEGRAM_CHAT_ID) {
    const err = "❌ reporter: TELEGRAM_CHAT_ID missing in env";
    console.error(err);
    return { ok: false, error: err };
  }

  // ---------------------------------------------------------
  // 3. Prepare message
  // ---------------------------------------------------------
  let message: string;
  if (typeof payload === "string") {
    message = payload;
  } else {
    try {
      message = JSON.stringify(payload, null, 2);
    } catch {
      message = String(payload);
    }
  }

  // ---------------------------------------------------------
  // 4. Send to Telegram
  // ---------------------------------------------------------
  const url = `https://api.telegram.org/bot${resolvedEnv.TELEGRAM_BOT_TOKEN}/sendMessage`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: resolvedEnv.TELEGRAM_CHAT_ID,
        text: message,
      }),
    });
  } catch (fetchError: any) {
    const err = `❌ reporter: Network error - ${fetchError?.message ?? String(fetchError)}`;
    console.error(err);
    return { ok: false, error: err };
  }

  if (!response.ok) {
    let errorBody = "";
    try {
      errorBody = await response.text();
    } catch {
      errorBody = "Unable to read response body";
    }
    const err = `❌ reporter: Telegram API HTTP ${response.status} - ${errorBody}`;
    console.error(err);
    return { ok: false, error: err };
  }

  // Success
  try {
    return await response.json();
  } catch {
    const text = await response.text();
    const err = `❌ reporter: Invalid JSON response - ${text}`;
    console.error(err);
    return { ok: false, error: err };
  }
}
