/**
 * dispatcher.ts – Raw Payload Inspector with Authorisation Checkpoint
 * 
 * Checks incoming Telegram chat IDs against the allowed one.
 * If unauthorised, sends an alert and stops.
 * Otherwise, dumps the raw payload structure to the admin chat.
 */

export async function handleFetch(
  payload: any,
  env: Record<string, any>,
  ctx: ExecutionContext,
  request: Request
): Promise<void> {
  try {
    const token = env.TELEGRAM_BOT_TOKEN;
    const adminChatId = env.TELEGRAM_CHAT_ID;

    if (!token || !adminChatId) {
      console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in env!');
      return;
    }

    // ── 1. CHECKPOINT: Authorise chat ID ──────────────────
    // Extract chat ID from the payload if it's a Telegram update
    const chatId = payload?.message?.chat?.id?.toString();

    if (chatId && chatId !== adminChatId) {
      // Unauthorised user – send alert and abort
      console.log(`🚫 Unauthorised chat ID: ${chatId}`);
      await sendTelegramMessage(
        token,
        adminChatId,
        `🛑 *Unauthorised Access Attempt*\n` +
        `Chat ID: \`${chatId}\`\n` +
        `Message: ${payload?.message?.text || '(no text)'}`
      );
      return; // Stop further processing
    }

    // ── 2. Authorised (or non‑Telegram payload) ──────────
    // Dump the raw payload structure
    let rawDataString = JSON.stringify(payload, null, 2);
    const safeText = rawDataString.length > 4000
      ? rawDataString.substring(0, 4000) + '\n...[Truncated]'
      : rawDataString;

    await sendTelegramMessage(
      token,
      adminChatId,
      `📦 *INCOMING PAYLOAD STRUCTURE*:\n\`\`\`json\n${safeText}\n\`\`\``
    );

  } catch (error: any) {
    console.error('Error in handleFetch:', error.message || error);
  }
}

// ── Helper: Send a Telegram message ──────────────────────────
async function sendTelegramMessage(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
  }
}

// ── Placeholders for other event types ──────────────────────
export async function handleScheduled(event: any, env: any, ctx: any): Promise<void> {
  // No‑op: can be extended later
}

export async function handleQueue(batch: any, env: any, ctx: any): Promise<void> {
  // No‑op: can be extended later
}
