/**
 * Pocket Empire v5.2 — index.js
 * Stack: Hono.js + Zod
 * Role: Telegram webhook receive → 200 OK immediately → background processing.
 */

import { Hono } from "hono";
import { z } from "zod";
import { dispatch } from "./dispatcher.js";

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

app.post("/", async (c) => {
  const env = c.env;

  // Body sirf ek baar read karo
  let body = {};
  try {
    body = await c.req.json();
  } catch (_) {}

  // Telegram ko turant OK de do
  c.executionCtx.waitUntil(processWebhook(c, env, body));

  return new Response("OK", {
    status: 200,
    headers: {
      "Content-Type": "text/plain",
    },
  });
});

// ── Background Processing ───────────────────────────────────
async function processWebhook(c, env, body) {
  let chatId = null;

  try {
    // ── STEP 1: Parse + Validate ───────────────────────────
    const parsed = TelegramSchema.safeParse(body);

    if (!parsed.success || !parsed.data.message) {
      console.log("PE-GW-ERR-000: Invalid payload");

      await tgReport(
        env,
        "🛑 *Gate Rejected* [PE-GW-ERR-000]\nInvalid payload structure"
      );

      return;
    }

    chatId = parsed.data.message.chat.id.toString();
    const text = parsed.data.message.text.trim();

    console.log("PE-GW-001: Incoming", {
      chatId,
      text,
    });

    // ── STEP 2: Chat ID Gate ───────────────────────────────
    if (chatId !== env.TELEGRAM_CHAT_ID) {
      console.log("PE-GW-ERR-001: Unauthorized chat ID", chatId);

      await tgReport(
        env,
        `🛑 *Gate Rejected* [PE-GW-ERR-001]
Unauthorized Chat ID: ${chatId}
Message: ${text}`
      );

      return;
    }

    // ── STEP 3: Dispatcher ────────────────────────────────
    console.log("PE-GW-002: Chat ID OK, forwarding to dispatcher");

    await dispatch(c, env, {
      chatId,
      text,
      body,
    });

  } catch (err) {
    console.log("PE-GW-ERR-099: Gate exception", err.message);

    await tgReport(
      env,
      `🚨 *Gateway ERROR* [PE-GW-ERR-099]
Chat ID: ${chatId || "N/A"}
Error: ${err.message}`
    );
  }
  // ── Export ──────────────────────────────────────────────────
export default {
  // Telegram Webhook
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },

  // Queue placeholder
  async queue(batch, env) {
    console.log("PE-QU-000: Queue batch received, no handler yet", {
      queue: batch.queue,
      size: batch.messages.length,
    });

    // Future:
    // const { handleQueue } = await import("./queue.js");
    // await handleQueue(batch, env);
  },
};

// ── Gate-level Telegram report ──────────────────────────────
async function tgReport(env, message) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      return;
    }

    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "Markdown",
        }),
      }
    );

  } catch (e) {
    console.log("PE-GW-TG-ERR:", e.message);
  }
}
}
