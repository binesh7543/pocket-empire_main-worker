import { ensureSchema, logAudit, getAdmins, saveAdmin, deleteAdmin, getPending, savePending, cancelPending, getLogs, getEvents, getSettings, saveSettings, resetAll } from './db.js';
import { processRun } from './pipeline.js';
import { json, sendTelegram } from './utils.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      await ensureSchema(env);

      const auth = request.headers.get('Authorization') || '';
      const token = auth.replace('Bearer ', '').trim();
      const isAuthorized = token === env.MASTER_TOKEN;
      const requireAuth = () => {
        if (!isAuthorized) return json({ error: 'Unauthorized' }, 401, corsHeaders);
        return null;
      };

      // Health
      if (path === '/health' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        const dbCheck = await env.DB.prepare('SELECT COUNT(*) as c FROM audit_log').first();
        return json({ status: 'OK', version: 'v5.0', db: 'connected', logs: dbCheck?.c || 0, timestamp: new Date().toISOString() }, 200, corsHeaders);
      }

      // Run
      if (path === '/run' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        const { admin_id = 'DEFAULT', pattern = 1, topic = '', tone = 'hinglish' } = body;
        const run_id = `RUN-${Date.now()}`;
        await logAudit(env, admin_id, 'RUN_STARTED', `pattern=${pattern} topic=${topic}`);
        await env.PE_PROCESSOR.send({ type: 'RUN', run_id, admin_id, pattern, topic, tone, timestamp: new Date().toISOString() });
        return json({ success: true, run_id, message: 'Run queued' }, 200, corsHeaders);
      }

      // Admin routes
      if (path === '/admin/admins' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        return getAdmins(env, corsHeaders);
      }
      if (path === '/admin/admins' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        return saveAdmin(env, body, corsHeaders);
      }
      if (path === '/admin/admins/delete' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        return deleteAdmin(env, body, corsHeaders);
      }
      if (path === '/admin/pending' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        return getPending(env, corsHeaders);
      }
      if (path === '/admin/pending' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        return savePending(env, body, corsHeaders);
      }
      if (path === '/admin/pending/cancel' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        return cancelPending(env, body, corsHeaders);
      }
      if (path === '/admin/logs' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        return getLogs(env, corsHeaders);
      }
      if (path === '/admin/events' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        return getEvents(env, corsHeaders);
      }
      if (path === '/admin/settings' && request.method === 'GET') {
        const err = requireAuth();
        if (err) return err;
        return getSettings(env, corsHeaders);
      }
      if (path === '/admin/settings' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        const body = await request.json();
        return saveSettings(env, body, corsHeaders);
      }
      if (path === '/admin/reset-all' && request.method === 'POST') {
        const err = requireAuth();
        if (err) return err;
        return resetAll(env, corsHeaders);
      }

      return json({ error: 'Not Found' }, 404, corsHeaders);
    } catch (e) {
      await logAudit(env, 'SYSTEM', 'ERROR', e.message);
      return json({ error: e.message }, 500, corsHeaders);
    }
  },

  async queue(batch, env) {
    for (const msg of batch.messages) {
      try {
        const data = msg.body;
        if (data.type === 'RUN') {
          await processRun(data, env);
        }
        msg.ack();
      } catch (e) {
        msg.retry();
      }
    }
  }
};
