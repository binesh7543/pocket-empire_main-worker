/**
 * ============================================================
 *  POCKET EMPIRE — DISPATCHER (dispatcher.ts)
 *  Version : 0.0.1
 *
 *  Role (abhi ke liye sirf ek hi kaam):
 *    1) index.ts se aaye data ke andar se sirf
 *       body → message.text nikalo.
 *    2) Uske pehle 3 characters check karo — agar "run" hai
 *       (case-insensitive) to run.ts ko poora message pass
 *       kar do.
 *    3) Match nahi hua (matlab sirf normal comment/text hai)
 *       to Telegram ko ek chhota alert bhej do.
 *
 *  RULE: Abhi ke liye is file ke andar koi aur logic/function
 *  nahi hai. Aage jaake har command ke liye alag file add hogi.
 * ============================================================
 */

import type { Env } from "./index";
import { run } from "./run/run";

interface DispatchInput {
  source: string;
  headers: Record<string, string>;
  body: string;
  payload: unknown;
  env: Env;
  ctx: ExecutionContext;
}

// ------------------------------------------------------
// 🔹 Helper — seedha Telegram Bot API ko message bhejta hai
// ------------------------------------------------------
async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("PE-DISPATCHER: TELEGRAM_BOT_TOKEN ya TELEGRAM_CHAT_ID missing");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.log("PE-DISPATCHER: Telegram message bhejne mein error", err);
  }
}

export async function dispatch(data: DispatchInput): Promise<void> {
  const payload = data.payload as { message?: { text?: string } } | null;
  const text = payload?.message?.text;

  console.log("PE-DISPATCHER: received", { source: data.source, text });

  // Text hi nahi mila (koi message.text field nahi)
  if (!text) {
    await sendTelegramMessage(data.env, "⚠️ Command match nahi hua (message.text nahi mila)");
    return;
  }

  const firstThree = text.slice(0, 3).toLowerCase();

  if (firstThree === "run") {
    await run(text, data.env, data.ctx);
  } else {
    await sendTelegramMessage(data.env, `⚠️ Command match nahi hua (only comment)\n\n"${text}"`);
  }
}
