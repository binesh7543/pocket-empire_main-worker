// ============================================================
// FILE: src/ai.js
// ============================================================

export function getToneGuide(tone) {           // L1
  const guides = {                             // L2
    hinglish: 'Hinglish (Hindi + English mix) — casual, relatable for Indian readers, use common Hindi phrases naturally', // L3
    formal: 'Formal English — professional, authoritative, suitable for business readers', // L4
    casual: 'Casual Hinglish — very friendly, like talking to a friend, simple language', // L5
    english: 'Pure English — clear, concise, international style' // L6
  };                                           // L7
  return guides[tone] || guides.hinglish;      // L8
}                                              // L9

export async function callAI(env, prompt, systemPrompt = '') { // L11
  // Layer 1: Groq (L13–L26)
  try {                                         // L13
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', { // L14
      method: 'POST',                           // L15
      headers: {                                // L16
        'Content-Type': 'application/json',     // L17
        'Authorization': `Bearer ${env.GROQ_API_KEY}` // L18
      },                                        // L19
      body: JSON.stringify({                    // L20
        model: 'llama-3.1-8b-instant',          // L21
        messages: [                             // L22
          { role: 'system', content: systemPrompt || 'You are a helpful assistant.' }, // L23
          { role: 'user', content: prompt }     // L24
        ],                                      // L25
        max_tokens: 1500, temperature: 0.7      // L26
      })                                       // L27
    });                                         // L28
    if (res.ok) {                               // L29
      const data = await res.json();            // L30
      return data.choices[0].message.content;   // L31
    }                                           // L32
  } catch (e) { /* fallthrough */ }             // L33

  // Layer 2: OpenRouter (L35–L48)
  try {                                         // L35
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', { // L36
      method: 'POST',                           // L37
      headers: {                                // L38
        'Content-Type': 'application/json',     // L39
        'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`, // L40
        'HTTP-Referer': 'https://pocket-empire.xdigi7851.workers.dev' // L41
      },                                        // L42
      body: JSON.stringify({                    // L43
        model: 'mistralai/mistral-7b-instruct', // L44
        messages: [                             // L45
          { role: 'system', content: systemPrompt || 'You are a helpful assistant.' }, // L46
          { role: 'user', content: prompt }     // L47
        ],                                      // L48
        max_tokens: 1500                        // L49
      })                                       // L50
    });                                         // L51
    if (res.ok) {                               // L52
      const data = await res.json();            // L53
      return data.choices[0].message.content;   // L54
    }                                           // L55
  } catch (e) { /* fallthrough */ }             // L56

  // Layer 3: Cloudflare Workers AI (L58–L65)
  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { // L58
    messages: [                                 // L59
      { role: 'system', content: systemPrompt || 'You are a helpful assistant.' }, // L60
      { role: 'user', content: prompt }         // L61
    ],                                          // L62
    max_tokens: 1500                            // L63
  });                                           // L64
  return response.response;                      // L65
}                                                // L66

export async function generateSEO(env, headline, tone) { // L68
  const toneGuide = getToneGuide(tone);          // L69
  const prompt = `Create an SEO-optimized blog post title for Indian finance audience. ...`; // L70 (shortened for brevity)
  const title = await callAI(env, prompt);      // L71
  return title.trim().replace(/^["']|["']$/g, ''); // L72
}                                               // L73

export async function generateContent(env, hero, tone, pattern) { // L75
  const toneGuide = getToneGuide(tone);          // L76
  const sections = pattern >= 3 ? 6 : pattern === 2 ? 5 : 4; // L77
  const wordLimit = pattern >= 3 ? 200 : pattern === 2 ? 180 : 150; // L78
  const prompt = `Write a ${sections}-section finance blog article...`; // L79 (shortened)
  return await callAI(env, prompt);              // L80
}                                                // L81

export async function generateImage(env, title) { // L83
  const prompt = encodeURIComponent(`Indian stock market finance concept: ${title}, professional, dark gold theme`); // L84
  return `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`; // L85
}                                                // L86

export function extractLabels(title, tone) {    // L88
  const keywords = ['RBI', 'Nifty', 'Sensex', 'FII', 'GDP', 'Inflation', 'Budget', 'SEBI', 'Gold', 'Dollar']; // L89
  const found = keywords.filter(k => title.toLowerCase().includes(k.toLowerCase())); // L90
  if (found.length === 0) found.push('Indian Market'); // L91
  found.push(tone === 'english' ? 'English' : 'Hinglish'); // L92
  return found;                                  // L93
}                                                // L94
