/**
 * ============================================================
 *  POCKET EMPIRE — REPORTER (reporter.ts)
 *  Version : 0.0.1
 *  Role    : Zero-effort passthrough. Jo bhi message milega,
 *            usko wahi ka wahi (bina kisi formatting ke)
 *            Telegram pe bhej dega. chat_id aur bot_token
 *            env se uthaata hai. Bas itna hi kaam.
 * ============================================================
 */

import type { Env } from "./index";

export async function report(env: Env, message: string): Promise<void> {
  const chatId = env.TELEGRAM_CHAT_ID;
  const botToken = env.TELEGRAM_BOT_TOKEN;

  if (!chatId || !botToken) {
    console.log("PE-REPORTER: skip — chat_id/bot_token env mein missing");
    return;
  }

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });
}

