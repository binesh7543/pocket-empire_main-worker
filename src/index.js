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
  let chatId = null;

  try {
    // ── STEP 1: Parse + Zod validate ──────────────────────
    let body = {};
    try { body = await c.req.json(); } catch (_) {}

    const parsed = TelegramSchema.safeParse(body);

    if (!parsed.success || !parsed.data.message) {
      console.log("PE-GW-ERR-000: Invalid payload");
      await tgReport(env, "🛑 *Gate Rejected* [PE-GW-ERR-000]\nInvalid payload structure");
      return c.json({ success: false, code: "PE-GW-ERR-000" }, 400);
    }

    chatId = parsed.data.message.chat.id.toString();
    const text = parsed.data.message.text.trim();

    console.log("PE-GW-001: Incoming", { chatId, text });

    // ── STEP 2: Chat ID Gate ───────────────────────────────
    if (chatId !== env.TELEGRAM_CHAT_ID) {
      console.log("PE-GW-ERR-001: Unauthorized chat ID", chatId);
      await tgReport(env,
        `🛑 *Gate Rejected* [PE-GW-ERR-001]\nUnauthorized Chat ID: ${chatId}\nMessage: ${text}`
      );
      return c.json({ success: false, code: "PE-GW-ERR-001" }, 401);
    }

    // ── STEP 3: dispatcher.js ko forward ──────────────────
    // Index ka kaam yahan khatam. Aage sab dispatcher sambhalega.
    console.log("PE-GW-002: Chat ID OK, forwarding to dispatcher");
    return await dispatch(c, env, { chatId, text, body });

  } catch (err) {
    console.log("PE-GW-ERR-099: Gate exception", err.message);
    await tgReport(env,
      `🚨 *Gateway ERROR* [PE-GW-ERR-099]\nChat ID: ${chatId || "N/A"}\nError: ${err.message}`
    );
    return c.json({ success: false, code: "PE-GW-ERR-099", error: err.message }, 500);
  }
});

export default app;

// ── Gate-level Telegram report (sirf gate errors ke liye) ──
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
