/**
 * Vercel serverless function entry (repo root `api/` → one Function at `/api`; `vercel.json` rewrites
 * every API path to it). It only re-exports the handler that the project's own esbuild pre-bundled
 * to `server/dist/serverless.js` (via `pnpm --filter @vms/server build:serverless`, run in the Vercel
 * build). That indirection matters: the server sources use `.ts`-extension imports + `moduleResolution:
 * Bundler`, which @vercel/node's compiler can't handle — but the pre-built ESM bundle it can.
 */
export { default } from '../server/dist/serverless.js';
