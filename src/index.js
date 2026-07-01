/**
 * Pocket Empire v5.1 — index.js
 * Stack: Hono.js + Zod
 * Role: SIRF gate + turant 200 OK + background process
 *
 * YAH FILE KABHI EDIT NAHI HOGI.
 */

import { Hono } from "hono";
import { z } from "zod";
import { dispatch } from "./dispatcher.js";

const TelegramSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.union([z.string(), z.number()]),
    }),
    text: z.string().min(1),
  }).optional(),
});

const app = new Hono();

// Dono routes handle karo — webhook reset na karna pade
app.post("/", handleWebhook);
app.post("/telegram/webhook", handleWebhook);

async function handleWebhook(c) {
  const env = c.env;

  let body = {};
  try { body = await c.req.json(); } catch (_) {}

  const parsed = TelegramSchema.safeParse(body);

  // Turant 200 OK — Telegram retry BAND
  c.executionCtx.waitUntil(_process(env, parsed, body));
  return c.json({ ok: true }, 200);
}

async function _process(env, parsed, body) {
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

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
  async queue(batch, env) {
    console.log("PE-QU-000: Queue received", {
      queue: batch.queue,
      size: batch.messages.length,
    });
    for (const msg of batch.messages) {
      try {
        console.log("PE-QU-001: Processing", msg.body);
        msg.ack();
      } catch (err) {
        console.log("PE-QU-ERR:", err.message);
      }
    }
  },
};
