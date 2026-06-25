// ============================================================
// FILE: src/utils.js
// ============================================================

export function json(data, status = 200, headers = {}) { // L1
  return new Response(JSON.stringify(data), {   // L2
    status,                                     // L3
    headers: { 'Content-Type': 'application/json', ...headers } // L4
  });                                           // L5
}                                                // L6

export async function sendTelegram(env, message) { // L8
  try {                                         // L9
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, { // L10
      method: 'POST',                           // L11
      headers: { 'Content-Type': 'application/json' }, // L12
      body: JSON.stringify({                    // L13
        chat_id: env.TELEGRAM_CHAT_ID,          // L14
        text: message,                          // L15
        parse_mode: 'HTML'                      // L16
      })                                       // L17
    });                                         // L18
  } catch (e) { /* silent fail */ }             // L19
}                                               // L20

export function makeEventId() {                 // L22
  const d = new Date();                         // L23
  const date = d.toISOString().slice(0, 10).replace(/-/g, ''); // L24
  const rand = Math.floor(Math.random() * 9000 + 1000); // L25
  return `EVT-${date}-${rand}`;                 // L26
}                                               // L27
