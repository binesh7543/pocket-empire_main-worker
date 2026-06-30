// ============================================================
// FILE: src/telegram.js
// VERSION: 1.1.0
// Telegram Bot Handlers (Admin Commands)
// ============================================================

import { logAudit } from './db.js';

// ─── Webhook Entry Point ─────────────────────────────────────
export async function telegramWebhook(c) {
  const env = c.env;
  const body = await c.req.json();
  const message = body.message;
  if (!message) return c.json({ ok: true });

  const chatId = message.chat.id;
  const userId = message.from.id;
  const text = message.text || '';

  // ── Authorisation ──
  const allowed = (env.TELEGRAM_ADMIN_CHAT_ID || '').split(',').map(s => s.trim());
  if (!allowed.includes(String(chatId))) {
    await sendTelegram(env, '⛔ Unauthorized.', chatId);
    return c.json({ ok: true });
  }

  // ── Rate Limiting ──
  const cache = await env.PE_MEMORY; // use KV for rate limiting if PE_MEMORY exists, else skip
  const rateKey = `rate:${userId}`;
  let count = 0;
  if (cache) {
    const val = await cache.get(rateKey);
    count = val ? parseInt(val) : 0;
    if (count >= 10) {
      await sendTelegram(env, '⏳ Too many requests. Please wait a minute.', chatId);
      return c.json({ ok: true });
    }
    await cache.put(rateKey, String(count + 1), { expirationTtl: 60 });
  }

  // ── If not a command, send welcome ──
  if (!text.startsWith('/')) {
    await sendTelegram(env, getWelcomeMessage(), chatId);
    return c.json({ ok: true });
  }

  // ── Parse Command ──
  const parts = text.split(' ').filter(s => s.length);
  const cmd = parts[0].toLowerCase().replace('/', '');
  const args = parts.slice(1);
  let reply = '';

  // Helper to call Main Engine APIs
  const callMain = async (method, path, payload) => {
    const url = env.MAIN_ENGINE_URL + path;
    const token = env.MASTER_TOKEN;
    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: payload ? JSON.stringify(payload) : undefined
    });
    return res.json();
  };

  try {
    switch (cmd) {
      // ── HEALTH ──
      case 'health': {
        const data = await callMain('GET', '/health');
        reply = `✅ System OK\nStatus: ${data.status}\nDB: ${data.db}\nLogs: ${data.logs}`;
        break;
      }

      // ── RUN ── (with emergency stop check inside main.js)
      case 'run': {
        const admin = args[0] || 'DEFAULT';
        const pattern = parseInt(args[1]) || 1;
        const topic = args.slice(2).join(' ');
        const data = await callMain('POST', '/run', { admin_id: admin, pattern, topic });
        reply = data.success ? `✅ Run queued (ID: ${data.run_id})` : `❌ Failed: ${data.error || 'unknown'}`;
        break;
      }

      // ── EMERGENCY STOP ──
      case 'emergency-stop': {
        await env.PE_MEMORY.put('emergency_stop', 'true', { expirationTtl: 86400 * 30 }); // 30 days
        reply = '🛑 Emergency stop activated. All runs are blocked. Use /emergency-resume to restart.';
        break;
      }

      // ── EMERGENCY RESUME ──
      case 'emergency-resume': {
        await env.PE_MEMORY.delete('emergency_stop');
        reply = '✅ Emergency stop removed. System resumed.';
        break;
      }

      // ── ADMINS ──
      case 'admins': {
        const data = await callMain('GET', '/admin/admins');
        const list = data.admins || [];
        reply = list.length ? '👥 Admins:\n' + list.map(a => `- ${a.admin_id}: ${a.name} (${a.tone}) ${a.active ? '✅' : '❌'}`).join('\n') : 'No admins.';
        break;
      }

      case 'addadmin': {
        if (args.length < 5) { reply = 'Usage: /addadmin id name tone template active (active=1/0)'; break; }
        const data = await callMain('POST', '/admin/admins', {
          admin_id: args[0], name: args[1], tone: args[2], template_id: args[3], active: parseInt(args[4])
        });
        reply = data.success ? '✅ Admin saved.' : `❌ Failed: ${data.error}`;
        break;
      }

      case 'deladmin': {
        if (!args.length) { reply = 'Usage: /deladmin id'; break; }
        const data = await callMain('POST', '/admin/admins/delete', { admin_id: args[0] });
        reply = data.success ? '✅ Admin deleted.' : `❌ Failed: ${data.error}`;
        break;
      }

      // ── PENDING ──
      case 'pending': {
        const data = await callMain('GET', '/admin/pending');
        const list = data.pending || [];
        reply = list.length ? '📅 Pending:\n' + list.map(p => `- ID:${p.id} | ${p.target_date} | ${p.admin_id} | P${p.pattern} | ${p.topic || '—'}`).join('\n') : 'No pending posts.';
        break;
      }

      case 'schedule': {
        if (args.length < 4) { reply = 'Usage: /schedule admin pattern topic date (YYYY-MM-DD)'; break; }
        const topic = args.slice(2, -1).join(' ');
        const date = args[args.length-1];
        const data = await callMain('POST', '/admin/pending', {
          admin_id: args[0], pattern: parseInt(args[1]), topic, target_date: date
        });
        reply = data.success ? '✅ Scheduled.' : `❌ Failed: ${data.error}`;
        break;
      }

      case 'cancel': {
        if (!args.length) { reply = 'Usage: /cancel id'; break; }
        const data = await callMain('POST', '/admin/pending/cancel', { id: parseInt(args[0]) });
        reply = data.success ? '✅ Cancelled.' : `❌ Failed: ${data.error}`;
        break;
      }

      // ── EVENTS ──
      case 'events': {
        const data = await callMain('GET', '/admin/events');
        const list = data.events || [];
        reply = list.length ? '📰 Last 5:\n' + list.slice(0,5).map(e => `- ${e.title} (${e.published_date?.slice(0,10)})`).join('\n') : 'No events.';
        break;
      }

      // ── LOGS ──
      case 'logs': {
        const limit = args[0] ? parseInt(args[0]) : 10;
        const data = await callMain('GET', `/admin/logs?limit=${limit}`);
        const list = data.logs || [];
        reply = list.length ? '📋 Logs:\n' + list.map(l => `- ${l.action}: ${l.detail || ''} (${l.created_at?.slice(11,19)})`).join('\n') : 'No logs.';
        break;
      }

      // ── SETTINGS ──
      case 'settings': {
        if (!args.length) {
          const data = await callMain('GET', '/admin/settings');
          reply = 'Settings:\n' + Object.entries(data.settings || {}).map(([k,v]) => `- ${k}: ${v}`).join('\n');
        } else if (args.length === 1) {
          const data = await callMain('GET', '/admin/settings');
          reply = `${args[0]}: ${data.settings?.[args[0]] || 'not set'}`;
        } else {
          const data = await callMain('POST', '/admin/settings', { [args[0]]: args.slice(1).join(' ') });
          reply = data.success ? '✅ Settings updated.' : `❌ Failed: ${data.error}`;
        }
        break;
      }

      // ── RESET ──
      case 'reset': {
        if (args.length && args[0] === 'confirm') {
          const data = await callMain('POST', '/admin/reset-all');
          reply = data.success ? '✅ All data reset.' : `❌ Failed: ${data.error}`;
        } else {
          reply = '⚠️ WARNING: This will delete all logs, events, and pending posts. Send `/reset confirm` to proceed.';
        }
        break;
      }

      default:
        reply = '❓ Unknown command. Send / to see help.';
    }

    await sendTelegram(env, reply, chatId);
    await logAudit(env, 'TELEGRAM', `CMD_${cmd}`, `User: ${userId}, Chat: ${chatId}`);

  } catch (err) {
    await sendTelegram(env, `❌ Error: ${err.message}`, chatId);
    await logAudit(env, 'TELEGRAM', 'ERROR', err.message);
  }

  return c.json({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────
async function sendTelegram(env, text, chatId) {
  const token = env.TELEGRAM_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
  });
}

function getWelcomeMessage() {
  return `🤖 <b>Pocket Empire Admin Bot</b>

Commands:
/health – check system
/run [admin] [pattern] [topic] – trigger pipeline
/emergency-stop – halt all runs immediately
/emergency-resume – resume normal operation
/admins – list all admins
/addadmin id name tone template active – add/update admin
/deladmin id – delete admin
/pending – list scheduled posts
/schedule admin pattern topic date – schedule post
/cancel id – cancel scheduled post
/events – list published posts
/logs [n] – show last n logs
/settings [key] [value] – get/set settings
/reset – reset all data (confirm)`;
          }

