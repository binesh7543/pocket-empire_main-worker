// ============================================================
// FILE: src/schemas/index.js
// ============================================================

import { z } from 'zod';                        // L1

export const RunSchema = z.object({             // L3
  admin_id: z.string().min(1).default('DEFAULT'), // L4
  pattern: z.number().int().min(1).max(3).default(1), // L5
  topic: z.string().optional().default(''),     // L6
  tone: z.enum(['hinglish', 'formal', 'casual', 'english']).default('hinglish') // L7
});                                             // L8

export const AdminSchema = z.object({           // L10
  admin_id: z.string().min(1),                  // L11
  name: z.string().min(1),                      // L12
  tone: z.enum(['hinglish', 'formal', 'casual', 'english']).default('hinglish'), // L13
  template_id: z.string().default('DEFAULT'),   // L14
  active: z.number().int().min(0).max(1).default(1) // L15
});                                             // L16

export const PendingSchema = z.object({         // L18
  admin_id: z.string().min(1),                  // L19
  pattern: z.number().int().min(1).max(3).default(1), // L20
  topic: z.string().optional().default(''),     // L21
  target_date: z.string().optional().default(''), // L22
  immediate: z.boolean().default(false)         // L23
});                                             // L24

export const IdSchema = z.object({              // L26
  id: z.number().int().positive(),              // L27
  admin_id: z.string().optional()               // L28
});                                             // L29
