/**
 * Pocket Empire v5.1 — dispatcher.js (v4 — static registry.js, no dynamic import)
 * Role: Teeno channels (Telegram, Queue, Cron) ko route karna.
 *
 * YAH FILE AB STABLE HAI — naya file add karne ke liye registry.js
 * edit karo, is file ko chhedne ki zaroorat nahi.
 */

import { FILE_MAP, TRIGGERS } from "./registry.js";
import { reporter } from "./reporter.js";

// reporter.js ka signature (payload, env) hai aur woh throw karta hai —
// yeh wrapper order match karta hai aur error ko catch karta hai taaki
// Telegram fail hone pe dispatcher crash na ho.
async function report(env, message) {
  return reporter(message, env).catch((e) =>
    console.log("PE-DP-REPORT-ERR:", e.message)
  );
}

function getFileByTrigger(trigger) {
  return TRIGGERS[trigger] || null;
}

// ── File ka handler call karna (static lookup, koi dynamic import nahi) ──
async function callFile(env, fileName, payload) {
  const handler = FILE_MAP[fileName];
  if (!handler) {
    console.log(`PE-DP-ERR-099: No handler for ${fileName}`);
    await report(env, `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nNo handler registered: ${fileName}`);
    return;
  }
  try {
    await handler(env, payload);
  } catch (err) {
    console.log(`PE-DP-ERR-099: ${fileName} call failed`, err.message);
    await report(env,
      `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nFile: ${fileName}\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// 1. TELEGRAM dispatch
// ════════════════════════════════════════════════════════════
export async function dispatch(env, { chatId, text, body }) {
  try {
    const prefix = text.replace(/^\//, "").slice(0, 3).toUpperCase();
    console.log("PE-DP-001: Telegram prefix", prefix);

    const file = getFileByTrigger(prefix);
    if (!file) {
      console.log("PE-DP-ERR-002: No file for prefix", prefix);
      await report(env,
        `🛑 *Dispatcher Rejected* [PE-DP-ERR-002]\nKoi file registered nahi: "${prefix}"\nCommand: ${text}`
      );
      return;
    }

    console.log("PE-DP-002: Forwarding to", file);
    await callFile(env, file, { chatId, text, body });

  } catch (err) {
    console.log("PE-DP-ERR-099: Telegram dispatch exception", err.message);
    await report(env, `🚨 *Dispatcher ERROR* [PE-DP-ERR-099]\nError: ${err.message}`);
  }
}

// ════════════════════════════════════════════════════════════
// 2. QUEUE dispatch
// ════════════════════════════════════════════════════════════
export async function dispatchQueue(batch, env) {
  const queueName = batch.queue;
  console.log("PE-DP-010: Queue dispatch", queueName);

  const file = getFileByTrigger(queueName);
  if (!file) {
    console.log("PE-DP-ERR-011: No file for queue", queueName);
    await report(env,
      `🛑 *Queue Rejected* [PE-DP-ERR-011]\nKoi file registered nahi queue ke liye: "${queueName}"`
    );
    return;
  }

  console.log("PE-DP-011: Queue forwarding to", file);
  await callFile(env, file, { batch });
}

// ════════════════════════════════════════════════════════════
// 3. CRON dispatch
// ════════════════════════════════════════════════════════════
export async function dispatchCron(env, { trigger, cron }) {
  console.log("PE-DP-020: Cron dispatch", trigger);

  const file = getFileByTrigger(trigger);
  if (!file) {
    console.log("PE-DP-ERR-021: No file for trigger", trigger);
    await report(env, `🛑 *Cron Rejected* [PE-DP-ERR-021]\nTrigger registered nahi: "${trigger}"`);
    return;
  }

  console.log("PE-DP-021: Cron forwarding to", file);
  await callFile(env, file, { cron });
}
