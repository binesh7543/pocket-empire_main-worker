// ============================================================
// POCKET EMPIRE v5 — MAIN ENGINE (pocket-empire worker)
// Bindings: DB (D1), AI (Workers AI), PE_COLLECTOR (Queue),
//           PE_PROCESSOR (Queue), PE_PUBLISHER (Queue)
// Env Vars: MASTER_TOKEN, TELEGRAM_TOKEN, TELEGRAM_CHAT_ID,
//           APPS_SCRIPT_URL, GROQ_API_KEY, OPENROUTER_API_KEY,
//           UNSPLASH_ACCESS_KEY, MARKETAUX_API_KEY
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Auto-migrate DB on every cold start
      await ensureSchema(env);

      // Route
      if (path === '/health' && request.method === 'GET') {
        return handleHealth(request, env, corsHeaders);
      }
      if (path === '/run' && request.method === 'POST') {
        return handleRun(request, env, ctx, corsHeaders);
      }
      if (path === '/admin/admins' && request.method === 'GET') {
        return handleGetAdmins(request, env, corsHeaders);
      }
      if (path === '/admin/admins' && request.method === 'POST') {
        return handleSaveAdmin(request, env, corsHeaders);
      }
      if (path === '/admin/admins/delete' && request.method === 'POST') {
        return handleDeleteAdmin(request, env, corsHeaders);
      }
      if (path === '/admin/pending' && request.method === 'GET') {
        return handleGetPending(request, env, corsHeaders);
      }
      if (path === '/admin/pending' && request.method === 'POST') {
        return handleSavePending(request, env, corsHeaders);
      }
      if (path === '/admin/pending/cancel' && request.method === 'POST') {
        return handleCancelPending(request, env, corsHeaders);
      }
      if (path === '/admin/logs' && request.method === 'GET') {
        return handleGetLogs(request, env, corsHeaders);
      }
      if (path === '/admin/events' && request.method === 'GET') {
        return handleGetEvents(request, env, corsHeaders);
      }
      if (path === '/admin/settings' && request.method === 'GET') {
        return handleGetSettings(request, env, corsHeaders);
      }
      if (path === '/admin/settings' && request.method === 'POST') {
        return handleSaveSettings(request, env, corsHeaders);
      }
      if (path === '/admin/reset-all' && request.method === 'POST') {
        return handleResetAll(request, env, corsHeaders);
      }

      return json({ error: 'Not Found' }, 404, corsHeaders);

    } catch (e) {
      await logAudit(env, 'SYSTEM', 'ERROR', e.message);
      return json({ error: e.message }, 500, corsHeaders);
    }
  },

  // Queue consumer
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
  },

  // Daily cron — handled by Admin Engine
  // Main Engine has no cron
};

// ============================================================
// SCHEMA — Auto Migration
// ============================================================
async function ensureSchema(env) {
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS admins (admin_id TEXT PRIMARY KEY, name TEXT, tone TEXT DEFAULT 'hinglish', template_id TEXT DEFAULT 'DEFAULT', active INTEGER DEFAULT 1, created_at TEXT)`);
  
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS pending_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT, pattern INTEGER DEFAULT 1, topic TEXT, target_date TEXT, status TEXT DEFAULT 'pending', created_at TEXT)`);
  
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS event_registry (event_id TEXT PRIMARY KEY, admin_id TEXT, title TEXT, published_url TEXT, published_date TEXT, pattern INTEGER, tone TEXT, created_at TEXT)`);
  
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, admin_id TEXT, action TEXT, detail TEXT, created_at TEXT)`);
  
  await env.DB.exec(`CREATE TABLE IF NOT EXISTS system_settings (key TEXT PRIMARY KEY, value TEXT)`);
}
// ============================================================
// AUTH — Verify Master Token
// ============================================================
function verifyAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace('Bearer ', '').trim();
  return token === env.MASTER_TOKEN;
}

// ============================================================
// HEALTH CHECK
// ============================================================
async function handleHealth(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const dbCheck = await env.DB.prepare('SELECT COUNT(*) as c FROM audit_log').first();
  return json({
    status: 'OK',
    version: 'v5.0',
    db: 'connected',
    logs: dbCheck?.c || 0,
    timestamp: new Date().toISOString()
  }, 200, corsHeaders);
}

// ============================================================
// RUN — Main Content Pipeline
// ============================================================
async function handleRun(request, env, ctx, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);

  const body = await request.json();
  const { admin_id = 'DEFAULT', pattern = 1, topic = '', tone = 'hinglish' } = body;

  const run_id = `RUN-${Date.now()}`;
  await logAudit(env, admin_id, 'RUN_STARTED', `pattern=${pattern} topic=${topic}`);

  // Push to queue — non-blocking
  await env.PE_PROCESSOR.send({
    type: 'RUN',
    run_id,
    admin_id,
    pattern,
    topic,
    tone,
    timestamp: new Date().toISOString()
  });

  return json({ success: true, run_id, message: 'Run queued' }, 200, corsHeaders);
}

// ============================================================
// PROCESS RUN — Queue Consumer (Core Pipeline)
// ============================================================
async function processRun(data, env) {
  const { run_id, admin_id, pattern, topic, tone } = data;

  try {
    // Step 1: Fetch news
    await logAudit(env, admin_id, 'PE-WK-COLLECT-001', 'Fetching news');
    const news = await fetchNews(env, topic);

    if (!news || news.length === 0) {
      await logAudit(env, admin_id, 'PE-FB-NOSRC-101', 'No news found, using fallback');
    }

    // Step 2: Select hero event
    await logAudit(env, admin_id, 'PE-WK-EVENT-003', 'Selecting hero event');
    const hero = news[0] || { title: topic || 'Indian Market Update', description: '' };

    // Step 3: Generate SEO
    await logAudit(env, admin_id, 'PE-WK-PUBLISH-008', 'Generating SEO + Content');
    const seoTitle = await generateSEO(env, hero.title, tone);

    // Step 4: Generate content
    const content = await generateContent(env, hero, tone, pattern);

    // Step 5: Fetch market data
    const marketData = await fetchMarketData(env);

    // Step 6: Generate image
    const heroImg = await generateImage(env, seoTitle);

    // Step 7: Build event ID
    const event_id = makeEventId();

    // Step 8: Get admin template
    const adminRow = await env.DB.prepare(
      'SELECT * FROM admins WHERE admin_id = ?'
    ).bind(admin_id).first();
    const template_id = adminRow?.template_id || 'DEFAULT';

    // Step 9: Send to Apps Script
    await logAudit(env, admin_id, 'PE-WK-PUBLISH-008', 'Sending to Apps Script');
    const publishResult = await sendToAppsScript(env, {
      title: seoTitle,
      html: content,
      labels: extractLabels(hero.title, tone),
      admin_id,
      template_id,
      event_id,
      run_id,
      pattern,
      tone,
      hero_img: heroImg,
      market_data: marketData
    });

    // Step 10: Log to event_registry
    if (publishResult?.url) {
      await env.DB.prepare(`
        INSERT INTO event_registry (event_id, admin_id, title, published_url, published_date, pattern, tone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(event_id, admin_id, seoTitle, publishResult.url, new Date().toISOString(), pattern, tone, new Date().toISOString()).run();
    }

    await logAudit(env, admin_id, 'PE-WK-AUDIT-009', `Published: ${publishResult?.url}`);

    // Telegram notification
    await sendTelegram(env, `✅ Pocket Empire v5\nRun: ${run_id}\nTitle: ${seoTitle}\nURL: ${publishResult?.url || 'N/A'}`);

  } catch (e) {
    await logAudit(env, admin_id, 'PE-ER-PIPELINE', e.message);
    await sendTelegram(env, `❌ PE v5 Error\nRun: ${run_id}\nError: ${e.message}`);
  }
}

// ============================================================
// AI — 3-Layer Fallback (Groq → OpenRouter → CF AI)
// ============================================================
async function callAI(env, prompt, systemPrompt = '') {
  // Layer 1: Groq
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch (e) { /* fallthrough */ }

  // Layer 2: OpenRouter
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://pocket-empire.xdigi7851.workers.dev'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-7b-instruct',
        messages: [
          { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices[0].message.content;
    }
  } catch (e) { /* fallthrough */ }

  // Layer 3: CF Workers AI
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1500
  });
  return response.response;
}

// ============================================================
// SEO GENERATION
// ============================================================
async function generateSEO(env, headline, tone) {
  const toneGuide = getToneGuide(tone);
  const prompt = `Create an SEO-optimized blog post title for Indian finance audience.
Headline: "${headline}"
Language style: ${toneGuide}
Rules:
- Max 65 characters
- Include power words
- Target Indian retail investors
- No clickbait
Return ONLY the title, nothing else.`;

  const title = await callAI(env, prompt);
  return title.trim().replace(/^["']|["']$/g, '');
}

// ============================================================
// CONTENT GENERATION — Dynamic Tone + Pattern
// ============================================================
async function generateContent(env, hero, tone, pattern) {
  const toneGuide = getToneGuide(tone);
  const sections = pattern >= 3 ? 6 : pattern === 2 ? 5 : 4;
  const wordLimit = pattern >= 3 ? 200 : pattern === 2 ? 180 : 150;

  const prompt = `Write a ${sections}-section finance blog article for Indian retail investors.
Topic: "${hero.title}"
Background: "${hero.description || ''}"
Language: ${toneGuide}
Each section: ~${wordLimit} words
Structure:
1. Hook — grab attention
2. Kya Hua — what happened
3. Tumse Connection — how it affects reader
4. Market Snapshot — key numbers (use HTML table)
5. Expert Take — analysis
${sections >= 6 ? '6. Close — call to action' : ''}

Format as clean HTML sections with <div class="section"> tags.
Use <strong> for key terms.
Return ONLY the HTML content.`;

  return await callAI(env, prompt);
}

// ============================================================
// TONE GUIDE
// ============================================================
function getToneGuide(tone) {
  const guides = {
    hinglish: 'Hinglish (Hindi + English mix) — casual, relatable for Indian readers, use common Hindi phrases naturally',
    formal: 'Formal English — professional, authoritative, suitable for business readers',
    casual: 'Casual Hinglish — very friendly, like talking to a friend, simple language',
    english: 'Pure English — clear, concise, international style'
  };
  return guides[tone] || guides.hinglish;
}

// ============================================================
// NEWS FETCHING — Marketaux
// ============================================================
async function fetchNews(env, topic = '') {
  try {
    const query = topic || 'Indian stock market Nifty Sensex RBI economy';
    const res = await fetch(
      `https://api.marketaux.com/v1/news/all?api_token=${env.MARKETAUX_API_KEY}&language=en&countries=in&filter_entities=true&search=${encodeURIComponent(query)}&limit=5`
    );
    if (res.ok) {
      const data = await res.json();
      return (data.data || []).map(a => ({
        title: a.title,
        description: a.description || a.snippet || '',
        url: a.url
      }));
    }
  } catch (e) { /* fallthrough */ }
  return [];
}

// ============================================================
// MARKET DATA
// ============================================================
async function fetchMarketData(env) {
  // Basic market data — can be enhanced
  return {
    nifty: 'N/A',
    sensex: 'N/A',
    gold: 'N/A',
    usd_inr: 'N/A'
  };
}

// ============================================================
// IMAGE GENERATION — Pollinations
// ============================================================
async function generateImage(env, title) {
  const prompt = encodeURIComponent(`Indian stock market finance concept: ${title}, professional, dark gold theme`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`;
}

// ============================================================
// LABELS EXTRACTION
// ============================================================
function extractLabels(title, tone) {
  const keywords = ['RBI', 'Nifty', 'Sensex', 'FII', 'GDP', 'Inflation', 'Budget', 'SEBI', 'Gold', 'Dollar'];
  const found = keywords.filter(k => title.toLowerCase().includes(k.toLowerCase()));
  if (found.length === 0) found.push('Indian Market');
  found.push(tone === 'english' ? 'English' : 'Hinglish');
  return found;
}

// ============================================================
// EVENT ID
// ============================================================
function makeEventId() {
  const d = new Date();
  const date = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `EVT-${date}-${rand}`;
}

// ============================================================
// APPS SCRIPT PUBLISHER
// ============================================================
async function sendToAppsScript(env, payload) {
  try {
    const res = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        api_key: env.MASTER_TOKEN,
        title: payload.title,
        html: payload.html,
        labels: payload.labels,
        admin_id: payload.admin_id,
        template_id: payload.template_id,
        event_id: payload.event_id,
        run_id: payload.run_id,
        pattern: payload.pattern,
        tone: payload.tone,
        hero_img: payload.hero_img,
        market_data: payload.market_data
      })
    });
    if (res.ok) return await res.json();
  } catch (e) {
    await logAudit(env, payload.admin_id, 'PE-ER-ASPUB-105', e.message);
  }
  return null;
}

// ============================================================
// TELEGRAM
// ============================================================
async function sendTelegram(env, message) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
  } catch (e) { /* silent fail */ }
}

// ============================================================
// AUDIT LOG
// ============================================================
async function logAudit(env, admin_id, action, detail) {
  try {
    await env.DB.prepare(
      'INSERT INTO audit_log (admin_id, action, detail, created_at) VALUES (?, ?, ?, ?)'
    ).bind(admin_id || 'SYSTEM', action, detail || '', new Date().toISOString()).run();
  } catch (e) { /* silent fail */ }
}

// ============================================================
// ADMIN CRUD
// ============================================================
async function handleGetAdmins(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const rows = await env.DB.prepare('SELECT * FROM admins ORDER BY created_at DESC').all();
  return json({ admins: rows.results || [] }, 200, corsHeaders);
}

async function handleSaveAdmin(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const body = await request.json();
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

async function handleDeleteAdmin(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const { admin_id } = await request.json();
  if (!admin_id) return json({ error: 'admin_id required' }, 400, corsHeaders);
  await env.DB.prepare('DELETE FROM admins WHERE admin_id = ?').bind(admin_id).run();
  await logAudit(env, 'MASTER', 'ADMIN_DELETED', `admin_id=${admin_id}`);
  return json({ success: true }, 200, corsHeaders);
}

// ============================================================
// PENDING POSTS CRUD
// ============================================================
async function handleGetPending(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const rows = await env.DB.prepare(
    "SELECT * FROM pending_posts WHERE status='pending' ORDER BY target_date ASC"
  ).all();
  return json({ pending: rows.results || [] }, 200, corsHeaders);
}

async function handleSavePending(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const body = await request.json();
  const { admin_id, pattern = 1, topic = '', target_date, immediate = false } = body;

  if (immediate) {
    // Get admin tone
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

async function handleCancelPending(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const { id } = await request.json();
  await env.DB.prepare("UPDATE pending_posts SET status='cancelled' WHERE id=?").bind(id).run();
  await logAudit(env, 'MASTER', 'PENDING_CANCELLED', `id=${id}`);
  return json({ success: true }, 200, corsHeaders);
}

// ============================================================
// LOGS + EVENTS + SETTINGS
// ============================================================
async function handleGetLogs(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const rows = await env.DB.prepare(
    'SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 100'
  ).all();
  return json({ logs: rows.results || [] }, 200, corsHeaders);
}

async function handleGetEvents(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const rows = await env.DB.prepare(
    'SELECT * FROM event_registry ORDER BY created_at DESC LIMIT 50'
  ).all();
  return json({ events: rows.results || [] }, 200, corsHeaders);
}

async function handleGetSettings(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const rows = await env.DB.prepare('SELECT * FROM system_settings').all();
  const settings = {};
  (rows.results || []).forEach(r => { settings[r.key] = r.value; });
  return json({ settings }, 200, corsHeaders);
}

async function handleSaveSettings(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  const body = await request.json();
  for (const [key, value] of Object.entries(body)) {
    await env.DB.prepare(`
      INSERT INTO system_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).bind(key, String(value)).run();
  }
  await logAudit(env, 'MASTER', 'SETTINGS_SAVED', JSON.stringify(body));
  return json({ success: true }, 200, corsHeaders);
}

async function handleResetAll(request, env, corsHeaders) {
  if (!verifyAuth(request, env)) return json({ error: 'Unauthorized' }, 401, corsHeaders);
  await env.DB.exec(`
    DELETE FROM audit_log;
    DELETE FROM event_registry;
    DELETE FROM pending_posts;
  `);
  await logAudit(env, 'MASTER', 'RESET_ALL', 'Full reset performed');
  return json({ success: true }, 200, corsHeaders);
}

// ============================================================
// HELPER
// ============================================================
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });
}
