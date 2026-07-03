/**
 * Pocket Empire v5.1 — index.js
 * Stack: Hono.js + Zod
 * Role: SIRF entry point — gate + forward. Koi logic nahi.
 *
 * YAH FILE DOBARA KABHI EDIT NAHI HOGI.
 *
 * 3 channels handle karta hai:
 *  1. fetch    → Telegram webhook
 *  2. queue    → Queue messages
 *  3. scheduled → Cron triggers
 *
 * Teeno ke liye sirf dispatcher.js ko call karta hai.
 */

import { Hono } from "hono";
import { z } from "zod";
import { dispatch, dispatchQueue, dispatchCron } from "./dispatcher.js";

// ── Zod Schema ──────────────────────────────────────────────
const TelegramSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.union([z.string(), z.number()]),
    }),
    text: z.string().min(1),
  }).optional(),
});

const app = new Hono();

// Dono routes — webhook reset na karna pade
app.post("/", handleWebhook);
app.post("/telegram/webhook", handleWebhook);

// ── 1. TELEGRAM WEBHOOK ─────────────────────────────────────
async function handleWebhook(c) {
  const env = c.env;

  let body = {};
  try { body = await c.req.json(); } catch (_) {}

  const parsed = TelegramSchema.safeParse(body);

  // Turant 200 OK — Telegram retry BAND
  c.executionCtx.waitUntil(_processTelegram(env, parsed, body));
  return c.json({ ok: true }, 200);
}

async function _processTelegram(env, parsed, body) {
  try {
    if (!parsed.success || !parsed.data?.message) return;

    const chatId = parsed.data.message.chat.id.toString();
    const text = parsed.data.message.text.trim();

    console.log("PE-GW-001: Incoming", { chatId, text });

    // Chat ID gate
    if (chatId !== env.TELEGRAM_CHAT_ID) {
      console.log("PE-GW-ERR-001: Unauthorized", chatId);
      await tgReport(env,
        `🛑 *Gate Rejected* [PE-GW-ERR-001]\nUnauthorized Chat ID: ${chatId}\nMessage: ${text}`
      );
      return;
    }

    console.log("PE-GW-002: Authorized, dispatching");
    await dispatch(env, { chatId, text, body });

  } catch (err) {
    console.log("PE-GW-ERR-099:", err.message);
    await tgReport(env,
      `🚨 *Gateway ERROR* [PE-GW-ERR-099]\nError: ${err.message}`
    );
  }
}

// ── Telegram sender ─────────────────────────────────────────
async function tgReport(env, message) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "Markdown",
      }),
    });
  } catch (e) {
    console.log("PE-GW-TG-ERR:", e.message);
  }
}

// ── EXPORT ──────────────────────────────────────────────────
export default {
  // 1. Telegram webhook
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  // 2. Queue messages → dispatcher
  async queue(batch, env) {
    console.log("PE-QU-000: Queue received", {
      queue: batch.queue,
      size: batch.messages.length,
    });
    await dispatchQueue(batch, env);
  },

  // 3. Cron trigger → dispatcher
  async scheduled(event, env, ctx) {
    console.log("PE-CR-000: Cron triggered", event.cron);
    ctx.waitUntil(dispatchCron(env, event));
  },
};
