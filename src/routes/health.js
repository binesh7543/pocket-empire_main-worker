// ============================================================
// FILE: src/routes/health.js
// ============================================================

import { Hono } from 'hono';                    // L1
const app = new Hono();                         // L2

app.get('/', async (c) => {                     // L4
  const env = c.env;                           // L5
  const dbCheck = await env.DB.prepare('SELECT COUNT(*) as c FROM audit_log').first(); // L6
  return c.json({                              // L7
    status: 'OK',                              // L8
    version: 'v5.1',                           // L9
    db: 'connected',                           // L10
    logs: dbCheck?.c || 0,                     // L11
    timestamp: new Date().toISOString()        // L12
  }, 200);                                     // L13
});                                            // L14

export default app;                            // L16
