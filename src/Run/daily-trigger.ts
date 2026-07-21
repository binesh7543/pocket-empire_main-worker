/**
 * ══════════════════════════════════════════════════════════════
 * news-extract.ts — RSS se EK news uthao, 2 tukdon mein todo
 * ══════════════════════════════════════════════════════════════
 * UPDATE: User-Agent header add kiya (Google 503 de raha tha kyunki
 * Workers ka default fetch bina User-Agent ke bot jaisa dikhta hai).
 * Retry logic bhi add kiya — pehli baar fail ho to ek retry hota hai,
 * aur "pehli baar fail hua tha" ka report Telegram pe jaata hai.
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "./reporter.js";

type Env = { RSS_FEED_URL: string; [key: string]: any };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ── RSS ko fetch karna, User-Agent ke saath, 1 retry ke saath ──
async function fetchRssWithRetry(rssUrl: string, env: Env): Promise<string> {
  try {
    const response = await fetch(rssUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`status ${response.status}`);
    return await response.text();
  } catch (firstErr: any) {
    console.log("PE-NEWS-RETRY: First attempt failed", firstErr.message);

    // ── Pehli baar fail hone ka report ──
    await reporter(`⚠️ RSS pehli baar fail hua, retry kar raha hun\nError: ${firstErr.message}`, env)
      .catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));

    // ── Ek retry ──
    const retryResponse = await fetch(rssUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!retryResponse.ok) throw new Error(`Retry bhi fail: status ${retryResponse.status}`);
    return await retryResponse.text();
  }
}

// ── RSS se ek news item uthana ──────────────────────────────
async function fetchOneNews(rssUrl: string, env: Env): Promise<{ title: string }> {
  const xmlText = await fetchRssWithRetry(rssUrl, env);

  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(xmlText);
  const items = result?.rss?.channel?.item || [];

  if (items.length === 0) {
    throw new Error("RSS mein koi news nahi mili");
  }

  const first = Array.isArray(items) ? items[0] : items;
  return { title: first.title || "" };
}

// ── Title ko 2 tukdon mein todna ────────────────────────────
function splitIntoTwoPieces(title: string): { part1: string; part2: string } {
  const connectors = /\b(amid|as|after|due to|on|following)\b/i;
  const match = title.match(connectors);

  if (match && match.index !== undefined) {
    const part1 = title.slice(0, match.index).trim();
    const part2 = title.slice(match.index).trim();
    return { part1, part2 };
  }

  const words = title.split(" ");
  const mid = Math.ceil(words.length / 2);
  return {
    part1: words.slice(0, mid).join(" "),
    part2: words.slice(mid).join(" "),
  };
}

// ── MAIN — RSS → 1 news → 2 tukde → Telegram push ───────────
export async function handle(env: Env): Promise<void> {
  try {
    const { title } = await fetchOneNews(env.RSS_FEED_URL, env);
    const { part1, part2 } = splitIntoTwoPieces(title);

    console.log("PE-NEWS-001: Split done", { part1, part2 });

    await reporter(
      `📰 News Split\nFull: ${title}\n\nPart 1: ${part1}\nPart 2: ${part2}`,
      env
    ).catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));

  } catch (err: any) {
    console.log("PE-NEWS-ERR-099:", err.message);
    await reporter(`🚨 news-extract.ts failed\nError: ${err.message}`, env)
      .catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));
  }
}
