// ============================================================
// FILE: src/main.js
// VERSION: 1.0.0
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { validate } from './middleware/validator.js';
import { RunSchema } from './schemas/index.js';
import healthRoutes from './routes/health.js';
import { trigger } from './routes/run.js';             // named import
import adminRoutes from './routes/admins.js';
import pendingRoutes from './routes/pending.js';
import logsRoutes from './routes/logs.js';
import { processRun } from './pipeline.js';
import { logAudit } from './db.js';
import { sendTelegram } from './utils.js';

const app = new Hono();

// ---------- Global Middlewares ----------
app.use('*', cors());
app.use('*', async (c, next) => {
  c.set('requestId', `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await next();
});

// ---------- Global Error Handler ----------
app.onError(async (err, c) => {
  const requestId = c.get('requestId');
  const env = c.env;
  await logAudit(env, 'SYSTEM', 'UNHANDLED_ERROR', `[${requestId}] ${err.message}\n${err.stack}`);
  await sendTelegram(env, `🚨 CRITICAL ERROR\nRequest: ${requestId}\nError: ${err.message}\nStack: ${err.stack?.slice(0, 300)}`);
  return c.json({ error: 'Internal Server Error', requestId, message: err.message }, 500);
});

// ---------- Route Mounting ----------
app.route('/health', healthRoutes);
app.use('/admin/*', authMiddleware);
app.route('/admin', adminRoutes);
app.route('/admin', pendingRoutes);
app.route('/admin', logsRoutes);

// ---------- /run Route ----------
app.post('/run', authMiddleware, validate(RunSchema), trigger);

// ---------- Queue Consumer ----------
export default {
  fetch: app.fetch,

  async queue(batch, env) {
    console.log(`[Queue] Received ${batch.messages.length} message(s)`);
    for (const msg of batch.messages) {
      try {
        const data = msg.body;
        console.log(`[Queue] Processing message:`, JSON.stringify(data));
        if (data.type === 'RUN') {
          console.log(`[Queue] Calling processRun for run_id = ${data.run_id}`);
          await processRun(data, env);
          console.log(`[Queue] processRun completed for ${data.run_id}`);
        }
        msg.ack();
      } catch (e) {
        console.error(`[Queue] Error processing message:`, e);
        await logAudit(env, 'SYSTEM', 'QUEUE_ERROR', e.message);
        msg.retry();
      }
    }
  }
};
