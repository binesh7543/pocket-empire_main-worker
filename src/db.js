// ============================================================
// FILE: src/db.js
// LINE-NUMBERED FOR ERROR TRACKING
// ============================================================

import { json } from './utils.js';                // L1

// ---------- SCHEMA (split into separate statements for D1) ----------
export async function ensureSchema(env) {        // L4
  await env.DB.exec(`                            // L5
    CREATE TABLE IF NOT EXISTS admins (          // L6
      admin_id TEXT PRIMARY KEY,                 // L7
      name TEXT,                                 // L8
      tone TEXT DEFAULT 'hinglish',              // L9
      template_id TEXT DEFAULT 'DEFAULT',        // L10
      active INTEGER DEFAULT 1,                  // L11
      created_at TEXT                            // L12
    );                                           // L13
  `);                                            // L14
  await env.DB.exec(`                            // L16
    CREATE TABLE IF NOT EXISTS pending_posts (   // L17
      id INTEGER PRIMARY KEY AUTOINCREMENT,      // L18
      admin_id TEXT,                             // L19
      pattern INTEGER DEFAULT 1,                 // L20
      topic TEXT,                                // L21
      target_date TEXT,                          // L22
      status TEXT DEFAULT 'pending',             // L23
      created_at TEXT                            // L24
    );                                           // L25
  `);                                            // L26
  await env.DB.exec(`                            // L28
    CREATE TABLE IF NOT EXISTS event_registry (  // L29
      event_id TEXT PRIMARY KEY,                 // L30
      admin_id TEXT,                             // L31
      title TEXT,                                // L32
      published_url TEXT,                        // L33
      published_date TEXT,                       // L34
      pattern INTEGER,                           // L35
      tone TEXT,                                 // L36
      created_at TEXT                            // L37
    );                                           // L38
  `);                                            // L39
  await env.DB.exec(`                            // L41
    CREATE TABLE IF NOT EXISTS audit_log (       // L42
      id INTEGER PRIMARY KEY AUTOINCREMENT,      // L43
      admin_id TEXT,                             // L44
      action TEXT,                               // L45
      detail TEXT,                               // L46
      created_at TEXT                            // L47
    );                                           // L48
  `);                                            // L49
  await env.DB.exec(`                            // L51
    CREATE TABLE IF NOT EXISTS system_settings ( // L52
      key TEXT PRIMARY KEY,                      // L53
      value TEXT                                 // L54
    );                                           // L55
  `);                                            // L56
}                                                // L57

// ---------- AUDIT LOG ----------
export async function logAudit(env, admin_id, action, detail) { // L60
  try {                                           // L61
    await env.DB.prepare(                         // L62
      'INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?, ?, ?, ?)' // L63
    ).bind(admin_id || 'SYSTEM', action, detail || '', new Date().toISOString()).run(); // L64
  } catch (e) { /* silent fail */ }               // L65
}                                                 // L66

// ---------- ADMINS ----------
export async function getAdmins(env) {           // L69
  const rows = await env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all(); // L70
  return { admins: rows.results || [] };         // L71
}                                                // L72

export async function saveAdmin(env, body) {    // L74
  const { admin_id, name, tone = 'hinglish', template_id = 'DEFAULT', active = 1 } = body; // L75
  if (!admin_id || !name) return { error: 'admin_id and name required' }; // L76
  await env.DB.prepare(`                         // L77
    INSERT INTO admins (admin_id, name, tone, template_id, active, created_at) // L78
    VALUES (?, ?, ?, ?, ?, ?)                    // L79
    ON CONFLICT(admin_id) DO UPDATE SET          // L80
      name=excluded.name, tone=excluded.tone,    // L81
      template_id=excluded.template_id, active=excluded.active // L82
  `).bind(admin_id, name, tone, template_id, active, new Date().toISOString()).run(); // L83
  await logAudit(env, 'MASTER', 'ADMIN_SAVED', `admin_id=${admin_id}`); // L84
  return { success: true };                      // L85
}                                                // L86

export async function deleteAdmin(env, body) {  // L88
  const { admin_id } = body;                     // L89
  if (!admin_id) return { error: 'admin_id required' }; // L90
  await env.DB.prepare('DELETE FROM admins WHERE admin_id = ?').bind(admin_id).run(); // L91
  await logAudit(env, 'MASTER', 'ADMIN_DELETED', `admin_id=${admin_id}`); // L92
  return { success: true };                      // L93
}                                                // L94

// ---------- PENDING ----------
export async function getPending(env) {         // L97
  const rows = await env.DB.prepare(            // L98
    "SELECT * FROM pending_posts WHERE status='pending' ORDER BY target_date ASC" // L99
  ).all();                                      // L100
  return { pending: rows.results || [] };       // L101
}                                               // L102

export async function savePending(env, body) { // L104
  const { admin_id, pattern = 1, topic = '', target_date, immediate = false } = body; // L105
  if (immediate) {                             // L106
    const adminRow = await env.DB.prepare('SELECT * FROM admins WHERE admin_id = ?').bind(admin_id).first(); // L107
    const tone = adminRow?.tone || 'hinglish'; // L108
    await env.PE_PROCESSOR.send({              // L109
      type: 'RUN', run_id: `RUN-${Date.now()}`, // L110
      admin_id, pattern, topic, tone,          // L111
      timestamp: new Date().toISOString()      // L112
    });                                        // L113
    await logAudit(env, admin_id, 'IMMEDIATE_RUN', `pattern=${pattern}`); // L114
    return { success: true, queued: true };    // L115
  }                                            // L116
  await env.DB.prepare(`                       // L117
    INSERT INTO pending_posts (admin_id, pattern, topic, target_date, status, created_at) // L118
    VALUES (?, ?, ?, ?, 'pending', ?)          // L119
  `).bind(admin_id, pattern, topic, target_date || '', new Date().toISOString()).run(); // L120
  await logAudit(env, admin_id, 'PENDING_SAVED', `date=${target_date}`); // L121
  return { success: true };                    // L122
}                                              // L123

export async function cancelPending(env, body) { // L125
  const { id } = body;                         // L126
  await env.DB.prepare("UPDATE pending_posts SET status='cancelled' WHERE id=?").bind(id).run(); // L127
  await logAudit(env, 'MASTER', 'PENDING_CANCELLED', `id=${id}`); // L128
  return { success: true };                    // L129
}                                              // L130

// ---------- LOGS, EVENTS, SETTINGS ----------
export async function getLogs(env) {           // L133
  const rows = await env.DB.prepare('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100').all(); // L134
  return { logs: rows.results || [] };         // L135
}                                              // L136

export async function getEvents(env) {         // L138
  const rows = await env.DB.prepare('SELECT * FROM event_registry ORDER BY created_at DESC LIMIT 50').all(); // L139
  return { events: rows.results || [] };       // L140
}                                              // L141

export async function getSettings(env) {       // L143
  const rows = await env.DB.prepare('SELECT * FROM system_settings').all(); // L144
  const settings = {};                         // L145
  (rows.results || []).forEach(r => { settings[r.key] = r.value; }); // L146
  return { settings };                         // L147
}                                              // L148

export async function saveSettings(env, body) { // L150
  for (const [key, value] of Object.entries(body)) { // L151
    await env.DB.prepare(`                      // L152
      INSERT INTO system_settings (key, value) VALUES (?, ?) // L153
      ON CONFLICT(key) DO UPDATE SET value=excluded.value // L154
    `).bind(key, String(value)).run();         // L155
  }                                            // L156
  await logAudit(env, 'MASTER', 'SETTINGS_SAVED', JSON.stringify(body)); // L157
  return { success: true };                    // L158
}                                              // L159

export async function resetAll(env) {          // L161
  await env.DB.exec(`                          // L162
    DELETE FROM audit_log;                     // L163
    DELETE FROM event_registry;                // L164
    DELETE FROM pending_posts;                 // L165
  `);                                          // L166
  await logAudit(env, 'MASTER', 'RESET_ALL', 'Full reset performed'); // L167
  return { success: true };                    // L168
}                                              // L169
