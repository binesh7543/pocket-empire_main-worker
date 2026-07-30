import { reporter as reportMessage } from '../reporter.js';

export async function handle(incomingMessage: any, env: any): Promise<void> {
  console.log('[daily-trigger] नया टास्क रिसीव हुआ...');

  // 1. env सुरक्षा चेक
  if (!env) {
    console.error('[daily-trigger] एरर: env ऑब्जेक्ट उपलब्ध नहीं है!');
    return;
  }

  try {
    // 2. मैसेज को डिफाइन / फॉर्मेट करना (ताकि टेलीग्राम पर साफ़ दिखे)
    const rawText = typeof incomingMessage === 'string' 
      ? incomingMessage 
      : JSON.stringify(incomingMessage, null, 2);

    const formattedMessage = 
      `📌 *[Daily Trigger Status]*\n` +
      `-----------------------------------\n` +
      `💬 *Received Message:* ${rawText}\n` +
      `🎯 *Target Chat ID:* \`${env.TELEGRAM_CHAT_ID || 'Not Found'}\`\n` +
      `⏰ *Timestamp:* ${new Date().toISOString()}`;

    // 3. खुद env का इस्तेमाल करते हुए लॉग बनाना
    console.log(`[daily-trigger] Chat ID ${env.TELEGRAM_CHAT_ID} के लिए मैसेज तैयार किया गया।`);

    // 4. डिफाइंड मैसेज और env को रिपोर्टर के पास भेजना
    await reportMessage(formattedMessage, env);

  } catch (error: any) {
    console.error('[daily-trigger] मैसेज प्रोसेस करने में एरर आया:', error?.message || error);
  }
}
