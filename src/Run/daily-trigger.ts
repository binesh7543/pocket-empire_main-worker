/**
 * ══════════════════════════════════════════════════════════════
 * news-extract.ts — Google Financial News Fetcher & Splitter
 * ══════════════════════════════════════════════════════════════
 * FIXES:
 * 1. Hardcoded Google Finance News RSS URL (Search Query: stock market OR finance)
 * 2. Complete Browser Headers (User-Agent + Sec-Ch-Ua + Accept) for 503 bypass
 * 3. 2-second Delay before Retry attempt
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "../reporter.js";

type Env = { [key: string]: any };

// ── 1. HARDCODED FINANCIAL RSS URL ──────────────────────────
// Yeh URL Google News se "stock market OR finance OR sensex OR nifty" ki latest English news nikalega
const FINANCIAL_RSS_URL =
  "https://news.google.com/rss/search?q=stock+market+OR+finance+OR+sensex+OR+nifty&hl=en-IN&gl=IN&ceid=IN:en";

// ── 2. FULL BROWSER HEADERS (To bypass Google 503 Bot detection) ──
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Ch-Ua": '"Not-A.Brand";v="99", "Chromium";v="124", "Google Chrome";v="124"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

// Delay helper (Retry se pehle wait karne ke liye)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── 3. FETCH RSS WITH FULL HEADERS & DELAY RETRY ────────────
async function fetchRssWithRetry(rssUrl: string, env: Env): Promise<string> {
  try {
    const response = await fetch(rssUrl, {
      headers: BROWSER_HEADERS,
      cf: { cacheTtl: 0 }, // Worker cache bypass
    });

    if (!response.ok) throw new Error(`Status ${response.status}`);
    return await response.text();
  } catch (firstErr: any) {
    console.log("PE-NEWS-RETRY: First attempt failed ->", firstErr.message);

    // Pehli baar fail hone par Telegram par alert
    await reporter(
      `⚠️ Financial RSS pehli baar fail hua (${firstErr.message}), 2 sec wait karke retry kar raha hun...`,
      env
    ).catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));

    // 2 second ka gap dena zaroori hai (Google IP throttle cool down)
    await delay(2000);

    const retryResponse = await fetch(rssUrl, {
      headers: BROWSER_HEADERS,
      cf: { cacheTtl: 0 },
    });

    if (!retryResponse.ok)
      throw new Error(`Retry bhi fail: Status ${retryResponse.status}`);
    return await retryResponse.text();
  }
}

// ── 4. RSS PARSE & EXTRACT 1 FINANCIAL NEWS ─────────────────
async function fetchOneNews(rssUrl: string, env: Env): Promise<{ title: string }> {
  const xmlText = await fetchRssWithRetry(rssUrl, env);

  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(xmlText);
  const items = result?.rss?.channel?.item || [];

  if (items.length === 0) {
    throw new Error("Financial RSS mein koi news nahi mili");
  }

  const first = Array.isArray(items) ? items[0] : items;
  return { title: first.title || "" };
}

// ── 5. TITLE SPLIT LOGIC ────────────────────────────────────
function splitIntoTwoPieces(title: string): { part1: string; part2: string } {
  // Google News ke title ke aage source hota hai (e.g., "Sensex jumps 500 pts - Economic Times")
  // Pehle use clean kar lete hain
  const cleanTitle = title.split(" - ")[0].trim();

  const connectors = /\b(amid|as|after|due to|on|following|jumps|falls|rises|slumps)\b/i;
  const match = cleanTitle.match(connectors);

  if (match && match.index !== undefined && match.index > 5) {
    const part1 = cleanTitle.slice(0, match.index).trim();
    const part2 = cleanTitle.slice(match.index).trim();
    return { part1, part2 };
  }

  const words = cleanTitle.split(" ");
  const mid = Math.ceil(words.length / 2);
  return {
    part1: words.slice(0, mid).join(" "),
    part2: words.slice(mid).join(" "),
  };
}

// ── 6. MAIN HANDLER ─────────────────────────────────────────
export async function handle(env: Env): Promise<void> {
  try {
    // Ab env.RSS_FEED_URL ki zaroorat nahi hai, hardcoded FINANCIAL_RSS_URL use hoga
    const { title } = await fetchOneNews(FINANCIAL_RSS_URL, env);
    const { part1, part2 } = splitIntoTwoPieces(title);

    console.log("PE-NEWS-001: Financial Split Done", { full: title, part1, part2 });

    await reporter(
      `📊 *Financial News Extract*\n\n*Full Title:* ${title}\n\n🔹 *Part 1:* ${part1}\n🔹 *Part 2:* ${part2}`,
      env
    ).catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));

  } catch (err: any) {
    console.log("PE-NEWS-ERR-099:", err.message);
    await reporter(`🚨 news-extract.ts failed\nError: ${err.message}`, env)
      .catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));
  }
}
