// ============================================================
// FILE: src/routes/run.js
// ============================================================

import { Hono } from 'hono';                    // L1
import { logAudit } from '../db.js';           // L2

// ---------- TRIGGER HANDLER (named export) ----------
export const trigger = async (c) => {           // L5  ← यह export hona chahiye
  const validated = c.get('validated');        // L6
  const env = c.env;                           // L7
  const { admin_id, pattern, topic, tone } = validated; // L8
  const run_id = `RUN-${Date.now()}`;          // L9
  await logAudit(env, admin_id, 'RUN_STARTED', `pattern=${pattern} topic=${topic}`); // L10
  await env.PE_PROCESSOR.send({                // L11
    type: 'RUN',                               // L12
    run_id, admin_id, pattern, topic, tone,    // L13
    timestamp: new Date().toISOString()        // L14
  });                                          // L15
  return c.json({ success: true, run_id, message: 'Run queued' }, 200); // L16
};                                             // L17

// Optional: agar aap Hono app bhi export karna chahte ho toh alag se
// but main.js directly trigger import kar raha hai, so yeh sufficient hai.
