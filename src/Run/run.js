/**
 * ══════════════════════════════════════════════════════════════
 * Pocket Empire v5.1 — run.js
 * ══════════════════════════════════════════════════════════════
 * ROLE: Telegram/Cron se "/run001" jaisa command aata hai, yeh
 * file uska TYPE (001-004) nikaal ke seedha sahi target file ko
 * DIRECT CALL karti hai (koi queue nahi, koi dynamic import nahi).
 *
 * ARCHITECTURE (jo humne discuss kiya):
 *   dispatcher.js  → sirf "RUN" prefix dekh ke is file (run.js) ko
 *                     call karta hai. Dispatcher ko 001/002/003/004
 *                     ka pata nahi hota — yeh generic hai.
 *   run.js (yeh file) → command ke andar se type nikaalta hai,
 *                     aur us type ke hisaab se DAILY/WEEKLY/DEEP-DIVE/
 *                     RESEARCH file ko seedha function-call se bulata hai.
 *
 * PAYLOAD FORMAT jo target file (jaise daily-trigger.js) tak jaata hai:
 *   {
 *     runId: "PE-RUN-run001-20260717-143022",  // unique ID
 *     type: "run001" | "run002" | "run003" | "run004",
 *     topic: "<text>" | null,   // sirf run004 ke liye zaroori
 *     source: "telegram" | "cron",
 *     chatId: "<telegram chat id>" | null,  // cron se aaye to null
 *     triggeredAt: "2026-07-17T14:30:22.000Z", // ISO timestamp
 *   }
 *
 * IMPORT PATH RULE: yeh file jis folder mein hai (jaise src/run/),
 * usi folder ke andar daily-trigger.js/weekly-brief.js/etc honi
 * chahiye — "./filename.js" hamesha CURRENT file ke location se
 * relative hota hai.
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "../reporter.js";

// ─────────────────────────────────────────────────────────────
// TARGET FILES — 4 alag worker files, ek-ek karke ready hote
// jaayenge. Jo file abhi nahi bani, uska import COMMENT rahega —
// warna deploy fail ho jayega (esbuild us file ko dhoondh nahi payega).
//
// JAB NAYI FILE BANE: sirf neeche wali import line ka "//" hatao,
// aur TYPE_MAP mein bhi uski entry se "//" hatao. Bas itna hi.
// ─────────────────────────────────────────────────────────────
import { handle as handleDaily } from "./daily-trigger.js";      // RUN001 — READY
// import { handle as handleWeekly }   from "./weekly-brief.js";   // RUN002 — abhi nahi bana
// import { handle as handleDeepDive } from "./deep-dive.js";      // RUN003 — abhi nahi bana
// import { handle as handleResearch } from "./research-bot.js";   // RUN004 — abhi nahi bana

// type string → target function. Jaise-jaise upar wali files ready
// hongi, yahan bhi unki line uncomment karni hai.
const TYPE_MAP = {
  run001: handleDaily,
  // run002: handleWeekly,
  // run003: handleDeepDive,
  // run004: handleResearch,
};

// ─────────────────────────────────────────────────────────────
// generateRunId — har run ke liye ek unique ID banata hai
// Format: PE-RUN-{type}-{date}-{time}
// Example: PE-RUN-run001-20260717-143022
// ─────────────────────────────────────────────────────────────
function generateRunId(type) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `PE-RUN-${type}-${date}-${time}`;
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER — dispatcher.js sirf isi function ko call karta hai
// Yeh decide karta hai: message Telegram se aaya ya Cron se.
//   - Cron se aaya ho to "cron" field hoga → handleCron() chalega
//   - warna Telegram se aaya maana jaata hai → handleTelegram() chalega
// ═══════════════════════════════════════════════════════════════
export async function handle(env, { chatId, text, body, cron }) {
  const source = cron ? "cron" : "telegram";
  console.log("PE-RUN-001: Received", { source, text, cron });

  if (source === "cron") {
    return await handleCron(env, cron);
  } else {
    return await handleTelegram(env, { chatId, text });
  }
}

// ═══════════════════════════════════════════════════════════════
// TELEGRAM HANDLER — /run001, /run002, /run003, /run004 <topic>
// Kaam: text se regex se type (1-4) aur topic (agar diya ho) nikaalta hai.
//   - Galat command format ho to "Invalid command" reply
//   - run004 mein topic zaroori hai, na ho to reject
//   - sab sahi ho to executeRun() ko aage bhej deta hai
// ═══════════════════════════════════════════════════════════════
async function handleTelegram(env, { chatId, text }) {
  const lower = text.toLowerCase().trim();
  const match = lower.match(/^\/run\s*0*(1|2|3|4)(.*)$/);

  if (!match) {
    console.log("PE-RUN-ERR-010: Invalid command", text);
    await reporter(
      `🛑 Run Rejected\nInvalid command: ${text}\nSahi format:\n/run001 — Daily\n/run002 — Weekly\n/run003 — Deep Dive\n/run004 <topic> — Custom`,
      env
    ).catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));
    return;
  }

  const type = `run00${match[1]}`;       // "1" → "run001", "2" → "run002", etc.
  const topic = match[2].trim() || null; // command ke baad ka extra text (agar ho)

  if (type === "run004" && !topic) {
    console.log("PE-RUN-ERR-011: Topic missing for run004");
    await reporter(`🛑 RUN004 ke liye topic zaroori hai\nSahi format: /run004 Nifty 50 aaj`, env)
      .catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));
    return;
  }

  await executeRun(env, { type, topic, source: "telegram", chatId });
}

// ═══════════════════════════════════════════════════════════════
// CRON HANDLER — roz fixed time pe khud-ba-khud chalta hai
// Kaam: KV storage ("schedule_today" key) check karta hai —
//   - agar wahan pehle se koi schedule set hai (jaise {type:"run002"}),
//     to wahi type chalega
//   - agar KV mein kuch nahi mila, to default "run001" chalega
// Isse roz manually Telegram pe command bhejne ki zaroorat nahi padti.
// ═══════════════════════════════════════════════════════════════
async function handleCron(env, cron) {
  let scheduleType = "run001";  // default agar KV mein kuch na mile
  let scheduleTopic = null;

  try {
    const raw = await env.PE_KV.get("schedule_today");
    if (raw) {
      const schedule = JSON.parse(raw);
      scheduleType = schedule.type || "run001";
      scheduleTopic = schedule.topic || null;
    }
  } catch (kvErr) {
    console.log("PE-RUN-ERR-020: KV schedule read failed", kvErr.message);
    // KV fail ho to bhi default "run001" chalega, poora system nahi rukta
  }

  if (scheduleType === "run004" && !scheduleTopic) {
    console.log("PE-RUN-ERR-021: Cron RUN004 topic missing");
    await reporter(`🛑 RUN004 schedule mein topic missing`, env)
      .catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));
    return;
  }

  await executeRun(env, { type: scheduleType, topic: scheduleTopic, source: "cron", chatId: null });
}

// ═══════════════════════════════════════════════════════════════
// EXECUTE RUN — yahan asli routing hoti hai
// Kaam:
//   1. Unique runId banata hai
//   2. Poora payload object banata hai (upar format dekho)
//   3. TYPE_MAP se target function nikaalta hai (jaise handleDaily)
//   4. Agar target file abhi ready nahi (comment-out hai), to
//      "handler registered nahi" report bhejta hai — CRASH NAHI hota
//   5. Ready ho to seedha us function ko DIRECT CALL karta hai
//      (await targetHandler(env, payload)) — koi queue involved nahi
//   6. Success/fail dono cases mein Telegram pe report jaata hai
// ═══════════════════════════════════════════════════════════════
async function executeRun(env, { type, topic, source, chatId }) {
  const runId = generateRunId(type);
  const triggeredAt = new Date().toISOString();

  const payload = { runId, type, topic: topic || null, source, chatId: chatId || null, triggeredAt };

  const targetHandler = TYPE_MAP[type];
  if (!targetHandler) {
    // Yeh case tab aayega jab type "run002"/"run003"/"run004" ho
    // lekin uski file abhi comment-out hai (ready nahi hai)
    console.log("PE-RUN-ERR-030: No handler for type", type);
    await reporter(`🚨 Handler registered nahi: ${type}\n(File abhi build nahi hui)`, env)
      .catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));
    return;
  }

  try {
    console.log("PE-RUN-030: Forwarding to", type, payload);
    await targetHandler(env, payload);  // ← DIRECT FUNCTION CALL, koi queue nahi

    await reporter(
      `✅ Run Started\nRun ID: ${runId}\nType: ${type}\n${topic ? `Topic: ${topic}\n` : ""}Source: ${source}`,
      env
    ).catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));

  } catch (err) {
    console.log("PE-RUN-ERR-031: Target handler failed", err.message);
    await reporter(`🚨 Run failed\nType: ${type}\nError: ${err.message}`, env)
      .catch((e) => console.log("PE-RUN-REPORT-ERR:", e.message));
  }
  }
