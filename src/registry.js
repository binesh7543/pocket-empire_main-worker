/**
 * Pocket Empire v5.1 — registry.js
 * Role: Saari handler files ka STATIC import + trigger mapping.
 *
 * NAYA FILE ADD KARNE KE 3 STEPS:
 *   1. Naya file banao with: export function handle(env, payload) {...}
 *   2. Yahan top pe ek import line add karo
 *   3. FILE_MAP aur TRIGGERS mein ek-ek entry add karo
 * Redeploy karo — done. dispatcher.js ko chhedna nahi padega.
 */

// ── STATIC IMPORTS ────────────────────────────────────────────
// Path us file ke actual location ka hai (registry.js se relative).
import { handle as handleRun } from "./run/run.js";
// import { handle as handleWeeklyBrief } from "./weekly-brief.js";
// import { handle as handleDeepDive }    from "./deep-dive.js";
// import { handle as handleResearchBot } from "./research-bot.js";
// import { handle as handleCron }        from "./cron.js";
// import { handle as handleAi }          from "./ai.js";
// import { handle as handlePublisher }   from "./publisher.js";

// ── FILENAME → FUNCTION ──────────────────────────────────────
export const FILE_MAP = {
  "run.js": handleRun,
  // "weekly-brief.js": handleWeeklyBrief,
  // "deep-dive.js":    handleDeepDive,
  // "research-bot.js": handleResearchBot,
  // "cron.js":         handleCron,
  // "ai.js":           handleAi,
  // "publisher.js":    handlePublisher,
};

// ── TRIGGER → FILENAME ───────────────────────────────────────
export const TRIGGERS = {
  RUN: "run.js",
  "pe-collector": "run.js",
  // WEE: "weekly-brief.js",
  // DEE: "deep-dive.js",
  // RES: "research-bot.js",
  // CRO: "cron.js",
  // "pe-processor": "ai.js",
  // "pe-publisher": "publisher.js",
};
