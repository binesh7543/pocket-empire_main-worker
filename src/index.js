/**
 * Pocket Empire v5.1 — index.js
 * Stack: Hono.js + Zod
 * Role: Telegram webhook gate + dispatcher forward + queue support fix
 *
 * IMPORTANT:
 * - This file is ENTRY POINT ONLY
 * - Business logic is in dispatcher.js
 */

import { Hono } from "hono";
import { z } from "zod";
import { dispatch } from "./dispatcher.js";

// ─────────────────────────────────────────────
// Telegram payload validation schema
// ─────────────────────────────────────────────
const TelegramSchema = z.object({
  message: z.object({
    chat: z.object({
      id: z.union([z.string(), z.number()]),
    }),
    text: z.string().min(1),
  }).optional(),
});

const app = new Hono();

/**
 * ─────────────────────────────────────────────
 * MAIN WEBHOOK ENTRY
 * ─────────────────────────────────────────────
 * Telegram hits this endpoint
 * We ALWAYS return 200 immediately to stop retry loop
 */
app.post("/", async (c) => {
  const env = c.env;

  let body = {};
  try {
    body = await c.req.json();
  } catch (_) {
    body = {};
  }

  const parsed = TelegramSchema.safeParse(body);

  /**
   * IMPORTANT:
   * Telegram retry STOP = immediate 200 OK
   * Actual processing moved to background
   */
  c.executionCtx.waitUntil(process(env, parsed, body));

  return c.json({ ok: true }, 200);
});

/**
 * ─────────────────────────────────────────────
 * BACKGROUND PROCESSOR
 * ─────────────────────────────────────────────
 * Runs after response already sent to Telegram
 */
async function process(env, parsed, body) {
  try {
    // invalid payload ignore
    if (!parsed.success || !parsed.data?.message) return;

    const chatId = parsed.data.message.chat.id.toString();
    const text = parsed.data.message.text.trim();

    console.log("PE-GW-001 Incoming:", { chatId, text });

    // ─────────────────────────────
    // AUTHORIZED CHAT FLOW
    // ─────────────────────────────
    if (chatId === env.TELEGRAM_CHAT_ID) {
      return dispatch(
        { executionCtx: env },
        env,
        { chatId, text, body }
      );
    }

    // ─────────────────────────────
    // UNAUTHORIZED FLOW (silent drop or future welcome)
    // ─────────────────────────────
    const key = `unauth:${chatId}`;

    const alreadySeen = await env.PE_KV.get(key);

    if (!alreadySeen) {
      await env.PE_KV.put(key, "1");

      await sendTelegram(env, chatId,
        `👋 Welcome!\n\nYou are not authorized yet.`
      );
    }

    // after first message → do nothing (silent ignore)

  } catch (err) {
    console.log("PE-GW-ERR:", err.message);
  }
}

/**
 * ─────────────────────────────────────────────
 * TELEGRAM MESSAGE SENDER
 * ─────────────────────────────────────────────
 */
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

/**
 * ─────────────────────────────────────────────
 * EXPORT (Cloudflare Worker entry + QUEUE FIX)
 * ─────────────────────────────────────────────
 */
export default {
  /**
   * HTTP ENTRYPOINT (Telegram webhook)
   */
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  /**
   * ─────────────────────────────────────────────
   * QUEUE CONSUMER (FIXED - REQUIRED BY CLOUDFLARE)
   * ─────────────────────────────────────────────
   * Without this, deploy FAILS (your error)
   */
  async queue(batch, env, ctx) {
    ctx.waitUntil(handleQueue(batch, env));
  },
};

/**
 * ─────────────────────────────────────────────
 * QUEUE HANDLER
 * ─────────────────────────────────────────────
 * Future PE_PROCESSOR / PE_COLLECTOR logic goes here
 */
async function handleQueue(batch, env) {
  console.log("PE-QU-000 Queue received:", {
    queue: batch.queue,
    size: batch.messages.length,
  });

  for (const msg of batch.messages) {
    try {
      const data = msg.body;

      console.log("PE-QU-001 Processing:", data);

      // TODO:
      // Future:
      // - PE_PROCESSOR logic
      // - dispatcher async jobs

      msg.ack();
    } catch (err) {
      console.log("PE-QU-ERR:", err.message);
      // Cloudflare auto retry handles it
    }
  }
}
