/**
 * ══════════════════════════════════════════════════════════════
 * Pocket Empire v5.1 — daily-trigger.ts  (RUN001)
 * ══════════════════════════════════════════════════════════════
 * ROLE: Google RSS feed se trending word nikaalta hai, D1 mein
 * save karta hai, Telegram pe report karta hai. run.js isko
 * DIRECT CALL karta hai jab type === "run001" ho.
 *
 * Hono NAHI use kiya — sirf internal function-call se chalta hai,
 * koi external HTTP endpoint expose nahi karta.
 *
 * FLOW:
 *   run.js → handle(env, payload) → fetchSingleTrendingWord()
 *   → Google RSS se seedha data aata hai (fetch call) →
 *   parse + word nikaalo → D1 mein save karo → Telegram report
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "./reporter.js";

// ── Types ──────────────────────────────────────────────────────
type Env = {
  RSS_FEED_URL: string;
  DB: D1Database;          // D1 binding — wrangler.toml mein "DB" naam se set hona chahiye
  [key: string]: any;      // baaki env vars (TELEGRAM_*, etc.) ke liye
};

type RunPayload = {
  runId: string;
  type: string;
  topic: string | null;
  source: "telegram" | "cron";
  chatId: string | null;
  triggeredAt: string;
};

// ── Stopwords chhalni — common words jo trending word nahi ban sakte ──
const STOP_WORDS = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not',
  'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from',
  'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would',
  'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which',
  'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know',
  'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see',
  'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think',
  'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
  'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most',
  'us', 'said', 'says', 'will', 'can', 'may', 'get', 'via', 'amp', 'google', 'news',
  'finance', 'money', 'life', 'ymyl'
]);

// ── CORE LOGIC — tumhara original function, UNTOUCHED ──────────
// Kaam: RSS feed fetch karta hai, XML parse karta hai, sabse zyada
// repeat hone wala word nikaal ke return karta hai.
async function fetchSingleTrendingWord(rssUrl: string): Promise<string> {
  // A. Google RSS ko seedha HTTP request — data yahin se aata hai
  const response = await fetch(rssUrl);
  if (!response.ok) {
    throw new Error(`Google RSS Fetch failed with status: ${response.status}`);
  }

  const xmlText = await response.text();   // ← raw XML data yahan store hota hai

  // B. XML Parsing
  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(xmlText);
  const items = result?.rss?.channel?.item || [];

  if (items.length === 0) {
    throw new Error("No articles found in the RSS feed response.");
  }

  // C. Text Extraction & Cleaning
  let rawText = '';
  for (let i = 0; i < Math.min(items.length, 25); i++) {
    const item = items[i];
    rawText += (item.title || '') + ' ';
    rawText += (item.summary || item.description || '') + ' ';
  }

  const cleaned = rawText.toLowerCase().replace(/[^a-zA-Z\s]/g, ' ');
  const words = cleaned.split(/\s+/).filter((w: string) => w.length > 3 && !STOP_WORDS.has(w));

  if (words.length === 0) {
    throw new Error("No valid trending words left after applying Stopwords filter.");
  }

  // D. Frequency Counting
  const freqMap = new Map<string, number>();
  for (const word of words) {
    freqMap.set(word, (freqMap.get(word) || 0) + 1);
  }

  // E. Sabse zyada repeat hone wala TOP 1 word return karo
  const sorted = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? sorted[0][0] : 'N/A';
}

// ── D1 mein save karna ───────────────────────────────────────
// Table: run_id (PRIMARY KEY) + word — sirf yeh 2 columns.
// "IF NOT EXISTS" se table khud ban jaati hai, manual setup nahi chahiye.
async function saveToD1(env: Env, runId: string, word: string): Promise<void> {
  await env.DB.exec(
    `CREATE TABLE IF NOT EXISTS trending_words (run_id TEXT PRIMARY KEY, word TEXT NOT NULL)`
  );
  await env.DB.prepare(
    `INSERT INTO trending_words (run_id, word) VALUES (?, ?)`
  ).bind(runId, word).run();
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER — run.js isi function ko DIRECT call karta hai
// jab type === "run001" ho. Payload run.js se aata hai.
// ═══════════════════════════════════════════════════════════════
export async function handle(env: Env, payload: RunPayload): Promise<void> {
  console.log("PE-DAILY-001: Started", payload);

  const rssUrl = env.RSS_FEED_URL;
  if (!rssUrl) {
    console.log("PE-DAILY-ERR-001: RSS_FEED_URL missing");
    await reporter(`🚨 daily-trigger.ts\nRSS_FEED_URL environment variable missing hai`, env)
      .catch((e: Error) => console.log("PE-DAILY-REPORT-ERR:", e.message));
    return;
  }

  try {
    const wordOfTheDay = await fetchSingleTrendingWord(rssUrl);

    if (wordOfTheDay === 'N/A') {
      console.log("PE-DAILY-ERR-002: No valid word extracted");
      await reporter(`⚠️ daily-trigger.ts\nKoi valid trending word nahi mila`, env)
        .catch((e: Error) => console.log("PE-DAILY-REPORT-ERR:", e.message));
      return;
    }

    console.log("PE-DAILY-002: Word found", wordOfTheDay);

    // ── D1 mein save (run_id + word) ──
    try {
      await saveToD1(env, payload.runId, wordOfTheDay);
      console.log("PE-DAILY-003: Saved to D1", payload.runId, wordOfTheDay);
    } catch (dbErr: any) {
      console.log("PE-DAILY-ERR-003: D1 save failed", dbErr.message);
      await reporter(`⚠️ D1 save fail hua\nRun ID: ${payload.runId}\nError: ${dbErr.message}`, env)
        .catch((e: Error) => console.log("PE-DAILY-REPORT-ERR:", e.message));
      // D1 fail ho tab bhi Telegram report continue hoga, poora run crash nahi hoga
    }

    // ── Telegram pe seedha function-call se report — HTTP fetch nahi ──
    await reporter(
      `📰 Daily Trending Word\nRun ID: ${payload.runId}\nWord: ${wordOfTheDay}`,
      env
    ).catch((e: Error) => console.log("PE-DAILY-REPORT-ERR:", e.message));

    // ── FUTURE: agar is result ko kisi aur file/queue ko forward karna ho ──
    // (jaise publisher.js ko content bhejna), yahan add karna.
    // Abhi koi forwarding nahi ho rahi — kaam yahin khatam hota hai.

  } catch (err: any) {
    console.log("PE-DAILY-ERR-099:", err.message);
    await reporter(`🚨 daily-trigger.ts failed\nRun ID: ${payload.runId}\nError: ${err.message}`, env)
      .catch((e: Error) => console.log("PE-DAILY-REPORT-ERR:", e.message));
  }
                               }
