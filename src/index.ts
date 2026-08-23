/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.5  (TEMP DEBUG — dispatcher hataya gaya)
 *
 *  Status: Ye TEMPORARY testing version hai. Sirf ye check karne
 *  ke liye ki Telegram webhook se data kaise aa raha hai.
 *
 *  Dispatcher.ts (aur uske through jo bhi reporter.ts / aage
 *  call hote the) — SAB HATA DIYA GAYA HAI. Ab ye file khud hi
 *  standalone hai, kisi aur file ko call/import nahi karti.
 *
 *  Kya bacha hai:
 *    1) fetch()      → Webhook se data aata hai, turant 200 OK,
 *                       aur khud hi seedha Telegram ko message
 *                       bhej deta hai (debug ke liye).
 *    2) scheduled()  → Cron handler — ye jaan-bujh kar rakha gaya
 *                       hai. wrangler.toml mein cron trigger bound
 *                       hai, isliye agar ye handler na ho to
 *                       deploy hi FAIL ho jaata hai (pehle bhi
 *                       aisa dekha gaya tha). Abhi iske andar
 *                       koi logic nahi, bas stub hai.
 *    3) queue()      → Queue consumer stub — wrangler.toml mein
 *                       bound hai isliye zaroori hai, warna deploy
 *                       fail hoga. Abhi sirf ack() kar raha hai.
 * ============================================================
 */

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // 🔽 FUTURE BINDINGS — jaise-jaise use honge, yahan declare karo
  // DB: D1Database;
  // AI: Ai;
  // PE_KV: KVNamespace;
  // PE_REPORTER: Queue;
  // PE_COLLECTOR: Queue;
  // PE_PROCESSOR: Queue;
  // PE_PUBLISHER: Queue;
  // RSS_FEED_URL: string;
}

// ------------------------------------------------------
// 🔹 Helper — seedha Telegram Bot API ko message bhejta hai
// ------------------------------------------------------
async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("PE-INDEX: TELEGRAM_BOT_TOKEN ya TELEGRAM_CHAT_ID missing, message skip kiya");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.log("PE-INDEX: Telegram message bhejne mein error", err);
  }
}

export default {
  // ------------------------------------------------------
  // 🔹 1) Telegram Webhook entry (HTTP POST)
  // ------------------------------------------------------
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    let payload: unknown = null;
    try {
      payload = await request.json();
    } catch {
      payload = null;
    }

    // Debug ke liye — jo bhi data aaya, uska JSON seedha Telegram par bhej do
    const debugText = `PE-INDEX (webhook):\n${JSON.stringify(payload)}`;
    ctx.waitUntil(sendTelegramMessage(env, debugText));

    // Telegram ko turant OK
    return new Response("OK", { status: 200 });
  },

  // ------------------------------------------------------
  // 🔹 2) Cron trigger — STUB (deploy ke liye zaroori, jaan-bujh
  //    kar rakha gaya hai)
  // ------------------------------------------------------
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log("PE-INDEX: cron triggered (stub, no-op)");
  },

  // ------------------------------------------------------
  // 🔹 3) Queue consumer — STUB (wrangler.toml mein bound hai,
  //    isliye handler zaroori hai warna deploy fail hota hai).
  // ------------------------------------------------------
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`PE-QUEUE[${batch.queue}]: received`, msg.body);
      msg.ack();
    }
  },
};
