/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.2
 *  Role    : Telegram webhook ko TURANT 200 OK deta hai
 *            (warna Telegram retry karta rahega), phir
 *            background mein (waitUntil) dispatcher.ts ko
 *            payload pass kar deta hai.
 * ============================================================
 */

import { dispatch } from "./dispatcher";

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  // 🔽 FUTURE BINDINGS
  // PE_COLLECTOR: Queue;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // ----------------------------------------------------
    // 🔹 STEP 1 — Payload padho (safe)
    // ----------------------------------------------------
    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    // ----------------------------------------------------
    // 🔹 STEP 2a — Raw JSON seedha Telegram ko reflect karo
    //    (jo bhi data aaya, waisa ka waisa — koi formatting nahi)
    // ----------------------------------------------------
    ctx.waitUntil(sendRawJson(env, payload));

    // ----------------------------------------------------
    // 🔹 STEP 2b — Background mein dispatcher ko bhi bhejo
    //    (formatted detail ke liye)
    // ----------------------------------------------------
    ctx.waitUntil(dispatch({ payload, env, ctx }));

    // ----------------------------------------------------
    // 🔹 STEP 3 — Telegram ko turant OK
    // ----------------------------------------------------
    return new Response("OK", { status: 200 });
  },

  // ----------------------------------------------------
  // 🔹 Queue consumer — STUB (abhi sirf ack karta hai)
  //    wrangler.toml mein queues already bound hain, isliye
  //    handler zaroori hai warna deploy fail hota hai.
  //    Real processing logic FUTURE mein yahan aayega.
  // ----------------------------------------------------
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`PE-QUEUE[${batch.queue}]: received`, msg.body);
      msg.ack();
    }
  },

  // 🔜 FUTURE — scheduled(event, env, ctx) → cron
};

// ========================================================
// 🔧 Helper — Raw incoming JSON ko seedha Telegram pe reflect karo
//    (koi formatting nahi, jaisa data aaya waisa hi dikha do)
// ========================================================
async function sendRawJson(env: Env, payload: any): Promise<void> {
  const chatId = payload?.message?.chat?.id;
  if (!chatId || !env.TELEGRAM_BOT_TOKEN) return;

  const raw = JSON.stringify(payload, null, 2);
  const text = "```json\n" + raw + "\n```";

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}
