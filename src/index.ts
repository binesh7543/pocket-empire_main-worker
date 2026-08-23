/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.7  (TEMP DEBUG — headers + body Telegram ko;
 *                    queue() stub wapas add kiya, warna deploy
 *                    fail hota hai — "Queue handler is missing")
 *
 *  Status: TEMPORARY testing version. Sirf ye dekhne ke liye ki
 *  webhook se HTTP headers aur body dono kaise/kya aa rahe hain.
 *
 *  Dispatcher, cron logic — sab hataya hua hai jaisa tha.
 *  Sirf queue() stub wapas rakha hai kyunki wrangler.toml mein
 *  PE_REPORTER / PE_COLLECTOR / PE_PROCESSOR / PE_PUBLISHER
 *  queues bound hain — inke bina deploy hi fail ho jaata hai.
 * ============================================================
 */

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
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
  // 🔹 Telegram Webhook entry (HTTP POST) — DEBUG ONLY
  // ------------------------------------------------------
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Headers ko object mein collect karo
    const headersObj: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headersObj[key] = value;
    });

    // Body raw text ke roop mein padho (JSON ho ya na ho, dono case handle)
    let bodyText = "";
    try {
      bodyText = await request.text();
    } catch {
      bodyText = "(body read failed)";
    }

    const debugText =
      `PE-INDEX (webhook debug)\n\n` +
      `— HEADERS —\n${JSON.stringify(headersObj, null, 2)}\n\n` +
      `— BODY —\n${bodyText}`;

    // 4096 char Telegram limit ke andar rakhne ke liye truncate karo
    const safeText = debugText.length > 4000 ? debugText.slice(0, 4000) + "\n...(truncated)" : debugText;

    ctx.waitUntil(sendTelegramMessage(env, safeText));

    return new Response("OK", { status: 200 });
  },

  // ------------------------------------------------------
  // 🔹 Queue consumer — STUB (zaroori hai, warna deploy fail
  //    hota hai kyunki queues wrangler.toml mein bound hain)
  // ------------------------------------------------------
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      console.log(`PE-QUEUE[${batch.queue}]: received`, msg.body);
      msg.ack();
    }
  },
};
