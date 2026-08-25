/**
 * ============================================================
 *  POCKET EMPIRE — MAIN ENTRY (index.ts)
 *  Version : 0.0.8
 *
 *  Role (sirf traffic director — koi over-engineering nahi):
 *    1) fetch()      → Webhook se URL/command/data aata hai.
 *                       Isko dispatcher ko pass kar do, aur
 *                       turant 200 OK return kar do. Bas.
 *                       (Telegram ko yahan se koi seedha message
 *                       nahi jaata — hum abhi webhook connect
 *                       nahi kar rahe, isliye koi extra logic
 *                       yahan nahi chahiye.)
 *    2) scheduled()  → Cron receive karta hai. Abhi ke liye
 *                       sirf stub — koi logic nahi.
 *    3) queue()      → Queue messages receive karta hai. Abhi ke
 *                       liye sirf stub — koi logic nahi
 *                       (wrangler.toml mein bound hai, isliye
 *                       handler zaroori hai warna deploy fail
 *                       hota hai — code 11001).
 *
 *  RULE: Is file ke andar khud koi function/logic nahi banana.
 *  Data passing ka structure yahan rakha hai kyunki aage aur
 *  code (dispatcher ke andar) isi par build hoga.
 * ============================================================
 */

import { dispatch } from "./dispatcher";

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

export default {
  // ------------------------------------------------------
  // 🔹 1) Webhook entry (HTTP POST) — URL/command/data receive
  // ------------------------------------------------------
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const body = await request.text().catch(() => "");

    let payload: unknown = null;
    try { payload = JSON.parse(body); } catch { payload = body; }

    ctx.waitUntil(dispatch({ source: "webhook", headers, body, payload, env, ctx }));

    return new Response("OK", { status: 200 });
  },

  // ------------------------------------------------------
  // 🔹 2) Cron trigger — STUB, koi logic nahi
  // ------------------------------------------------------
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {},

  // ------------------------------------------------------
  // 🔹 3) Queue consumer — STUB, koi logic nahi
  //    (wrangler.toml mein bound hai isliye handler zaroori hai
  //    warna deploy fail hota hai — code 11001)
  // ------------------------------------------------------
  async queue(batch: MessageBatch, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const msg of batch.messages) {
      msg.ack();
    }
  },
};
    await dispatch({ source: "webhook", payload, env, ctx });

    const data = { file: "index.ts", source: "webhook", payload };
    console.log("PE-INDEX:", JSON.stringify(data));
    await report(env, JSON.stringify(data, null, 2));
  } catch (err) {
    const data = { file: "index.ts", source: "webhook", error: String(err) };
    console.error("PE-INDEX-ERROR:", JSON.stringify(data));
    await report(env, JSON.stringify(data, null, 2));
  }
}
