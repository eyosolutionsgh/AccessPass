/**
 * Runtime target seam. Vercel sets `process.env.VERCEL` automatically on every build and function
 * invocation, so this flag is `true` only on the serverless demo deployment and `false` everywhere
 * else (on-prem Docker, DigitalOcean, local dev). It selects the config-driven serverless paths —
 * a lazy/skipped BullMQ worker, a capped DB pool, Ably instead of Socket.io — without any existing
 * deployment having to set a new variable. See docs/deploy plan (Vercel demo).
 */
export const isServerless = !!process.env.VERCEL;
