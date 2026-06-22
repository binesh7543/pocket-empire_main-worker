import { json } from './utils.js';

export async function ensureSchema(env) {
  await env.DB.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      admin_id TEXT PRIMARY KEY,
      name TEXT,
      tone TEXT DEFAULT 'hinglish',
      template_id TEXT DEFAULT 'DEFAULT',
      active INTEGER DEFAULT 1,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS pending_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      pattern INTEGER DEFAULT 1,
      topic TEXT,
      target_date TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS event_registry (
      event_id TEXT PRIMARY KEY,
      admin_id TEXT,
      title TEXT,
      published_url TEXT,
      published_date TEXT,
      pattern INTEGER,
      tone TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id TEXT,
      action TEXT,
      detail TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export async function logAudit(env, admin_id, action, detail) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?, ?, ?, ?)'
    ).bind(admin_id || 'SYSTEM', action, detail || '', new Date().toISOString()).run();
  } catch (e) { /* silent fail */ }
}

// Admins
export async function getAdmins(env, corsHeaders) {
  const rows = await env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  return json({ admins: rows.results || [] }, 200, corsHeaders);
}

export async function saveAdmin(env, body, corsHeaders) {
  const { admin_id, name, tone = 'hinglish', template_id = 'DEFAULT', active = 1 } = body;
  if (!admin_id || !name) return json({ error: 'admin_id and name required' }, 400, corsHeaders);
  await env.DB.prepare(`
    INSERT INTO admins (admin_id, name, tone, template_id, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(admin_id) DO UPDATE SET
      name=excluded.name, tone=excluded.tone,
      template_id=excluded.template_id, active=excluded.active
  `).bind(admin_id, name, tone, template_id, active, new Date().toISOString()).run();
  await logAudit(env, 'MASTER', 'ADMIN_SAVED', `admin_id=${admin_id}`);
  return json({ success: true }, 200, corsHeaders);
}

export async function deleteAdmin(env, body, corsHeaders) {
  const { admin_id } = body;
  if (!admin_id) return json({ error: 'admin_id required' }, 400, corsHeaders);
  await env.DB.prepare('DELETE FROM admins WHERE admin_id = ?').bind(admin_id).run();
  await logAudit(env, 'MASTER', 'ADMIN_DELETED', `admin_id=${admin_id}`);
  return json({ success: true }, 200, corsHeaders);
}

// Pending
export async function getPending(env, corsHeaders) {
  const rows = await env.DB.prepare(
    "SELECT * FROM pending_posts WHERE status='pending' ORDER BY target_date ASC"
  ).all();
  return json({ pending: rows.results || [] }, 200, corsHeaders);
}

export async function savePending(env, body, corsHeaders) {
  const { admin_id, pattern = 1, topic = '', target_date, immediate = false } = body;
  if (immediate) {
    const adminRow = await env.DB.prepare('SELECT * FROM admins WHERE admin_id = ?').bind(admin_id).first();
    const tone = adminRow?.tone || 'hinglish';
    await env.PE_PROCESSOR.send({
      type: 'RUN', run_id: `RUN-${Date.now()}`,
      admin_id, pattern, topic, tone,
      timestamp: new Date().toISOString()
    });
    await logAudit(env, admin_id, 'IMMEDIATE_RUN', `pattern=${pattern}`);
    return json({ success: true, queued: true }, 200, corsHeaders);
  }
  await env.DB.prepare(`
    INSERT INTO pending_posts (admin_id, pattern, topic, target_date, status, created_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).bind(admin_id, pattern, topic, target_date || '', new Date().toISOString()).run();
  await logAudit(env, admin_id, 'PENDING_SAVED', `date=${target_date}`);
  return json({ success: true }, 200, corsHeaders);
}

export async function cancelPending(env, body, corsHeaders) {
  const { id } = body;
  await env.DB.prepare("UPDATE pending_posts SET status='cancelled' WHERE id=?").bind(id).run();
  await logAudit(env, 'MASTER', 'PENDING_CANCELLED', `id=${id}`);
  return json({ success: true }, 200, corsHeaders);
}

// Logs, Events, Settings
export async function getLogs(env, corsHeaders) {
  const rows = await env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all();
  return json({ logs: rows.results || [] }, 200, corsHeaders);
}

export async function getEvents(env, corsHeaders) {
  const rows = await env.DB.prepare('SELECT * FROM event_registry ORDER BY created_at DESC LIMIT 50').all();
  return json({ events: rows.results || [] }, 200, corsHeaders);
}

export async function getSettings(env, corsHeaders) {
  const rows = await env.DB.prepare('SELECT * FROM system_settings').all();
  const settings = {};
  (rows.results || []).forEach(r => { settings[r.key] = r.value; });
  return json({ settings }, 200, corsHeaders);
}

export async function saveSettings(env, body, corsHeaders) {
  for (const [key, value] of Object.entries(body)) {
    await env.DB.prepare(`
      INSERT INTO system_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).bind(key, String(value)).run();
  }
  await logAudit(env, 'MASTER', 'SETTINGS_SAVED', JSON.stringify(body));
  return json({ success: true }, 200, corsHeaders);
}

export async function resetAll(env, corsHeaders) {
  await env.DB.exec(`
    DELETE FROM audit_log;
    DELETE FROM event_registry;
    DELETE FROM pending_posts;
  `);
  await logAudit(env, 'MASTER', 'RESET_ALL', 'Full reset performed');
  return json({ success: true }, 200, corsHeaders);
}
