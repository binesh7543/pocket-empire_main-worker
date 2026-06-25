// ============================================================
// FILE: src/pipeline.js
// VERSION: 1.0.0
// ============================================================

import { logAudit } from './db.js';
import { generateSEO, generateContent, generateImage, extractLabels } from './ai.js';
import { sendTelegram, makeEventId } from './utils.js';

export async function processRun(data, env) {
  const { run_id, admin_id, pattern, topic, tone } = data;
  console.log(`[Pipeline] Starting run ${run_id} for admin ${admin_id}`);
  await logAudit(env, admin_id, 'PIPELINE_START', `run_id=${run_id}`);

  try {
    // Step 1: Fetch news
    console.log(`[Pipeline] Step 1: Fetching news for topic "${topic}"`);
    await logAudit(env, admin_id, 'STEP_1_NEWS', 'Fetching news');
    const news = await fetchNews(env, topic);
    if (!news || news.length === 0) {
      console.warn(`[Pipeline] No news found, using fallback`);
      await logAudit(env, admin_id, 'STEP_1_NEWS_FALLBACK', 'No news found');
    } else {
      console.log(`[Pipeline] Fetched ${news.length} news items`);
    }
    const hero = news[0] || { title: topic || 'Indian Market Update', description: '' };

    // Step 2: Generate SEO title
    console.log(`[Pipeline] Step 2: Generating SEO title`);
    await logAudit(env, admin_id, 'STEP_2_SEO', 'Generating SEO');
    const seoTitle = await generateSEO(env, hero.title, tone);
    console.log(`[Pipeline] SEO title: "${seoTitle}"`);

    // Step 3: Generate content
    console.log(`[Pipeline] Step 3: Generating content (pattern ${pattern})`);
    await logAudit(env, admin_id, 'STEP_3_CONTENT', `pattern=${pattern}`);
    const content = await generateContent(env, hero, tone, pattern);
    console.log(`[Pipeline] Content generated (${content.length} chars)`);

    // Step 4: Fetch market data
    console.log(`[Pipeline] Step 4: Fetching market data`);
    await logAudit(env, admin_id, 'STEP_4_MARKET', 'Fetching market data');
    const marketData = await fetchMarketData(env);
    console.log(`[Pipeline] Market data:`, marketData);

    // Step 5: Generate image
    console.log(`[Pipeline] Step 5: Generating image`);
    await logAudit(env, admin_id, 'STEP_5_IMAGE', 'Generating image');
    const heroImg = await generateImage(env, seoTitle);
    console.log(`[Pipeline] Image URL: ${heroImg}`);

    // Step 6: Get admin template
    console.log(`[Pipeline] Step 6: Fetching admin template`);
    const adminRow = await env.DB.prepare('SELECT * FROM admins WHERE admin_id = ?').bind(admin_id).first();
    const template_id = adminRow?.template_id || 'DEFAULT';
    console.log(`[Pipeline] Template ID: ${template_id}`);

    const event_id = makeEventId();

    // Step 7: Publish to Apps Script
    console.log(`[Pipeline] Step 7: Publishing to Apps Script`);
    await logAudit(env, admin_id, 'STEP_7_PUBLISH', 'Sending to Apps Script');
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
      console.log(`[Pipeline] Published successfully: ${publishResult.url}`);
      await env.DB.prepare(`
        INSERT INTO event_registry (event_id, admin_id, title, published_url, published_date, pattern, tone, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(event_id, admin_id, seoTitle, publishResult.url, new Date().toISOString(), pattern, tone, new Date().toISOString()).run();
    } else {
      console.warn(`[Pipeline] No URL returned from Apps Script`);
    }

    // Final audit and notification
    await logAudit(env, admin_id, 'PIPELINE_SUCCESS', `Published: ${publishResult?.url || 'N/A'}`);
    await sendTelegram(env, `✅ Pocket Empire v5.1\nRun: ${run_id}\nTitle: ${seoTitle}\nURL: ${publishResult?.url || 'N/A'}`);
    console.log(`[Pipeline] Run ${run_id} completed successfully`);

  } catch (e) {
    console.error(`[Pipeline] ERROR in run ${run_id}:`, e);
    await logAudit(env, admin_id, 'PIPELINE_ERROR', e.message + '\n' + e.stack);
    await sendTelegram(env, `❌ PE v5.1 Error\nRun: ${run_id}\nError: ${e.message}`);
    // rethrow to let queue handler decide retry
    throw e;
  }
}

// ---- Internal helpers with enhanced logging ----
async function fetchNews(env, topic = '') {
  try {
    const query = topic || 'Indian stock market Nifty Sensex RBI economy';
    const url = `https://api.marketaux.com/v1/news/all?api_token=${env.MARKETAUX_API_KEY}&language=en&countries=in&filter_entities=true&search=${encodeURIComponent(query)}&limit=5`;
    console.log(`[fetchNews] URL: ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[fetchNews] API returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.data || []).map(a => ({
      title: a.title,
      description: a.description || a.snippet || '',
      url: a.url
    }));
  } catch (e) {
    console.error('[fetchNews] Error:', e);
    return [];
  }
}

async function fetchMarketData(env) {
  // Placeholder – can be enhanced
  return { nifty: 'N/A', sensex: 'N/A', gold: 'N/A', usd_inr: 'N/A' };
}

async function sendToAppsScript(env, payload) {
  try {
    console.log(`[sendToAppsScript] Sending to ${env.APPS_SCRIPT_URL}`);
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
    if (res.ok) {
      const data = await res.json();
      console.log(`[sendToAppsScript] Success:`, data);
      return data;
    } else {
      console.warn(`[sendToAppsScript] HTTP ${res.status}`);
      return null;
    }
  } catch (e) {
    console.error('[sendToAppsScript] Error:', e);
    await logAudit(env, payload.admin_id, 'PE-ER-ASPUB-105', e.message);
    return null;
  }
}
