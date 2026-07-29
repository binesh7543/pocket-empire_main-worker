import { reporter as reportMessage } from '../reporter.js';

export async function handle(incomingMessage: any): Promise<void> {
  console.log('[daily-trigger] मैसेज प्राप्त हुआ, ट्रांसफर कर रहे हैं...');

  try {
    await reportMessage(incomingMessage);
  } catch (error) {
    console.error('[daily-trigger] ट्रांसफर करने में खराबी आई:', error);
  }
}
