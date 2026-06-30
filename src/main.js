// ============================================================
// FILE: src/main.js
// VERSION: 1.1.0
// Pocket Empire v5 — Main Engine
// ============================================================

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth.js';
import { validate } from './middleware/validator.js';
import { RunSchema } from './schemas/index.js';
import healthRoutes from './routes/health.js';
import { trigger } from './routes/run.js';
import adminRoutes from './routes/admins.js';
import pendingRoutes from './routes/pending.js';
import logsRoutes from './routes/logs.js';
import { processRun } from './pipeline.js';
import { logAudit } from './db.js';
import { sendTelegram } from './utils.js';
import { json } from './utils.js';

const app = new Hono();

// ─── Global Middlewares ──────────────────────────────────────────
app.use('*', cors());
app.use('*', async (c, next) => {
  c.set('requestId', `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await next();
});

// ─── Global Error Handler ────────────────────────────────────────
app.onError(async (err, c) => {
  const requestId = c.get('requestId');
  const env = c.env;
  await logAudit(env, 'SYSTEM', 'UNHANDLED_ERROR', `[${requestId}] ${err.message}\n${err.stack}`);
  await sendTelegram(env, `🚨 CRITICAL ERROR\nRequest: ${requestId}\nError: ${err.message}\nStack: ${err.stack?.slice(0, 300)}`);
  return c.json({ error: 'Internal Server Error', requestId, message: err.message }, 500);
});

// ─── ROUTES ──────────────────────────────────────────────────────
app.route('/health', healthRoutes);
app.use('/admin/*', authMiddleware);
app.route('/admin', adminRoutes);
app.route('/admin', pendingRoutes);
app.route('/admin', logsRoutes);

// ─── /run ROUTE with emergency stop check ──────────────────────
app.post('/run', authMiddleware, validate(RunSchema), async (c, next) => {
  const env = c.env;
  const emergency = await env.PE_MEMORY?.get('emergency_stop');
  if (emergency === 'true') {
    return c.json({ error: 'System is in emergency stop mode. Use /emergency-resume to restart.' }, 503);
  }
  await next();
}, trigger);

// ─── EXPORT DEFAULT (fetch, queue, scheduled) ──────────────────
export default {
  fetch: app.fetch,

  // ─── QUEUE CONSUMER (with retry limit) ──────────────────────
  async queue(batch, env) {
    console.log(`[Queue] Received ${batch.messages.length} message(s)`);
    for (const msg of batch.messages) {
      try {
        // Check emergency stop
        const emergency = await env.PE_MEMORY?.get('emergency_stop');
        if (emergency === 'true') {
          console.log('[Queue] Skipping – emergency stop active');
          msg.ack();
          continue;
        }

        // Retry limit: max 2 attempts
        if (msg.retryCount >= 2) {
          console.error(`[Queue] Max retries exhausted for ${msg.id}. Logging error.`);
          await logAudit(env, 'SYSTEM', 'QUEUE_MAX_RETRY', `msgId=${msg.id}, body=${JSON.stringify(msg.body)}`);
          await sendTelegram(env, `❌ Queue message failed after 2 retries.\nID: ${msg.id}\nBody: ${JSON.stringify(msg.body)}`);
          msg.ack(); // stop retrying
          continue;
        }

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
        // Cloudflare will automatically retry on unhandled exception; we don't call msg.retry()
        // The retryCount will increment, and we check it above.
        // We log the error but don't ack – it will retry.
        await logAudit(env, 'SYSTEM', 'QUEUE_ERROR', e.message);
        // Do NOT ack – will retry automatically
      }
    }
  },

  // ─── SCHEDULED CRON (with emergency stop) ────────────────────
  async scheduled(event, env, ctx) {
    console.log('[Cron] Starting scheduled job...');

    // Check emergency stop
    const emergency = await env.PE_MEMORY?.get('emergency_stop');
    if (emergency === 'true') {
      console.log('[Cron] Skipped – emergency stop active');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    try {
      const pendingRows = await env.DB.prepare(
        "SELECT * FROM pending_posts WHERE status='pending' AND target_date = ?"
      ).bind(today).all();
      const pending = pendingRows.results || [];

      if (pending.length > 0) {
        console.log(`[Cron] Found ${pending.length} pending posts for ${today}`);
        for (const post of pending) {
          const adminRow = await env.DB.prepare(
            "SELECT * FROM admins WHERE admin_id = ?"
          ).bind(post.admin_id).first();
          const tone = adminRow?.tone || 'hinglish';

          await processRun({
            run_id: `CRON-${Date.now()}-${post.id}`,
            admin_id: post.admin_id,
            pattern: post.pattern,
            topic: post.topic || '',
            tone: tone,
            timestamp: new Date().toISOString()
          }, env);
        }
        await logAudit(env, 'SYSTEM', 'CRON_PENDING_TRIGGERED', `count=${pending.length}`);
      } else {
        console.log('[Cron] No pending posts, running default');
        await processRun({
          run_id: `CRON-${Date.now()}`,
          admin_id: 'DEFAULT',
          pattern: 1,
          topic: '',
          tone: 'hinglish',
          timestamp: new Date().toISOString()
        }, env);
        await logAudit(env, 'SYSTEM', 'CRON_DEFAULT_RUN', 'No pending posts');
      }
      console.log('[Cron] Finished successfully');
    } catch (e) {
      console.error('[Cron] Error:', e);
      await logAudit(env, 'SYSTEM', 'CRON_ERROR', e.message);
    }
  }
};
