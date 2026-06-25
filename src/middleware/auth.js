// ============================================================
// FILE: src/middleware/auth.js
// ============================================================

export async function authMiddleware(c, next) { // L1
  const auth = c.req.header('Authorization') || ''; // L2
  const token = auth.replace('Bearer ', '').trim(); // L3
  if (token !== c.env.MASTER_TOKEN) {           // L4
    return c.json({ error: 'Unauthorized' }, 401); // L5
  }                                             // L6
  await next();                                 // L7
}                                               // L8
