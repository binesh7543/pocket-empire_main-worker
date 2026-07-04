/**
 * Pocket Empire v5.1 — run.js
 * Role: Command scanner + scheduler + queue dispatcher
 *
 * Handles:
 *  - Telegram: /run001, /run002, /run003, /run004 <topic>
 *  - Cron: KV schedule check → sahi type run karo
 *
 * YAH FILE DOBARA EDIT NAHI HOGI JAB TAK NAYA RUN TYPE NA AAYE.
 *
 * Queue mein kya jaata hai:
 *  {
 *    runId: "PE-RUN-001-20260703-143022",
 *    type: "001" | "002" | "003" | "004",
 *    topic: "<topic text>" | null,
 *    source: "telegram" | "cron",
 *    triggeredAt: "ISO timestamp"
 *  }
 */

// ── Unique Run ID generator ──────────────────────────────────
function generateRunId(type) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const time = now.toTimeString().slice(0, 8).replace(/:/g, "");
  return `PE-RUN-${type}-${date}-${time}`;
}

// ── Telegram report helper ───────────────────────────────────
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
    console.log("PE-RUN-TG-ERR:", e.message);
  }
}

// ── Queue mein daalana ───────────────────────────────────────
async function pushToQueue(env, payload) {
  try {
    await env.PE_COLLECTOR.send(payload);
    console.log("PE-RUN-003: Queue mein daala", payload.runId);
  } catch (err) {
    console.log("PE-RUN-ERR-003: Queue push failed", err.message);
    await tgReport(env,
      `🚨 *Run ERROR* [PE-RUN-ERR-003]\nQueue push failed\nRun ID: ${payload.runId}\nError: ${err.message}`
    );
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// MAIN HANDLER — dispatcher.js yahi call karta hai
// ════════════════════════════════════════════════════════════
export async function handle(env, { chatId, text, body, cron }) {
  try {
    // ── Cron se aaya hai ya Telegram se? ──────────────────
    const source = cron ? "cron" : "telegram";
    console.log("PE-RUN-001: Received", { source, text, cron });

    await tgReport(env,
      `📥 *Run Received* [PE-RUN-001]\nSource: ${source}\n${cron ? `Cron: ${cron}` : `Command: ${text}`}`
    );

    if (source === "cron") {
      return await handleCron(env, cron);
    } else {
      return await handleTelegram(env, { chatId, text });
    }

  } catch (err) {
    console.log("PE-RUN-ERR-099: Main handler exception", err.message);
    await tgReport(env,
      `🚨 *Run ERROR* [PE-RUN-ERR-099]\nMain handler failed\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// TELEGRAM HANDLER — /run001, /run002, /run003, /run004
// ════════════════════════════════════════════════════════════
async function handleTelegram(env, { chatId, text }) {
  try {
    console.log("PE-RUN-010: Telegram command", text);

    const lower = text.toLowerCase().trim();
    const match = lower.match(/^\/run\s*0*(1|2|3|4)(.*)$/);

    if (!match) {
      console.log("PE-RUN-ERR-010: Invalid command", text);
      await tgReport(env,
        `🛑 *Run Rejected* [PE-RUN-ERR-010]\nInvalid command: ${text}\nSahi format:\n/run001 — Daily\n/run002 — Weekly\n/run003 — Deep Dive\n/run004 <topic> — Custom`
      );
      return;
    }

    const type = match[1].padStart(3, "0");
    const topic = match[2].trim() || null;

    if (type === "004" && !topic) {
      console.log("PE-RUN-ERR-011: Topic missing for run004");
      await tgReport(env,
        `🛑 *Run Rejected* [PE-RUN-ERR-011]\nRUN004 ke liye topic zaroori hai\nSahi format: /run004 Nifty 50 aaj`
      );
      return;
    }

    await executeRun(env, { type, topic, source: "telegram", chatId });

  } catch (err) {
    console.log("PE-RUN-ERR-019: Telegram handler exception", err.message);
    await tgReport(env,
      `🚨 *Run ERROR* [PE-RUN-ERR-019]\nTelegram handler failed\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// CRON HANDLER — KV schedule check → sahi type run karo
// ════════════════════════════════════════════════════════════
async function handleCron(env, cron) {
  try {
    console.log("PE-RUN-020: Cron handler", cron);

    let scheduleType = "001";
    let scheduleTopic = null;

    try {
      const raw = await env.PE_KV.get("schedule_today");
      if (raw) {
        const schedule = JSON.parse(raw);
        scheduleType = schedule.type || "001";
        scheduleTopic = schedule.topic || null;
        console.log("PE-RUN-021: Schedule found", schedule);
        await tgReport(env,
          `📅 *Schedule Found* [PE-RUN-021]\nType: RUN${scheduleType}\n${scheduleTopic ? `Topic: ${scheduleTopic}` : ""}`
        );
      } else {
        console.log("PE-RUN-022: No schedule — default RUN001");
        await tgReport(env,
          `📅 *No Schedule* [PE-RUN-022]\nDefault RUN001 chalega`
        );
      }
    } catch (kvErr) {
      console.log("PE-RUN-ERR-020: KV schedule read failed", kvErr.message);
      await tgReport(env,
        `⚠️ *Schedule Read Failed* [PE-RUN-ERR-020]\nKV error — Default RUN001 chalega\nError: ${kvErr.message}`
      );
    }

    if (scheduleType === "004" && !scheduleTopic) {
      console.log("PE-RUN-ERR-021: Cron RUN004 topic missing");
      await tgReport(env,
        `🛑 *Cron Rejected* [PE-RUN-ERR-021]\nRUN004 schedule mein topic missing\nKV mein schedule_today update karo`
      );
      return;
    }

    await executeRun(env, {
      type: scheduleType,
      topic: scheduleTopic,
      source: "cron",
      chatId: null,
    });

  } catch (err) {
    console.log("PE-RUN-ERR-029: Cron handler exception", err.message);
    await tgReport(env,
      `🚨 *Run ERROR* [PE-RUN-ERR-029]\nCron handler failed\nError: ${err.message}`
    );
  }
}

// ════════════════════════════════════════════════════════════
// EXECUTE RUN — Unique ID banao + Queue mein daalo
// ════════════════════════════════════════════════════════════
async function executeRun(env, { type, topic, source, chatId }) {
  try {
    const runId = generateRunId(type);
    const triggeredAt = new Date().toISOString();

    console.log("PE-RUN-030: Executing", { runId, type, topic, source });

    const payload = {
      runId,
      type,
      topic: topic || null,
      source,
      chatId: chatId || null,
      triggeredAt,
    };

    await pushToQueue(env, payload);

    await tgReport(env,
      `✅ *Run Started* [PE-RUN-031]\nRun ID: \`${runId}\`\nType: RUN${type}\n${topic ? `Topic: ${topic}\n` : ""}Source: ${source}\nTime: ${triggeredAt}`
    );

    console.log("PE-RUN-031: Run queued successfully", runId);

  } catch (err) {
    console.log("PE-RUN-ERR-030: Execute run exception", err.message);
    await tgReport(env,
      `🚨 *Run ERROR* [PE-RUN-ERR-030]\nExecute failed\nType: RUN${type}\nError: ${err.message}`
    );
  }
}
