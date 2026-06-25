// ============================================================
// FILE: src/main.js
// LINE-NUMBERED FOR ERROR TRACKING
// ============================================================

import { Hono } from 'hono';                       // L1
import { cors } from 'hono/cors';                 // L2
import { authMiddleware } from './middleware/auth.js'; // L3
import { validate } from './middleware/validator.js';   // L4
import { RunSchema } from './schemas/index.js';   // L5
import healthRoutes from './routes/health.js';    // L6
import runRoutes from './routes/run.js';          // L7
import adminRoutes from './routes/admins.js';     // L8
import pendingRoutes from './routes/pending.js';  // L9
import logsRoutes from './routes/logs.js';        // L10
import { processRun } from './pipeline.js';       // L11
import { logAudit } from './db.js';               // L12
import { sendTelegram } from './utils.js';        // L13

const app = new Hono();                           // L15

// Global middlewares
app.use('*', cors());                             // L18
app.use('*', async (c, next) => {                 // L19
  c.set('requestId', `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`); // L20
  await next();                                   // L21
});                                               // L22

// ---------- GLOBAL ERROR HANDLER (L24–L38) ----------
app.onError(async (err, c) => {                   // L24
  const requestId = c.get('requestId');           // L25
  const env = c.env;                             // L26
  await logAudit(env, 'SYSTEM', 'UNHANDLED_ERROR', `[${requestId}] ${err.message}\n${err.stack}`); // L27
  await sendTelegram(env, `🚨 CRITICAL ERROR\nRequest: ${requestId}\nError: ${err.message}\nStack: ${err.stack?.slice(0, 300)}`); // L28
  return c.json({ error: 'Internal Server Error', requestId, message: err.message }, 500); // L29
});                                               // L30

// ---------- ROUTES ----------
app.route('/health', healthRoutes);               // L33
app.use('/admin/*', authMiddleware);              // L34
app.route('/admin', adminRoutes);                 // L35
app.route('/admin', pendingRoutes);               // L36
app.route('/admin', logsRoutes);                  // L37
app.post('/run', authMiddleware, validate(RunSchema), runRoutes.trigger); // L38

// ---------- QUEUE CONSUMER (L41–L53) ----------
export default {                                  // L41
  fetch: app.fetch,                               // L42
  async queue(batch, env) {                       // L43
    for (const msg of batch.messages) {           // L44
      try {                                       // L45
        const data = msg.body;                    // L46
        if (data.type === 'RUN') {                // L47
          await processRun(data, env);            // L48
        }                                         // L49
        msg.ack();                                // L50
      } catch (e) {                               // L51
        await logAudit(env, 'SYSTEM', 'QUEUE_ERROR', e.message); // L52
        msg.retry();                              // L53
      }                                           // L54
    }                                             // L55
  }                                               // L56
};                                                // L57
