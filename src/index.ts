/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.4
 *
 *  Role:
 *    1) Telegram Webhook se message aaye → turant 200 OK do
 *       (Telegram retry loop se bachne ke liye)
 *    2) Dispatcher ko call karne se PEHLE, khud hi seedha
 *       Telegram API par ek message bhej do (env se
 *       TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID uthakar)
 *    3) Fir us message ko background mein (waitUntil)
 *       dispatcher.ts ko pass kar do
 *    4) Cron trigger chale to bhi wahi ek dispatcher ko call karo
 *
 *  NOTE: Pehle rule tha ki index.ts ke andar koi logging/reporting
 *  nahi hoga — ab explicitly requested feature ke wajah se ek
 *  direct Telegram send yahan add kiya gaya hai. Baaki poora
 *  logging + reporting ka kaam ab bhi dispatcher.ts + reporter.ts
 *  ke andar hi hota hai.
 * ============================================================
 */

import { dispatch } from "./dispatcher";

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // 🔽 FUTURE BINDINGS — jaise-jaise use honge, yahan declare karo
  // DB: D1Database;
  // AI: Ai;
  // PE_KV: KVNamespace;
  // PE_REPORTER: Queue;
  // PE_COLLECTOR: Queue;
  // PE_PROCESSOR: Queue;
  // PE_PUBLISHER: Queue;
  // RSS_FEED_URL: string;
}

// ------------------------------------------------------
// 🔹 Helper — seedha Telegram Bot API ko message bhejta hai
// ------------------------------------------------------
async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("PE-INDEX: TELEGRAM_BOT_TOKEN ya TELEGRAM_CHAT_ID missing, message skip kiya");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.log("PE-INDEX: Telegram message bhejne mein error", err);
  }
}

export default {
  // ------------------------------------------------------
  // 🔹 1) Telegram Webhook entry (HTTP POST)
  // ------------------------------------------------------
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    // Env se Telegram credentials nikal ke full JSON banao
    const fullData = {
      source: "webhook",
      payload,
      telegram: {
        botToken: env.TELEGRAM_BOT_TOKEN ?? null,
        chatId: env.TELEGRAM_CHAT_ID ?? null,
      },
      env,
      ctx,
    };

    // Dispatcher ko chhodane se PEHLE, khud hi Telegram par message bhej do
    ctx.waitUntil(sendTelegramMessage(env, "PE-INDEX: Webhook received ✅"));

    // Message ko background mein dispatcher ko de do, wait mat karo
    ctx.waitUntil(dispatch(fullData));

    // Telegram ko turant OK — asli kaam background mein chalega
    return new Response("OK", { status: 200 });
  },

  // ------------------------------------------------------
  // 🔹 2) Cron trigger — usi dispatcher ko call karega
  // ------------------------------------------------------
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const fullData = {
      source: "cron",
      payload: event,
      telegram: {
        botToken: env.TELEGRAM_BOT_TOKEN ?? null,
        chatId: env.TELEGRAM_CHAT_ID ?? null,
      },
      env,
      ctx,
    };

    // Dispatcher ko chhodane se PEHLE, khud hi Telegram par message bhej do
    ctx.waitUntil(sendTelegramMessage(env, "PE-INDEX: Cron triggered ✅"));

    ctx.waitUntil(dispatch(fullData));
  },

  // ------------------------------------------------------
  // 🔹 3) Queue consumer — STUB (wrangler.toml mein bound hai,
  //    isliye handler zaroori hai warna deploy fail hota hai).
  //    Real queue processing logic FUTURE mein yahan/dispatcher
  //    mein add hoga.
  // ------------------------------------------------------
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`PE-QUEUE[${batch.queue}]: received`, msg.body);
      msg.ack();
    }
  },
};
