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
    // 🔹 STEP 2 — FUTURE: yahan asli routing/logic aayega
    //    (topic decision, mode select, etc.)
    // ----------------------------------------------------

    // Abhi: poora update detail formatted karke wapas bhejo
    const detail = formatUpdateDetail(payload);
    await sendTelegram(env, chatId, detail);
  } catch (err) {
    console.error("PE-DISPATCH-ERR:", err);
    // 🔜 FUTURE: env.TELEGRAM_BOT_TOKEN se error alert bhi bhej sakte hain
  }
}

// ========================================================
// 🔧 Helper — Incoming Telegram update ko readable banao
// ========================================================

function formatUpdateDetail(payload: any): string {
  const msg = payload?.message;
  if (!msg) {
    return `⚠️ Update mila lekin 'message' field nahi hai:\n${JSON.stringify(payload)}`;
  }

  const from = msg.from ?? {};
  const chat = msg.chat ?? {};
  const dateStr = msg.date
    ? new Date(msg.date * 1000).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : "-";

  return [
    "📩 *Naya Message Detail*",
    "",
    `🆔 Update ID: ${payload.update_id ?? "-"}`,
    `💬 Message ID: ${msg.message_id ?? "-"}`,
    `👤 From: ${from.first_name ?? "-"} ${from.last_name ?? ""} (@${from.username ?? "-"})`,
    `🔢 User ID: ${from.id ?? "-"}`,
    `🗨️ Chat ID: ${chat.id ?? "-"} (${chat.type ?? "-"})`,
    `📅 Date: ${dateStr}`,
    "",
    `📝 Text:\n${msg.text ?? "(no text)"}`,
  ].join("\n");
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

