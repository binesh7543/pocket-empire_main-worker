// ============================================================
// FILE: src/routes/admins.js
// ============================================================

import { Hono } from 'hono';                    // L1
import { validate } from '../middleware/validator.js'; // L2
import { AdminSchema } from '../schemas/index.js'; // L3
import { getAdmins, saveAdmin, deleteAdmin } from '../db.js'; // L4

const app = new Hono();                         // L6

app.get('/admins', async (c) => {              // L8
  const env = c.env;                           // L9
  const result = await getAdmins(env);         // L10
  return c.json(result);                       // L11
});                                            // L12

app.post('/admins', validate(AdminSchema), async (c) => { // L14
  const body = c.get('validated');             // L15
  const env = c.env;                           // L16
  const result = await saveAdmin(env, body);   // L17
  return c.json(result);                       // L18
});                                            // L19

app.post('/admins/delete', async (c) => {      // L21
  const body = await c.req.json();             // L22
  const env = c.env;                           // L23
  const result = await deleteAdmin(env, body); // L24
  return c.json(result);                       // L25
});                                            // L26

export default app;                            // L28
