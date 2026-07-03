/**
 * Pocket Empire v5.1 — dispatcher.js
 * Stack: Zod
 * Role: Teeno channels (Telegram, Queue, Cron) ko KV registry se route karna.
 *
 * YAH FILE DOBARA KABHI EDIT NAHI HOGI.
 *
 * KV Registry structure (PE_KV key: "registry"):
 * {
 *   "RUN": "run.js",              ← Telegram prefix
 *   "CRO": "cron.js",             ← Cron prefix
 *   "pe-collector": "market.js",  ← Queue name
 *   "pe-processor": "ai.js",      ← Queue name
 *   "pe-publisher": "publisher.js" ← Queue name
 * }
 *
 * Register karne ka format (/newf1 command):
 *   Telegram : /newf1_run.js=RUN
 *   Queue    : /newf1_market.js=pe-collector
 *   Cron     : /newf1_cron.js=CRO
 */

import { z } from "zod";

// ── Zod: /newf1 format validate karne ke liye ───────────────
const NewFileSchema = z.string().regex(
  /^\/newf1_[a-zA-Z0-9_\-]+\.js=[a-zA-Z0-9_\-]{2,30}$/,
  "Sahi format: /newf1_filename.js=KEY"
);

// ── KV se registry padhna ───────────────────────────────────
async function getRegistry(env) {
  try {
    const raw = await env.PE_KV.get("registry");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.log("PE-DP-ERR-001: KV read failed", e.message);
    return null;
  }
}

// ── KV mein registry save karna ─────────────────────────────
async function saveRegistry(env, registry) {
  await env.PE_KV.put("registry", JSON.stringify(registry));
}

// ── File ka handle() call karna ─────────────────────────────
async function callFile(env, fileName, payload) {
  try {
    const module = await import(`./${fileName}`);
    await module.handle(env, payload);
  } catch (err) {
    console.log(`PE-DP-ERR-099: ${fileName} call failed`, err.message);
    await tgReport(env,
      `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nFile: ${fileName}\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// 1. TELEGRAM dispatch (index.js fetch handler yahi call karta hai)
// ════════════════════════════════════════════════════════════
export async function dispatch(env, { chatId, text, body }) {
  try {
    // /newf1 special command
    if (text.startsWith("/newf1")) {
      return await registerNewFile(env, text);
    }

    // Prefix nikalo (pehle 3 letters)
    const prefix = text.replace(/^\//, "").slice(0, 3).toUpperCase();
    console.log("PE-DP-001: Telegram prefix", prefix);

    const registry = await getRegistry(env);
    if (!registry) {
      await tgReport(env, `🚨 *Dispatcher ERROR* [PE-DP-ERR-001]\nKV read failed`);
      return;
    }

    if (!registry[prefix]) {
      console.log("PE-DP-ERR-002: No file for prefix", prefix);
      await tgReport(env,
        `🛑 *Dispatcher Rejected* [PE-DP-ERR-002]\nKoi file registered nahi: "${prefix}"\nCommand: ${text}`
      );
      return;
    }

    console.log("PE-DP-002: Forwarding to", registry[prefix]);
    await callFile(env, registry[prefix], { chatId, text, body });

  } catch (err) {
    console.log("PE-DP-ERR-099: Telegram dispatch exception", err.message);
    await tgReport(env,
      `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// 2. QUEUE dispatch (index.js queue handler yahi call karta hai)
// ════════════════════════════════════════════════════════════
export async function dispatchQueue(batch, env) {
  const queueName = batch.queue;
  console.log("PE-DP-010: Queue dispatch", queueName);

  const registry = await getRegistry(env);
  if (!registry) {
    await tgReport(env, `🚨 *Dispatcher ERROR* [PE-DP-ERR-001]\nKV read failed`);
    return;
  }

  if (!registry[queueName]) {
    console.log("PE-DP-ERR-011: No file for queue", queueName);
    await tgReport(env,
      `🛑 *Queue Rejected* [PE-DP-ERR-011]\nKoi file registered nahi queue ke liye: "${queueName}"`
    );
    return;
  }

  console.log("PE-DP-011: Queue forwarding to", registry[queueName]);
  await callFile(env, registry[queueName], { batch });
}

// ════════════════════════════════════════════════════════════
// 3. CRON dispatch (index.js scheduled handler yahi call karta hai)
// ════════════════════════════════════════════════════════════
export async function dispatchCron(env, event) {
  console.log("PE-DP-020: Cron dispatch", event.cron);

  const registry = await getRegistry(env);
  if (!registry) {
    await tgReport(env, `🚨 *Dispatcher ERROR* [PE-DP-ERR-001]\nKV read failed`);
    return;
  }

  // Cron ke liye "CRO" prefix use hoga
  if (!registry["CRO"]) {
    console.log("PE-DP-ERR-021: No file for cron");
    await tgReport(env,
      `🛑 *Cron Rejected* [PE-DP-ERR-021]\nKoi file registered nahi cron ke liye\nRegister: /newf1_cron.js=CRO`
    );
    return;
  }

  console.log("PE-DP-021: Cron forwarding to", registry["CRO"]);
  await callFile(env, registry["CRO"], { cron: event.cron });
}

// ════════════════════════════════════════════════════════════
// /newf1 HANDLER — KV mein nai file register karna
// ════════════════════════════════════════════════════════════
async function registerNewFile(env, text) {
  try {
    const validation = NewFileSchema.safeParse(text);
    if (!validation.success) {
      await tgReport(env,
        `🛑 *Register Failed* [PE-DP-ERR-003]\nGalat format: ${text}\nSahi format: /newf1_filename.js=KEY`
      );
      return;
    }

    const withoutCmd = text.replace("/newf1_", "");
    const [fileName, key] = withoutCmd.split("=");

    const registry = await getRegistry(env) || {};
    registry[key] = fileName;
    await saveRegistry(env, registry);

    console.log("PE-DP-005: Registry updated", registry);
    await tgReport(env,
      `✅ *File Registered* [PE-DP-005]\nFile: ${fileName}\nKey: ${key}\nRegistry: ${JSON.stringify(registry, null, 2)}`
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
