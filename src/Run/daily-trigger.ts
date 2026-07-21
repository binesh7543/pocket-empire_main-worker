/**
 * ══════════════════════════════════════════════════════════════
 * news-extract.ts — RSS se EK news uthao, 2 tukdon mein todo
 * ══════════════════════════════════════════════════════════════
 * Kaam: RSS feed se pehla/top news item uthata hai, uske title ko
 * 2 pieces mein todta hai (Subject + Action/Context), aur seedha
 * Telegram pe push kar deta hai. Koi AI call nahi, koi word-frequency
 * logic nahi — sirf ek news, do tukde.
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "./reporter.js";

type Env = { RSS_FEED_URL: string; [key: string]: any };

// ── RSS se ek news item uthana ──────────────────────────────
async function fetchOneNews(rssUrl: string): Promise<{ title: string }> {
  const response = await fetch(rssUrl);
  if (!response.ok) {
    throw new Error(`RSS fetch failed: ${response.status}`);
  }

  const xmlText = await response.text();
  const { XMLParser } = await import("fast-xml-parser");
  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(xmlText);
  const items = result?.rss?.channel?.item || [];

  if (items.length === 0) {
    throw new Error("RSS mein koi news nahi mili");
  }

  // ── Sirf PEHLA/TOP news item uthao ──
  const first = Array.isArray(items) ? items[0] : items;
  return { title: first.title || "" };
}

// ── Title ko 2 tukdon mein todna ────────────────────────────
// Common connector words (amid/as/after/on/due to) pe split karta hai.
// Agar koi connector nahi mila, to 50-50 word-count split karta hai.
function splitIntoTwoPieces(title: string): { part1: string; part2: string } {
  const connectors = /\b(amid|as|after|due to|on|following)\b/i;
  const match = title.match(connectors);

  if (match && match.index !== undefined) {
    const part1 = title.slice(0, match.index).trim();
    const part2 = title.slice(match.index).trim();
    return { part1, part2 };
  }

  // Fallback: connector nahi mila to beech se todo
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
    const { title } = await fetchOneNews(env.RSS_FEED_URL);
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
