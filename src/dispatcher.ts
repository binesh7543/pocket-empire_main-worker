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
  const status = {
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

    console.log(`PE-DISPATCH-OK [${source}]`, status);
    await report(env, `✅ dispatcher.ts: kaam khatam [${source}]\n${JSON.stringify(status, null, 2)}`);
  } catch (err) {
    console.error(`PE-DISPATCH-ERROR [${source}]`, err);
    await report(env, `❌ dispatcher.ts: error [${source}] — ${String(err)}\n${JSON.stringify(status, null, 2)}`);
  }
}
