// index.ts – Minimal webhook handler for Cloudflare Workers

export interface Env {
  // Add your environment variables here (optional for now)
  // e.g., PROFILE_A_URL, PROFILE_A_API_KEY, etc.
}

/**
 * Background dispatcher – this is where all processing happens.
 * Add your own functions below and call them here.
 */
async function dispatcher(message: any, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Dispatching message:', message);

  // --- Add your processing functions here ---
  // Example: send to profile A
  await sendToProfileA(message, env).catch(err => console.error('Profile A error:', err));

  // Example: send to profile B
  await sendToProfileB(message, env).catch(err => console.error('Profile B error:', err));

  // You can add more functions below – just call them here
  // await thirdFunction(message, env, ctx);
  // await fourthFunction(message, env, ctx);
  // ...
}

// ------------------------------------------------------------------
// Placeholder functions – replace with your actual implementations.
// You can keep adding new functions below this line.
// ------------------------------------------------------------------

async function sendToProfileA(message: any, env: Env): Promise<void> {
  // Example: fetch(env.PROFILE_A_URL, { method: 'POST', body: JSON.stringify(message) })
  console.log('Sending to Profile A (placeholder)');
}

async function sendToProfileB(message: any, env: Env): Promise<void> {
  console.log('Sending to Profile B (placeholder)');
}

// ------------------------------------------------------------------
// Main worker handler
// ------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // 1. Accept only POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 2. Parse the incoming message
    let message: any;
    try {
      message = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }

    // 3. Respond immediately (fast path)
    const response = new Response('Webhook received', { status: 200 });

    // 4. Offload processing to the background (dispatcher gets env & ctx)
    ctx.waitUntil(dispatcher(message, env, ctx));

    return response;
  },
};
