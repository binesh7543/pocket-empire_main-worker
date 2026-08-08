    /**
 * ============================================================
 *  POCKET EMPIRE — DISPATCHER (dispatcher.ts)
 *  Version : 0.0.2
 *  Role    : Abhi ke liye bilkul simple — jo message Telegram
 *            se aaya, wahi seedha Telegram ko wapas bhej deta
 *            hai (echo). Baad mein yahi function real routing
 *            logic (topic decision engine etc.) handle karega.
 * ============================================================
 */

import type { Env } from "./index";

export interface DispatchArgs {
  payload: any;
  env: Env;
  ctx: ExecutionContext;
}

export async function dispatch({ payload, env }: DispatchArgs): Promise<void> {
  try {
    // ----------------------------------------------------
    // 🔹 STEP 1 — Telegram update se chat_id nikaalo
    // ----------------------------------------------------
    const chatId = payload?.message?.chat?.id;

    if (!chatId) {
      console.log("PE-DISPATCH: skip — chat_id missing", payload);
      return;
    }

    // ----------------------------------------------------
    // 🔹 STEP 2 — Sirf ADMIN chat ko hi reply karo
    //    (env.TELEGRAM_CHAT_ID se match hona chahiye)
    // ----------------------------------------------------
    if (!env.TELEGRAM_CHAT_ID || String(chatId) !== String(env.TELEGRAM_CHAT_ID)) {
      console.log("PE-DISPATCH: skip — chat_id admin se match nahi", chatId);
      return;
    }

    // ----------------------------------------------------
    // 🔹 STEP 3 — FUTURE: yahan asli routing/logic aayega
    //    (topic decision, mode select, etc.)
    // ----------------------------------------------------

    // Abhi: raw JSON seedha bhej do (koi formatting nahi)
    const raw = JSON.stringify(payload, null, 2);
    const text = "```json\n" + raw + "\n```";
    await sendTelegram(env, chatId, text);
  } catch (err) {
    console.error("PE-DISPATCH-ERR:", err);
    // 🔜 FUTURE: env.TELEGRAM_BOT_TOKEN se error alert bhi bhej sakte hain
  }
}

// ========================================================
// 🔧 Helper — Telegram ko message bhejna
// ========================================================

async function sendTelegram(env: Env, chatId: number, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.log("PE-DISPATCH: TELEGRAM_BOT_TOKEN missing, skip send");
    return;
  }

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}
