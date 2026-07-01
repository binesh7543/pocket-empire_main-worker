/**
 * Pocket Empire v5.1 — index.js
 * Stack: Hono.js + Zod
 * Role: SIRF chat ID gate + dispatcher ko forward karna.
 *
 * YAH FILE KABHI EDIT NAHI HOGI.
 * Naya route/file add karna ho to sirf dispatcher.js me karo.
 *
 * ENV VARS REQUIRED:
 *  - TELEGRAM_CHAT_ID   : authorized chat ID
 *  - TELEGRAM_BOT_TOKEN : gate-level error report ke liye
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

app.post("/", async (c) => {
  const env = c.env;
  let chatId = null;

  let body = {};
  try {
    body = await c.req.json();
  } catch (_) {}

  const parsed = TelegramSchema.safeParse(body);

  // Always return 200 fast (STOP TELEGRAM RETRIES)
  c.executionCtx.waitUntil(process(env, parsed, body));

  return c.json({ ok: true }, 200);
});

// ───────────────────────────────────────────────
// Background processing
// ───────────────────────────────────────────────
async function process(env, parsed, body) {
  try {
    if (!parsed.success || !parsed.data?.message) {
      return;
    }

    const chatId = parsed.data.message.chat.id.toString();
    const text = parsed.data.message.text.trim();

    const AUTH = env.TELEGRAM_CHAT_ID;
    const WELCOME_URL = env.WELCOME_URL;

    // ── AUTHORIZED USER ───────────────────────
    if (chatId === AUTH) {
      return dispatch({ executionCtx: env }, env, {
        chatId,
        text,
        body,
      });
    }

    // ── UNAUTHORIZED USER ─────────────────────
    const key = `unauth:${chatId}`;
    const alreadySeen = await env.PE_KV.get(key);

    if (!alreadySeen) {
      // first time only
      await env.PE_KV.put(key, "1");

      await sendTelegram(env, chatId,
        `👋 Welcome!\n\nHere is your access link:\n${WELCOME_URL}`
      );
    }

    // after this: DO NOTHING (silent drop)

  } catch (err) {
    console.log("PE-GW-ERR:", err.message);
  }
}

// ───────────────────────────────────────────────
// Telegram sender
// ───────────────────────────────────────────────
async function sendTelegram(env, chatId, message) {
  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
        }),
      }
    );
  } catch (e) {
    console.log("TG SEND ERROR:", e.message);
  }
}

export default {
  async fetch(req, env, ctx) {
    return app.fetch(req, env, ctx);
  },
};
