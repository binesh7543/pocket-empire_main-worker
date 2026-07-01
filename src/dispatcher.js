/**
 * Pocket Empire v5.1 — dispatcher.js
 * Stack: Zod
 * Role: Prefix check karo, KV registry dekho, sahi file ko forward karo.
 *
 * YAH FILE SIRF TAB EDIT HOGI JAB:
 *  - Naya system-level command add karna ho (jaise /newf1 jaisa)
 *  - Normal routes sirf KV me add hote hain, yahan code nahi badhta
 *
 * KV Structure (PE_KV):
 *  Key: "registry"
 *  Value: { "RUN": "run.js", "SET": "settings.js", ... }
 */

import { z } from "zod";

const NewFileSchema = z.string().regex(
  /^\/newf1_[a-zA-Z0-9_\-]+\.js=[A-Z]{2,6}$/,
  "Format galat hai. Sahi format: /newf1_filename.js=PREFIX"
);

// ── Main dispatch (index.js yahi call karta hai) ────────────
export async function dispatch(env, { chatId, text, body }) {
  return await _process(env, { chatId, text, body });
}

// ── Background processing ───────────────────────────────────
async function _process(env, { chatId, text, body }) {
  try {
    // STEP 1: /newf1 special command
    if (text.startsWith("/newf1")) {
      return await registerNewFile(env, text);
    }

    // STEP 2: Prefix nikalo
    const prefix = text.replace(/^\//, "").slice(0, 3).toUpperCase();
    console.log("PE-DP-001: Prefix extracted", prefix);

    // STEP 3: KV se registry padho
    let registry = {};
    try {
      const raw = await env.PE_KV.get("registry");
      registry = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.log("PE-DP-ERR-001: KV read failed", e.message);
      await tgReport(env,
        `🚨 *Dispatcher ERROR* [PE-DP-ERR-001]\nKV registry read failed\nError: ${e.message}`
      );
      return;
    }

    console.log("PE-DP-002: Registry loaded", registry);

    // STEP 4: Prefix match hai?
    if (!registry[prefix]) {
      console.log("PE-DP-ERR-002: No file for prefix", prefix);
      await tgReport(env,
        `🛑 *Dispatcher Rejected* [PE-DP-ERR-002]\nKoi file registered nahi: "${prefix}"\nCommand: ${text}`
      );
      return;
    }

    // STEP 5: File ko forward karo
    const targetFile = registry[prefix];
    console.log("PE-DP-003: Forwarding to", targetFile);
    const module = await import(`./${targetFile}`);
    await module.handle(env, { chatId, text, body });

  } catch (err) {
    console.log("PE-DP-ERR-099: Exception", err.message);
    await tgReport(env,
      `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nError: ${err.message}`
    );
  }
}

// ── /newf1 handler ──────────────────────────────────────────
async function registerNewFile(env, text) {
  try {
    const validation = NewFileSchema.safeParse(text);
    if (!validation.success) {
      await tgReport(env,
        `🛑 *Register Failed* [PE-DP-ERR-003]\nGalat format: ${text}\nSahi format: /newf1_filename.js=PREFIX`
      );
      return;
    }

    const withoutCmd = text.replace("/newf1_", "");
    const [fileName, prefix] = withoutCmd.split("=");

    let registry = {};
    try {
      const raw = await env.PE_KV.get("registry");
      registry = raw ? JSON.parse(raw) : {};
    } catch (_) {}

    registry[prefix] = fileName;
    await env.PE_KV.put("registry", JSON.stringify(registry));

    console.log("PE-DP-005: Registry updated", registry);
    await tgReport(env,
      `✅ *File Registered* [PE-DP-005]\nFile: ${fileName}\nPrefix: ${prefix}\nRegistry: ${JSON.stringify(registry)}`
    );

  } catch (err) {
    console.log("PE-DP-ERR-098: Register exception", err.message);
    await tgReport(env,
      `🚨 *Register ERROR* [PE-DP-ERR-098]\nError: ${err.message}`
    );
  }
}

// ── Telegram report helper ──────────────────────────────────
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
    console.log("PE-DP-TG-ERR:", e.message);
  }
      }
