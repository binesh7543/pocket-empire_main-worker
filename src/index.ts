/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.3
 *
 *  Role (sirf 3 kaam, aur kuch NAHI):
 *    1) Telegram Webhook se message aaye → turant 200 OK do
 *       (Telegram retry loop se bachne ke liye)
 *    2) Us message ko background mein (waitUntil) dispatcher.ts
 *       ko pass kar do
 *    3) Cron trigger chale to bhi wahi ek dispatcher ko call karo
 *
 *  RULE: Is file ke andar Telegram ko seedha koi message NAHI
 *  jaayega. Sending/reporting ka kaam sirf dispatcher.ts +
 *  reporter.ts karte hain. index.ts sirf "traffic director" hai.
 * ============================================================
 */

import { dispatch } from "./dispatcher";
import { report } from "./reporter";

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

    // Background mein: dispatcher ko kaam do, phir apna status report karo
    ctx.waitUntil(handleWebhook(payload, env, ctx));

    // Telegram ko turant OK — asli kaam background mein chalega
    return new Response("OK", { status: 200 });
  },

  // ------------------------------------------------------
  // 🔹 2) Cron trigger — usi dispatcher ko call karega
  // ------------------------------------------------------
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(dispatch({ source: "cron", payload: event, env, ctx }));
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

// ========================================================
// 🔧 Helper — dispatcher ko kaam do, phir APNA khud ka
//    status reporter ko bolo (exact file name ke saath)
// ========================================================
async function handleWebhook(payload: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
  try {
    await dispatch({ source: "webhook", payload, env, ctx });

    const data = { file: "index.ts", source: "webhook", payload };
    console.log("PE-INDEX:", JSON.stringify(data));
    await report(env, JSON.stringify(data, null, 2));
  } catch (err) {
    const data = { file: "index.ts", source: "webhook", error: String(err) };
    console.error("PE-INDEX-ERROR:", JSON.stringify(data));
    await report(env, JSON.stringify(data, null, 2));
  }
}
