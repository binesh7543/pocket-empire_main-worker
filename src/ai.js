export function getToneGuide(tone) {
  const guides = {
    hinglish: 'Hinglish (Hindi + English mix) — casual, relatable for Indian readers, use common Hindi phrases naturally',
    formal: 'Formal English — professional, authoritative, suitable for business readers',
    casual: 'Casual Hinglish — very friendly, like talking to a friend, simple language',
    english: 'Pure English — clear, concise, international style'
  };
  return guides[tone] || guides.hinglish;
}

export async function callAI(env, prompt, systemPrompt = '') {
  // Groq
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

  // OpenRouter
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

  // Cloudflare Workers AI
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 1500
  });
  return response.response;
}

export async function generateSEO(env, headline, tone) {
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

export async function generateContent(env, hero, tone, pattern) {
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

export async function generateImage(env, title) {
  const prompt = encodeURIComponent(`Indian stock market finance concept: ${title}, professional, dark gold theme`);
  return `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`;
}

export function extractLabels(title, tone) {
  const keywords = ['RBI', 'Nifty', 'Sensex', 'FII', 'GDP', 'Inflation', 'Budget', 'SEBI', 'Gold', 'Dollar'];
  const found = keywords.filter(k => title.toLowerCase().includes(k.toLowerCase()));
  if (found.length === 0) found.push('Indian Market');
  found.push(tone === 'english' ? 'English' : 'Hinglish');
  return found;
                      }
