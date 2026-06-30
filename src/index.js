/**
 * Pocket Empire - Gateway Worker (index.js)
 * Stack: Hono.js (routing/middleware) + Zod (validation)
 * Role: SIRF gate + router. Yahan koi processing logic NAHI hai.
 *
 * Flow:
 *  1. Zod se incoming Telegram payload ka structure validate karna
 *  2. Chat ID check (sirf authorized Telegram chat se aaya message pass hoga)
 *  3. Command me se pehla 3-letter prefix nikalna (jaise /run001 -> "RUN")
 *  4. ROUTES list me dekhna kaun si file isko handle karegi
 *  5. Us file ko poora context forward kar dena - processing aur
 *     success/error reporting us file ki zimmedari hai.
 *
 * ENV VARS REQUIRED:
 *  - TELEGRAM_CHAT_ID  : sirf isi chat ID se aaya message accept hoga
 *  - TELEGRAM_BOT_TOKEN: sirf gate-level reject/error report ke liye
 */

import { Hono } from "hono";
import { z } from "zod";

// ============================================================
// ZOD SCHEMA - Telegram webhook payload ka minimum structure
// ============================================================
const TelegramUpdateSchema = z.object({
  message: z
    .object({
      chat: z.object({
        id: z.union([z.string(), z.number()]),
      }),
      text: z.string().min(1),
    })
    .optional(),
});

// ============================================================
// ROUTES MAP - naya category add karna ho to bas ek line
// ============================================================
const ROUTES = {
  RUN: () => import("./run.js"),
  // SET: () => import("./settings.js"),
  // LOG: () => import("./logs.js"),
};

const app = new Hono();

app.post("/", async (c) => {
  const env = c.env;
  let chatId = null;
  let text = null;
  let prefix = null;

  try {
    // ---------- STEP 1: BODY PARSE + ZOD VALIDATION ----------
    let rawBody = {};
    try {
      rawBody = await c.req.json();
    } catch (e) {
      rawBody = {};
    }

    const parsed = TelegramUpdateSchema.safeParse(rawBody);

    if (!parsed.success || !parsed.data.message) {
      console.log("PE-GW-001: Zod validation failed", parsed.success ? "no message" : parsed.error?.message);
      await reportToTelegram(
        env,
        `🛑 *Gate Rejected* [PE-GW-ERR-000]\nInvalid payload structure (Zod validation failed)`
      );
      return c.json({ success: false, code: "PE-GW-ERR-000", error: "Invalid payload structure" }, 400);
    }

    chatId = parsed.data.message.chat.id.toString();
    text = parsed.data.message.text.trim();

    console.log("PE-GW-002: Incoming message", { chatId, text });

    // ---------- STEP 2: CHAT ID GATE (sabke liye common, ek hi jagah) ----------
    if (!chatId || chatId !== env.TELEGRAM_CHAT_ID) {
      console.log("PE-GW-003: Chat ID rejected", chatId);
      await reportToTelegram(
        env,
        `🛑 *Gate Rejected* [PE-GW-ERR-001]\nUnauthorized chat ID: ${chatId || "N/A"}\nMessage: ${text || "N/A"}`
      );
      return c.json({ success: false, code: "PE-GW-ERR-001", error: "Unauthorized chat ID" }, 401);
    }

    // ---------- STEP 3: COMMAND PREFIX NIKALNA ----------
    // "/run001 topic text" -> prefix = "RUN"
    const cleanText = text.replace(/^\//, "");
    prefix = cleanText.slice(0, 3).toUpperCase();

    console.log("PE-GW-004: Prefix extracted", prefix);

    if (!prefix || !ROUTES[prefix]) {
      console.log("PE-GW-005: Unknown route", prefix);
      await reportToTelegram(
        env,
        `🛑 *Gate Rejected* [PE-GW-ERR-002]\nUnknown command prefix: "${prefix || "N/A"}"\nFull text: ${text}`
      );
      return c.json({ success: false, code: "PE-GW-ERR-002", error: "Unknown command prefix" }, 400);
    }

    // ---------- STEP 4: FORWARD TO TARGET FILE ----------
    console.log("PE-GW-006: Forwarding to handler for prefix", prefix);

    const module = await ROUTES[prefix]();
    // Har target file ka apna exported "handle" function hoga
    // jo poora context khud sambhalega (processing + apna Telegram report)
    const result = await module.handle(c.req.raw, env, c.executionCtx, { chatId, text, body: rawBody });

    // NOTE: Success/Error ka Telegram report ab target file (jaise run.js)
    // ki zimmedari hai, index.js dobara report nahi karega.
    return c.json({ success: true, route: prefix, result }, 200);
  } catch (err) {
    // ---------- GATE-LEVEL ERROR ----------
    console.log("PE-GW-ERR-099: Exception at gate", err.message);
    await reportToTelegram(
      c.env,
      `🚨 *Gateway ERROR* [PE-GW-ERR-099]\nPrefix: ${prefix || "N/A"}\nChat ID: ${chatId || "N/A"}\nError: ${err.message}`
    );
    return c.json({ success: false, code: "PE-GW-ERR-099", error: err.message }, 500);
  }
});

export default app;

/**
 * Sirf gate-level reject/error ke liye. Target files (run.js, etc.)
 * apna khud ka success/error report khud karenge.
 */
async function reportToTelegram(env, message) {
  try {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      console.log("PE-GW-TG-SKIP: Telegram env vars missing");
      return;
    }
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
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
