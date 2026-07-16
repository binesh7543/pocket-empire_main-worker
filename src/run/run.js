/**
 * Pocket Empire v5.1 — run.js (minimal — sirf acknowledge karta hai)
 * Role: Message receive hote hi confirm reply bhejta hai.
 *
 * Abhi sirf itna: "message mil gaya" wapas bhejna.
 * Aage jaise-jaise feature chahiye, isi file mein add karte jaayenge.
 */

import { reporter } from "./reporter.js";

// ── MAIN HANDLER — dispatcher.js yahi call karta hai ─────────
export async function handle(env, payload) {
  console.log("PE-RUN-001: Message received", payload);

  try {
    await reporter("✅ Message mil gaya", env);
  } catch (err) {
    console.log("PE-RUN-ERR-001: Ack failed", err.message);
  }
}


