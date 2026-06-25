// ============================================================
// FILE: src/routes/run.js
// ============================================================

import { Hono } from 'hono';                    // L1
import { logAudit } from '../db.js';           // L2

const app = new Hono();                         // L4

export const trigger = async (c) => {           // L6  ← exported handler
  const validated = c.get('validated');        // L7
  const env = c.env;                           // L8
  const { admin_id, pattern, topic, tone } = validated; // L9
  const run_id = `RUN-${Date.now()}`;          // L10
  await logAudit(env, admin_id, 'RUN_STARTED', `pattern=${pattern} topic=${topic}`); // L11
  await env.PE_PROCESSOR.send({                // L12
    type: 'RUN',                               // L13
    run_id, admin_id, pattern, topic, tone,    // L14
    timestamp: new Date().toISOString()        // L15
  });                                          // L16
  return c.json({ success: true, run_id, message: 'Run queued' }, 200); // L17
};                                             // L18

app.post('/', trigger);                        // L20
export default app;                            // L21
