// ============================================================
// FILE: src/routes/pending.js
// ============================================================

import { Hono } from 'hono';                    // L1
import { validate } from '../middleware/validator.js'; // L2
import { PendingSchema } from '../schemas/index.js'; // L3
import { getPending, savePending, cancelPending } from '../db.js'; // L4

const app = new Hono();                         // L6

app.get('/pending', async (c) => {             // L8
  const env = c.env;                           // L9
  const result = await getPending(env);        // L10
  return c.json(result);                       // L11
});                                            // L12

app.post('/pending', validate(PendingSchema), async (c) => { // L14
  const body = c.get('validated');             // L15
  const env = c.env;                           // L16
  const result = await savePending(env, body); // L17
  return c.json(result);                       // L18
});                                            // L19

app.post('/pending/cancel', async (c) => {     // L21
  const body = await c.req.json();             // L22
  const env = c.env;                           // L23
  const result = await cancelPending(env, body); // L24
  return c.json(result);                       // L25
});                                            // L26

export default app;                            // L28
