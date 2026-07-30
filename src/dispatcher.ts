/**
 * dispatcher.ts – Raw Payload Inspector
 * Role: Receives whatever index.ts passes, stringifies it, 
 * and sends it back to Telegram env.TELEGRAM_CHAT_ID.
 */

export async function handleFetch(
  payload: any,
  env: Record<string, any>,
  ctx: ExecutionContext,
  request: Request
): Promise<void> {
  try {
    // 1. Telegram API Details from Environment Variables
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.log("Error: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in env!");
      return;
    }

    // 2. Incoming Payload ko String me convert kiya taaki pura Structure dikhe
    const rawDataString = JSON.stringify(payload, null, 2);

    // Telegram Telegram message limit ~4090 characters
    const safeText = rawDataString.length > 4000 
      ? rawDataString.substring(0, 4000) + "\n...[Truncated]"
      : rawDataString;

    // 3. Directly Environment Variables use karke Telegram ko send kar diya
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `📦 *INCOMING PAYLOAD STRUCTURE*:\n\`\`\`json\n${safeText}\n\`\`\``,
        parse_mode: "Markdown",
      }),
    });

  } catch (error: any) {
    console.error("Error sending raw payload to Telegram:", error.message || error);
  }
}

// Optional Handlers (Aap ise khali rakh sakte hain)
export async function handleScheduled(event: any, env: any, ctx: any): Promise<void> {}
export async function handleQueue(batch: any, env: any, ctx: any): Promise<void> {}

