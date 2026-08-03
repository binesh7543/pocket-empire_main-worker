// index.ts – Minimal webhook handler for Cloudflare Workers

export interface Env {
  // Add your environment variables here (optional for now)
  // e.g., PROFILE_A_URL, PROFILE_A_API_KEY, etc.
}

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
async function dispatcher(message: any, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Dispatching message:', message);

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

  // 🔜 FUTURE — scheduled(event, env, ctx) → cron
  // 🔜 FUTURE — queue(batch, env, ctx) → queue consumer
};
