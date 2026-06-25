// ============================================================
// FILE: src/routes/logs.js
// ============================================================

import { Hono } from 'hono';                    // L1
import { getLogs, getEvents, getSettings, saveSettings, resetAll } from '../db.js'; // L2

const app = new Hono();                         // L4

app.get('/logs', async (c) => {                // L6
  const env = c.env;                           // L7
  const result = await getLogs(env);           // L8
  return c.json(result);                       // L9
});                                            // L10

app.get('/events', async (c) => {              // L12
  const env = c.env;                           // L13
  const result = await getEvents(env);         // L14
  return c.json(result);                       // L15
});                                            // L16

app.get('/settings', async (c) => {            // L18
  const env = c.env;                           // L19
  const result = await getSettings(env);       // L20
  return c.json(result);                       // L21
});                                            // L22

app.post('/settings', async (c) => {           // L24
  const body = await c.req.json();             // L25
  const env = c.env;                           // L26
  const result = await saveSettings(env, body); // L27
  return c.json(result);                       // L28
});                                            // L29

app.post('/reset-all', async (c) => {          // L31
  const env = c.env;                           // L32
  const result = await resetAll(env);          // L33
  return c.json(result);                       // L34
});                                            // L35

export default app;                            // L37
