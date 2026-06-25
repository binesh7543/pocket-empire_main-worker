// ============================================================
// FILE: src/pipeline.js
// ============================================================

import { logAudit } from './db.js';              // L1
import { generateSEO, generateContent, generateImage, extractLabels } from './ai.js'; // L2
import { sendTelegram, makeEventId } from './utils.js'; // L3

export async function processRun(data, env) {    // L5
  const { run_id, admin_id, pattern, topic, tone } = data; // L6
  try {                                          // L7
    await logAudit(env, admin_id, 'PE-WK-COLLECT-001', 'Fetching news'); // L8
    const news = await fetchNews(env, topic);    // L9
    if (!news || news.length === 0) {            // L10
      await logAudit(env, admin_id, 'PE-FB-NOSRC-101', 'No news found, using fallback'); // L11
    }                                            // L12
    await logAudit(env, admin_id, 'PE-WK-EVENT-003', 'Selecting hero event'); // L13
    const hero = news[0] || { title: topic || 'Indian Market Update', description: '' }; // L14
    await logAudit(env, admin_id, 'PE-WK-PUBLISH-008', 'Generating SEO + Content'); // L15
    const seoTitle = await generateSEO(env, hero.title, tone); // L16
    const content = await generateContent(env, hero, tone, pattern); // L17
    const marketData = await fetchMarketData(env); // L18
    const heroImg = await generateImage(env, seoTitle); // L19
    const event_id = makeEventId();               // L20
    const adminRow = await env.DB.prepare('SELECT * FROM admins WHERE admin_id = ?').bind(admin_id).first(); // L21
    const template_id = adminRow?.template_id || 'DEFAULT'; // L22
    await logAudit(env, admin_id, 'PE-WK-PUBLISH-008', 'Sending to Apps Script'); // L23
    const publishResult = await sendToAppsScript(env, { // L24
      title: seoTitle, html: content, labels: extractLabels(hero.title, tone), // L25
      admin_id, template_id, event_id, run_id, pattern, tone, hero_img: heroImg, market_data: marketData // L26
    });                                          // L27
    if (publishResult?.url) {                    // L28
      await env.DB.prepare(`                     // L29
        INSERT INTO event_registry (event_id, admin_id, title, published_url, published_date, pattern, tone, created_at) // L30
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)          // L31
      `).bind(event_id, admin_id, seoTitle, publishResult.url, new Date().toISOString(), pattern, tone, new Date().toISOString()).run(); // L32
    }                                            // L33
    await logAudit(env, admin_id, 'PE-WK-AUDIT-009', `Published: ${publishResult?.url}`); // L34
    await sendTelegram(env, `✅ Pocket Empire v5\nRun: ${run_id}\nTitle: ${seoTitle}\nURL: ${publishResult?.url || 'N/A'}`); // L35
  } catch (e) {                                  // L36
    await logAudit(env, admin_id, 'PE-ER-PIPELINE', e.message); // L37
    await sendTelegram(env, `❌ PE v5 Error\nRun: ${run_id}\nError: ${e.message}`); // L38
  }                                              // L39
}                                                // L40

async function fetchNews(env, topic = '') {     // L42
  try {                                         // L43
    const query = topic || 'Indian stock market Nifty Sensex RBI economy'; // L44
    const res = await fetch(                    // L45
      `https://api.marketaux.com/v1/news/all?api_token=${env.MARKETAUX_API_KEY}&language=en&countries=in&filter_entities=true&search=${encodeURIComponent(query)}&limit=5` // L46
    );                                          // L47
    if (res.ok) {                               // L48
      const data = await res.json();            // L49
      return (data.data || []).map(a => ({      // L50
        title: a.title,                         // L51
        description: a.description || a.snippet || '', // L52
        url: a.url                              // L53
      }));                                      // L54
    }                                           // L55
  } catch (e) { /* fallthrough */ }             // L56
  return [];                                    // L57
}                                               // L58

async function fetchMarketData(env) {          // L60
  return { nifty: 'N/A', sensex: 'N/A', gold: 'N/A', usd_inr: 'N/A' }; // L61
}                                               // L62

async function sendToAppsScript(env, payload) { // L64
  try {                                         // L65
    const res = await fetch(env.APPS_SCRIPT_URL, { // L66
      method: 'POST',                           // L67
      headers: { 'Content-Type': 'application/json' }, // L68
      body: JSON.stringify({                    // L69
        api_key: env.MASTER_TOKEN,              // L70
        title: payload.title,                   // L71
        html: payload.html,                     // L72
        labels: payload.labels,                 // L73
        admin_id: payload.admin_id,             // L74
        template_id: payload.template_id,       // L75
        event_id: payload.event_id,             // L76
        run_id: payload.run_id,                 // L77
        pattern: payload.pattern,               // L78
        tone: payload.tone,                     // L79
        hero_img: payload.hero_img,             // L80
        market_data: payload.market_data        // L81
      })                                       // L82
    });                                         // L83
    if (res.ok) return await res.json();       // L84
  } catch (e) {                                 // L85
    await logAudit(env, payload.admin_id, 'PE-ER-ASPUB-105', e.message); // L86
  }                                            // L87
  return null;                                 // L88
}                                              // L89
