// ============================================================
// daily-trigger.js — RUN001 (Daily/Telegram common trigger)
// Pocket Empire v5.1
// Status: v1 — Minimal Working Model (MVP)
// ============================================================
//
// KAAM (scope v1):
// 1. PE_COLLECTOR queue se message receive karta hai
// 2. Check karta hai message.type === "001" hai ya nahi
//    - Nahi hai -> agli file ko forward (abhi placeholder, files nahi bani)
//    - Haan hai -> khud process karta hai
// 3. Topic Decision Engine (simple v1):
//    - Calendar factor (Monday / month 1st) -> Date object se, koi API nahi
//    - Market factor -> 1 API call (fallback baad me add hoga)
//    - Day counter -> D1 se fetch, na mile to auto-create + Day 1 default
//    - Weighted score se final topic decide
// 4. Result Telegram par bhej deta hai (collector.js abhi nahi bani,
//    isliye handoff step abhi skip / placeholder hai)
//
// ENV required (Cloudflare bindings/vars):
// - DB (D1 database)
// - TELEGRAM_BOT_TOKEN
// - TELEGRAM_CHAT_ID
// - MARKET_API_KEY (agar market API key chahiye ho)
//
// NEXT FILE (abhi nahi bani, sirf placeholder):
// -> collector.js  (research requirement handoff yahan jayega)
// ============================================================

// ---------- Topic pool (static list, baad me KV se dynamic banega) ----------
const TOPIC_POOL = [
  "track_every_penny",
  "calculate_your_hourly_rate",
  "fix_subscription_bleed",
  "emergency_fund_check",
  "mutual_fund_sip_review",
  "50_30_20_rule",
  "tax_saving_guide",
];

// ---------- Main entry point (queue consumer calls this) ----------
export async function handle(message, env) {
  try {
    // Step 1: type check -> apna kaam hai ya forward karna hai
    if (message.type !== "001") {
      return await forwardToCorrectFile(message, env);
    }

    // Step 2: Topic Decision Engine chalao
    const topic = await decideTopic(env);

    // Step 3: abhi collector.js nahi bani -> result Telegram pe bhej do
    await sendTelegramMessage(
      env,
      `✅ RUN001 complete\nAaj ka topic: *${topic}*\n(collector.js abhi nahi bani, handoff pending)`
    );

    // Step 4: run_history me record save karo
    await saveRunHistory(env, message, topic, "success");

    return { status: "success", topic };
  } catch (err) {
    // Simple error handling (v1 -> koi retry/error-code system nahi abhi)
    await sendTelegramMessage(env, `❌ RUN001 failed: ${err.message}`);
    await saveRunHistory(env, message, null, "failed");
    return { status: "failed", error: err.message };
  }
}

// ---------- Forwarding logic (agli file abhi nahi bani, placeholder) ----------
async function forwardToCorrectFile(message, env) {
  // v1 me sirf placeholder -- weekly-brief.js / deep-dive.js / research-bot.js
  // abhi exist nahi karti, isliye abhi error/log bhej do
  await sendTelegramMessage(
    env,
    `⚠️ RUN${message.type} ke liye file abhi ready nahi hai (placeholder)`
  );
  return { status: "not_implemented", type: message.type };
}

// ---------- Topic Decision Engine (v1 simple) ----------
async function decideTopic(env) {
  const scores = {};
  for (const t of TOPIC_POOL) scores[t] = 0;

  // --- Factor 1: Calendar (30% weight) ---
  const today = new Date();
  const isMonday = today.getUTCDay() === 1; // 0=Sun, 1=Mon
  const isMonthStart = today.getUTCDate() === 1;

  if (isMonday) {
    scores["calculate_your_hourly_rate"] += 30;
    scores["track_every_penny"] += 20;
  }
  if (isMonthStart) {
    scores["fix_subscription_bleed"] += 30;
  }

  // --- Factor 2: Market data (40% weight) — 1 API call, no fallback yet ---
  try {
    const market = await fetchMarketData(env);
    if (market.niftyChangePercent < -1.0) {
      scores["emergency_fund_check"] += 40;
    }
    if (market.goldTrendUp) {
      scores["mutual_fund_sip_review"] += 20;
    }
  } catch (e) {
    // Market API fail -> v1 me bas skip, engine calendar+progression se hi chalega
    console.log("Market data fetch failed, skipping market factor:", e.message);
  }

  // --- Factor 3: Day counter / progression (30% weight) ---
  const dayCounter = await getDayCounter(env);
  if (dayCounter <= 7) {
    scores["track_every_penny"] += 30;
  } else if (dayCounter <= 15) {
    scores["50_30_20_rule"] += 30;
  } else if (dayCounter <= 22) {
    scores["mutual_fund_sip_review"] += 30;
  } else {
    scores["tax_saving_guide"] += 30;
  }

  // --- Final decision: max score ---
  let finalTopic = TOPIC_POOL[0];
  let maxScore = -1;
  for (const t of TOPIC_POOL) {
    if (scores[t] > maxScore) {
      maxScore = scores[t];
      finalTopic = t;
    }
  }

  return finalTopic;
}

// ---------- Market data fetch (single API, v1) ----------
async function fetchMarketData(env) {
  // NOTE: placeholder endpoint -- real API key/URL env se aayega
  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=NIFTY50&apikey=${env.MARKET_API_KEY}`
  );
  if (!res.ok) throw new Error("Market API request failed");
  const data = await res.json();

  return {
    niftyChangePercent: parseFloat(data.percent_change || "0"),
    goldTrendUp: false, // v1 me gold trend abhi wire nahi kiya, baad me add hoga
  };
}

// ---------- Day counter (D1 se, auto-create agar table/row na ho) ----------
async function getDayCounter(env) {
  await ensureRunHistoryTable(env);

  const result = await env.DB.prepare(
    `SELECT day_counter FROM run_history WHERE status = 'success' ORDER BY created_at DESC LIMIT 1`
  ).first();

  if (result && result.day_counter) {
    return result.day_counter + 1;
  }
  return 1; // pehli baar -> Day 1 default
}

// ---------- run_history table auto-create ----------
async function ensureRunHistoryTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS run_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT,
      run_type TEXT,
      topic TEXT,
      day_counter INTEGER,
      source TEXT,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

// ---------- Save run record ----------
async function saveRunHistory(env, message, topic, status) {
  await ensureRunHistoryTable(env);

  const dayCounter = topic ? await getDayCounter(env) : null;

  await env.DB.prepare(
    `INSERT INTO run_history (run_id, run_type, topic, day_counter, source, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      message.runId || null,
      message.type || null,
      topic,
      dayCounter,
      message.source || null,
      status
    )
    .run();
}

// ---------- Telegram helper ----------
async function sendTelegramMessage(env, text) {
  await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        parse_mode: "Markdown",
      }),
    }
  );
}
