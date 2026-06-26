// ============================================================
// FILE: src/main.js
// VERSION: 1.0.0
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

// ─── HONO APP SETUP ──────────────────────────────────────────
const app = new Hono();

// Global middlewares
app.use('*', cors());
app.use('*', async (c, next) => {
  c.set('requestId', `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  await next();
});

// Global error handler
app.onError(async (err, c) => {
  const requestId = c.get('requestId');
  const env = c.env;
  await logAudit(env, 'SYSTEM', 'UNHANDLED_ERROR', `[${requestId}] ${err.message}\n${err.stack}`);
  await sendTelegram(env, `🚨 CRITICAL ERROR\nRequest: ${requestId}\nError: ${err.message}\nStack: ${err.stack?.slice(0, 300)}`);
  return c.json({ error: 'Internal Server Error', requestId, message: err.message }, 500);
});

// ─── ROUTES ───────────────────────────────────────────────────
app.route('/health', healthRoutes);
app.use('/admin/*', authMiddleware);
app.route('/admin', adminRoutes);
app.route('/admin', pendingRoutes);
app.route('/admin', logsRoutes);
app.post('/run', authMiddleware, validate(RunSchema), trigger);

// ─── EXPORT DEFAULT (fetch, queue, scheduled) ──────────────
export default {
  fetch: app.fetch,

  // ─── QUEUE CONSUMER ──────────────────────────────────────
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
  },

  // ─── SCHEDULED CRON (Daily 2:00 AM IST) ──────────────────
  async scheduled(event, env, ctx) {
    console.log('[Cron] Starting scheduled job...');
    const today = new Date().toISOString().slice(0, 10);
    try {
      // 1. Check pending posts for today
      const pendingRows = await env.DB.prepare(
        "SELECT * FROM pending_posts WHERE status='pending' AND target_date = ?"
      ).bind(today).all();
      const pending = pendingRows.results || [];

      if (pending.length > 0) {
        console.log(`[Cron] Found ${pending.length} pending posts for ${today}`);
        for (const post of pending) {
          // Fetch admin tone
          const adminRow = await env.DB.prepare(
            "SELECT * FROM admins WHERE admin_id = ?"
          ).bind(post.admin_id).first();
          const tone = adminRow?.tone || 'hinglish';
          
          // Trigger run
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
        // 2. No pending → default run
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
