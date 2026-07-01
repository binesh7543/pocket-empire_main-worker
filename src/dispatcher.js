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
 *
 * ENV VARS REQUIRED:
 *  - TELEGRAM_BOT_TOKEN
 *  - TELEGRAM_CHAT_ID
 *  - PE_KV (KV namespace binding)
 */

import { z } from "zod";

// ── Zod: /newf1 command format validate karne ke liye ───────
// Format: /newf1_run.js=RUN
const NewFileSchema = z.string().regex(
  /^\/newf1_[a-zA-Z0-9_\-]+\.js=[A-Z]{2,6}$/,
  "Format galat hai. Sahi format: /newf1_filename.js=PREFIX"
);

// ── Main dispatch function (index.js yahi call karta hai) ───
export async function dispatch(c, env, { chatId, text, body }) {
  try {
    // ── STEP 1: /newf1 command check (special system command) ──
    if (text.startsWith("/newf1")) {
      return await registerNewFile(c, env, text);
    }

    // ── STEP 2: Prefix nikalo (pehle 3 letters, slash hata ke) ─
    const cleanText = text.replace(/^\//, "").toUpperCase();
    const prefix = cleanText.slice(0, 3);

    console.log("PE-DP-001: Prefix extracted", prefix);

    // ── STEP 3: KV se registry padho ───────────────────────────
    let registry = {};
    try {
      const raw = await env.PE_KV.get("registry");
      registry = raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.log("PE-DP-ERR-001: KV read failed", e.message);
      await tgReport(env,
        `🚨 *Dispatcher ERROR* [PE-DP-ERR-001]\nKV registry read failed\nError: ${e.message}`
      );
      return c.json({ success: false, code: "PE-DP-ERR-001" }, 500);
    }

    console.log("PE-DP-002: Registry loaded", registry);

    // ── STEP 4: Prefix registry me hai ya nahi ─────────────────
    if (!registry[prefix]) {
      console.log("PE-DP-ERR-002: No file registered for prefix", prefix);
      await tgReport(env,
        `🛑 *Dispatcher Rejected* [PE-DP-ERR-002]\nKoi file registered nahi hai prefix ke liye: "${prefix}"\nCommand: ${text}`
      );
      return c.json({ success: false, code: "PE-DP-ERR-002", error: "No file registered for this prefix" }, 400);
    }

    // ── STEP 5: Registered file ko forward karo ────────────────
    const targetFile = registry[prefix];
    console.log("PE-DP-003: Forwarding to", targetFile);

    const module = await import(`./${targetFile}`);
    const result = await module.handle(c.req.raw, env, c.executionCtx, { chatId, text, body });

    return c.json({ success: true, route: prefix, result }, 200);

  } catch (err) {
    console.log("PE-DP-ERR-099: Dispatcher exception", err.message);
    await tgReport(env,
      `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nError: ${err.message}`
    );
    return c.json({ success: false, code: "PE-DP-ERR-099", error: err.message }, 500);
  }
}

// ── /newf1 handler: KV me nai file register karo ───────────
async function registerNewFile(c, env, text) {
  try {
    // Format validate karo
    const validation = NewFileSchema.safeParse(text);
    if (!validation.success) {
      console.log("PE-DP-ERR-003: Invalid /newf1 format", text);
      await tgReport(env,
        `🛑 *Register Failed* [PE-DP-ERR-003]\nGalat format: ${text}\nSahi format: /newf1_filename.js=PREFIX`
      );
      return c.json({ success: false, code: "PE-DP-ERR-003", error: "Invalid format" }, 400);
    }

    // Parse: /newf1_run.js=RUN → { file: "run.js", prefix: "RUN" }
    const withoutCmd = text.replace("/newf1_", "");
    const [fileName, prefix] = withoutCmd.split("=");

    console.log("PE-DP-004: Registering new file", { fileName, prefix });

    // KV se current registry padho
    let registry = {};
    try {
      const raw = await env.PE_KV.get("registry");
      registry = raw ? JSON.parse(raw) : {};
    } catch (_) {}

    // Naya entry add karo
    registry[prefix] = fileName;

    // KV me save karo
    await env.PE_KV.put("registry", JSON.stringify(registry));

    console.log("PE-DP-005: Registry updated", registry);

    await tgReport(env,
      `✅ *File Registered* [PE-DP-005]\nFile: ${fileName}\nPrefix: ${prefix}\nRegistry: ${JSON.stringify(registry)}`
    );

    return c.json({ success: true, code: "PE-DP-005", registered: { prefix, fileName } }, 200);

  } catch (err) {
    console.log("PE-DP-ERR-098: Register exception", err.message);
    await tgReport(env,
      `🚨 *Register ERROR* [PE-DP-ERR-098]\nError: ${err.message}`
    );
    return c.json({ success: false, code: "PE-DP-ERR-098", error: err.message }, 500);
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
