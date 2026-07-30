/**
 * index.ts – Pure Event Router for Cloudflare Workers
 * 
 * Delegates all processing to `./dispatcher`.
 * No business logic – only routing and fast responses.
 */

import { handleFetch, handleScheduled, handleQueue } from './dispatcher';

export default {
  /**
   * HTTP entry point – handles Telegram webhooks (and any other POST requests).
   * 
   * 1. Allows only POST.
   * 2. Parses JSON payload safely.
   * 3. Kicks off background processing via `ctx.waitUntil()`.
   * 4. Returns `200 OK` immediately.
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Reject non‑POST requests immediately
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Safely parse the incoming JSON payload
      const payload = await request.json();

      // Offload the actual work to the dispatcher, don't block the response
      ctx.waitUntil(handleFetch(payload, env, ctx, request));

      // Acknowledge receipt – Telegram will not retry
      return new Response('OK', { status: 200 });
    } catch (_error) {
      // Invalid JSON or other parsing errors
      return new Response('Bad Request', { status: 400 });
    }
  },

  /**
   * Cron / scheduled event entry point.
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduled(event, env, ctx));
  },

  /**
   * Queue consumer entry point.
   */
  async queue(batch: MessageBatch<any>, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleQueue(batch, env, ctx));
  },
};

/**
 * Minimal environment type – extend with your own variables.
 */
interface Env {
  // Add your environment variables here
  // e.g. TELEGRAM_BOT_TOKEN: string;
  //      TELEGRAM_CHAT_ID: string;
  //      KV_NAMESPACE: KVNamespace;
  [key: string]: any;
}
