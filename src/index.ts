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
    // 🔹 STEP 2 — Background mein dispatcher ko bhej do,
    //    response ka wait kiye bina
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
