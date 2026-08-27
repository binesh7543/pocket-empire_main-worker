/**
 * ============================================================
 *  POCKET EMPIRE — RUN HANDLER (run.ts)
 *  Version : 0.0.1
 *
 *  Role (abhi ke liye sirf ek hi kaam):
 *    dispatcher.ts se "run" command match hone ke baad jo
 *    message mila, usko Telegram par report kar do.
 *
 *  Aage jaake yahan actual "run" logic add hoga — abhi ke liye
 *  koi processing nahi, sirf confirmation report.
 * ============================================================
 */

import type { Env } from "../index";

// ------------------------------------------------------
// 🔹 Helper — seedha Telegram Bot API ko message bhejta hai
// ------------------------------------------------------
async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("PE-RUN: TELEGRAM_BOT_TOKEN ya TELEGRAM_CHAT_ID missing");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.log("PE-RUN: Telegram message bhejne mein error", err);
  }
}

export async function run(message: string, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log("PE-RUN: command received", message);

  await sendTelegramMessage(env, `✅ RUN command received\n\n"${message}"`);
}

