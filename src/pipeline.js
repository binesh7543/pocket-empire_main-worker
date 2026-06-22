import { logAudit } from './db.js';
import { generateSEO, generateContent, generateImage, extractLabels } from './ai.js';
import { sendTelegram, makeEventId } from './utils.js';

export async function processRun(data, env) {
  const { run_id, admin_id, pattern, topic, tone } = data;

  try {
    await logAudit(env, admin_id, 'PE-WK-COLLECT-001', 'Fetching news');
    const news = await fetchNews(env, topic);
    if (!news || news.length === 0) {
      await logAudit(env, admin_id, 'PE-FB-NOSRC-101', 'No news found, using fallback');
    }

    await logAudit(env, admin_id, 'PE-WK-EVENT-003', 'Selecting hero event');
    const hero = news[0] || { title: topic || 'Indian Market Update', description: '' };

    await logAudit(env, admin_id, 'PE-WK-PUBLISH-008', 'Generating SEO + Content');
    const seoTitle = await generateSEO(env, hero.title, tone);
    const content = await generateContent(env, hero, tone, pattern);
    const marketData = await fetchMarketData(env);
    const heroImg = await generateImage(env, seoTitle);
    const event_id = makeEventId();

    const adminRow = await env.DB.prepare(
      'SELECT * FROM admins WHERE admin_id = ?'
    ).bind(admin_id).first();
    const template_id = adminRow?.template_id || 'DEFAULT';

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

    if (publishResult?.url) {
      await env.DB.prepare(`
        INSERT INTO event_registry (event_id, admin_id, title, published_url, published_date, pattern, tone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(event_id, admin_id, seoTitle, publishResult.url, new Date().toISOString(), pattern, tone, new Date().toISOString()).run();
    }

    await logAudit(env, admin_id, 'PE-WK-AUDIT-009', `Published: ${publishResult?.url}`);
    await sendTelegram(env, `✅ Pocket Empire v5\nRun: ${run_id}\nTitle: ${seoTitle}\nURL: ${publishResult?.url || 'N/A'}`);

  } catch (e) {
    await logAudit(env, admin_id, 'PE-ER-PIPELINE', e.message);
    await sendTelegram(env, `❌ PE v5 Error\nRun: ${run_id}\nError: ${e.message}`);
  }
}

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

async function fetchMarketData(env) {
  // You can replace this with a real API call
  return { nifty: 'N/A', sensex: 'N/A', gold: 'N/A', usd_inr: 'N/A' };
}

async function sendToAppsScript(env, payload) {
  try {
    const res = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
