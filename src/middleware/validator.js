// ============================================================
// FILE: src/middleware/validator.js
// ============================================================

export const validate = (schema) => {           // L1
  return async (c, next) => {                   // L2
    try {                                       // L3
      const body = await c.req.json().catch(() => ({})); // L4
      const validated = schema.parse(body);     // L5
      c.set('validated', validated);            // L6
      await next();                             // L7
    } catch (error) {                           // L8
      if (error.issues) {                       // L9  ← Zod error detection
        return c.json({                         // L10
          error: 'Validation Error',            // L11
          details: error.issues.map(e => ({     // L12
            field: e.path.join('.'),            // L13
            message: e.message                  // L14
          }))                                   // L15
        }, 400);                                // L16
      }                                         // L17
      return c.json({ error: error.message }, 400); // L18
    }                                           // L19
  };                                            // L20
};
