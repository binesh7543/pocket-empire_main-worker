/**
 * Pocket Empire v5.1 — dispatcher.js (v3 — static registry + reporter.js)
 * Role: Teeno channels (Telegram, Queue, Cron) ko FIXED mapping se route karna.
 *
 * CHANGE LOG:
 * - Registry ab KV se nahi, is file ke andar hardcoded hai (REGISTRY object).
 *   Naya file add karna ho to seedha yahan entry add karo aur redeploy.
 * - Reporting ab src/reporter.js se direct call hoti hai (single channel,
 *   koi queue nahi). Reporter khud decide karega Telegram ko kaise bhejna hai.
 */

import { reporter } from "./reporter.js";

// reporter.js ka signature (payload, env) hai aur woh throw karta hai —
// yeh wrapper order match karta hai aur error ko catch karta hai taaki
// Telegram fail hone pe dispatcher crash na ho.
async function report(env, message) {
  return reporter(message, env).catch((e) =>
    console.log("PE-DP-REPORT-ERR:", e.message)
  );
}

// ════════════════════════════════════════════════════════════
// FIXED REGISTRY — yahan edit karo naya file register karne ke liye
// ════════════════════════════════════════════════════════════
const REGISTRY = {
  RUN: "daily-trigger.js",
  WEE: "weekly-brief.js",
  DEE: "deep-dive.js",
  RES: "research-bot.js",
  CRO: "cron.js",
  "pe-collector": "run.js",
  "pe-processor": "ai.js",
  "pe-publisher": "publisher.js",
};

function getFileByTrigger(trigger) {
  return REGISTRY[trigger] || null;
}

// ── File ka handle() call karna ─────────────────────────────
async function callFile(env, fileName, payload) {
  try {
    const module = await import(`./${fileName}`);
    await module.handle(env, payload);
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

    if (!getFileByTrigger(prefix)) {
      console.log("PE-DP-ERR-002: No file for prefix", prefix);
      await report(env,
        `🛑 *Dispatcher Rejected* [PE-DP-ERR-002]\nKoi file registered nahi: "${prefix}"\nCommand: ${text}`
      );
      return;
    }

    console.log("PE-DP-002: Forwarding to", getFileByTrigger(prefix));
    await callFile(env, getFileByTrigger(prefix), { chatId, text, body });

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

  if (!getFileByTrigger(queueName)) {
    console.log("PE-DP-ERR-011: No file for queue", queueName);
    await report(env,
      `🛑 *Queue Rejected* [PE-DP-ERR-011]\nKoi file registered nahi queue ke liye: "${queueName}"`
    );
    return;
  }

  console.log("PE-DP-011: Queue forwarding to", getFileByTrigger(queueName));
  await callFile(env, getFileByTrigger(queueName), { batch });
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
