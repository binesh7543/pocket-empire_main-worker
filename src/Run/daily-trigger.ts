/**
 * ══════════════════════════════════════════════════════════════
 * news-extract.ts — HTML Web Scraper (No RSS, No API Key, No 503)
 * ══════════════════════════════════════════════════════════════
 */

import { reporter } from "../reporter.js";

type Env = { [key: string]: any };

// Google News Direct Search HTML URL
const GOOGLE_NEWS_SEARCH_URL =
  "https://news.google.com/search?q=stock%20market%20OR%20finance%20OR%20sensex&hl=en-IN&gl=IN&ceid=IN%3Aen";

// ── HTML Scraping Function ──────────────────────────────────
async function fetchNewsViaScraping(): Promise<string> {
  const response = await fetch(GOOGLE_NEWS_SEARCH_URL, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Google Search HTML Status: ${response.status}`);
  }

  const html = await response.text();

  // HTML mein se news title nikalne ke liye RegEx pattern
  const titleMatches = html.match(/<a[^>]*class="JtA2fe"[^>]*>(.*?)<\/a>/gi) || 
                       html.match(/<h3[^>]*>(.*?)<\/h3>/gi) ||
                       html.match(/class="gPFMg"[^>]*>(.*?)<\/a>/gi);

  if (!titleMatches || titleMatches.length === 0) {
    // Backup: Tag Clean Text search
    const cleanTitles = html.match(/>([^<]{20,120})<\/a>/g);
    if (cleanTitles && cleanTitles.length > 5) {
      return cleanTitles[5].replace(/[><]/g, "").trim();
    }
    throw new Error("HTML se news title extract nahi ho paya");
  }

  // Pehle match se HTML tags hatana
  const firstRawTitle = titleMatches[0];
  const cleanTitle = firstRawTitle.replace(/<[^>]*>/g, "").trim();

  return cleanTitle;
}

// ── Title Split Logic ───────────────────────────────────────
function splitIntoTwoPieces(title: string): { part1: string; part2: string } {
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

// ── MAIN HANDLER ─────────────────────────────────────────────
export async function handle(env: Env): Promise<void> {
  try {
    const title = await fetchNewsViaScraping();
    const { part1, part2 } = splitIntoTwoPieces(title);

    console.log("PE-NEWS-001: Scraping Success", { full: title, part1, part2 });

    await reporter(
      `📊 *Financial News (Scraper)*\n\n*Full Title:* ${title}\n\n🔹 *Part 1:* ${part1}\n🔹 *Part 2:* ${part2}`,
      env
    ).catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));

  } catch (err: any) {
    console.log("PE-NEWS-ERR-099:", err.message);
    await reporter(`🚨 news-extract.ts (Scraper) failed\nError: ${err.message}`, env)
      .catch((e: Error) => console.log("PE-NEWS-REPORT-ERR:", e.message));
  }
}
