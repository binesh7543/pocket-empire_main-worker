/**
 * ==========================================================
 * Pocket Empire - Reporter v1
 * ----------------------------------------------------------
 * Purpose:
 *   Receive reporting payload and send it to Telegram.
 *
 * Environment:
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_CHAT_ID
 *
 * No hardcoded values.
 * ==========================================================
 */

export async function reporter(payload, env) {

  // -------------------------
  // Environment Validation
  // -------------------------
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error("Missing TELEGRAM_CHAT_ID");
  }

  // -------------------------
  // Message
  // -------------------------
  const message =
    typeof payload === "string"
      ? payload
      : JSON.stringify(payload, null, 2);

  // -------------------------
  // Telegram API
  // -------------------------
  const url =
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  // -------------------------
  // Send
  // -------------------------
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message
    })
  });

  if (!response.ok) {
    throw new Error(
      `Telegram Error : ${response.status}`
    );
  }

  return await response.json();
}
