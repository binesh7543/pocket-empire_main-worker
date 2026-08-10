/**
 * ============================================================
 *  POCKET EMPIRE — DISPATCHER (dispatcher.ts)
 *  Version : 0.0.1
 *
 *  Role: index.ts se (webhook ya cron se) event receive karta
 *  hai. Abhi ke liye sirf 2 cheezein track karta hai:
 *    1) message_received — kya payload mila
 *    2) message_passed   — kya aage process ho gaya
 *  Dono status ko ek object mein daal ke reporter.ts ko de deta
 *  hai, jo Telegram pe bhej deta hai.
 *
 *  FUTURE: STEP 2 (neeche marked) mein asli routing/logic aayega
 *  — topic decision engine, mode select, RSS fetch, AI content
 *  generation, etc. Abhi sirf pass-through/status-check hai.
 * ============================================================
 */

import type { Env } from "./index";
import { report } from "./reporter";

export interface DispatchArgs {
  source: "webhook" | "cron";
  payload: unknown;
  env: Env;
  ctx: ExecutionContext;
}

export async function dispatch({ source, payload, env }: DispatchArgs): Promise<void> {
  const requestId = (payload as any)?.update_id ?? "unknown";
  const chatId = (payload as any)?.message?.chat?.id;

  // ----------------------------------------------------
  // 🔹 STEP 0 — Sabse pehle: chat ID authorize check
  //    (sirf webhook messages pe apply hota hai; cron ke
  //    paas chat ID hota hi nahi, isliye skip)
  // ----------------------------------------------------
  if (source === "webhook") {
    const isAuthorized = !!env.TELEGRAM_CHAT_ID && String(chatId) === String(env.TELEGRAM_CHAT_ID);

    if (!isAuthorized) {
      const entry = logEvent("warn", "dispatcher.ts", requestId, "Unauthorized message");
      await report(env, JSON.stringify(entry, null, 2));
      return; // yahin ruk jao — aage koi processing nahi
    }
  }

  const status = {
    source,
    message_received: false,
    message_passed: false,
  };

  try {
    // ----------------------------------------------------
    // 🔹 STEP 1 — Message receive hua ki nahi
    // ----------------------------------------------------
    status.message_received = payload !== null && payload !== undefined;

    // ----------------------------------------------------
    // 🔹 STEP 2 — FUTURE: asli routing/logic yahan aayega
    //    (topic decision, mode select, RSS/AI pipeline, etc.)
    // ----------------------------------------------------

    // Abhi ke liye: yahan tak pahuncha matlab pass ho gaya
    status.message_passed = true;

    const entry = logEvent("info", "dispatcher.ts", requestId, status);
    await report(env, JSON.stringify(entry, null, 2));
  } catch (err) {
    const entry = logEvent("error", "dispatcher.ts", requestId, { ...status, error: String(err) });
    await report(env, JSON.stringify(entry, null, 2));
  }
}

// ========================================================
// 🔧 Helper — Standard structured log (index.ts jaisa hi)
//    level: "info"  → normal kaam ho gaya
//    level: "warn"  → kuch ajeeb hua lekin crash nahi hua
//    level: "error" → kuch fail ho gaya
// ========================================================
type LogLevel = "info" | "warn" | "error";

function logEvent(level: LogLevel, file: string, requestId: unknown, data: unknown) {
  const entry = {
    level,
    file,
    request_id: requestId,
    timestamp: new Date().toISOString(),
    data,
  };

  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }

  return entry;
}
