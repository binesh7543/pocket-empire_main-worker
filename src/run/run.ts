import type { Env } from "../index";

const LANG = "hinglish";
const TG_LIMIT = 4000;

async function sendTelegramMessage(env: Env, text: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log("PE-RUN: TELEGRAM_BOT_TOKEN ya TELEGRAM_CHAT_ID missing");
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, TG_LIMIT) }),
    });
  } catch (err) {
    console.log("PE-RUN: Telegram message bhejne mein error", err);
  }
}

async function fetchPythonData(env: Env): Promise<string> {
  const url = `${env.PYTHON_API_URL}/make-question?lang=${LANG}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const body = await res.text();
    if (!res.ok) {
      return `❌ Python API error\nStatus: ${res.status}\n\n${body}`;
    }
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  } catch (err) {
    return `❌ Python API fetch failed\n${String(err)}`;
  } finally {
    clearTimeout(timer);
  }
}

export async function run(message: string, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log("PE-RUN: command received", message);

  await sendTelegramMessage(env, `✅ RUN command received\n\n"${message}"`);

  if (!env.PYTHON_API_URL) {
    await sendTelegramMessage(env, "❌ PYTHON_API_URL missing in env");
    return;
  }

  const data = await fetchPythonData(env);
  console.log("PE-RUN: python data received");

  await sendTelegramMessage(env, `📦 Python data (${LANG}):\n\n${data}`);
}
