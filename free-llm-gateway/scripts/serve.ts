/**
 * Run the gateway as one shared endpoint.
 *
 *   npm run serve
 *
 * Environment:
 *   PORT              listen port (default 8787)
 *   HOST              bind address (default 127.0.0.1)
 *   GATEWAY_TOKEN     shared secret callers present as `Bearer <token>`
 *   ALLOWED_ORIGINS   comma-separated origins for browser callers
 *
 * Provider keys come from the usual chain (environment, ./.env,
 * ~/.free-llm/keys.env), so a deployment holds them in one place and no
 * calling project needs any credential of its own.
 */
import { createServer } from '../src/server';
import { FREE_LLM_PROVIDERS } from '../src/providers/config';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '127.0.0.1';
const token = process.env.GATEWAY_TOKEN?.trim();
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const isLoopback = host === '127.0.0.1' || host === 'localhost' || host === '::1';

// An open LLM proxy on a public address is found by scanners within hours, and
// the cost lands as somebody else's traffic burning the free tiers. Refuse to
// be that, rather than printing a warning nobody reads.
if (!token && !isLoopback) {
  console.error(`\n❌ GATEWAY_TOKEN est obligatoire pour écouter sur ${host}.`);
  console.error('   Sans jeton, n\'importe qui peut épuiser tes quotas gratuits.\n');
  console.error('   Génère-en un :  node -e "console.log(crypto.randomUUID())"');
  console.error('   puis relance :  GATEWAY_TOKEN=<jeton> npm run serve\n');
  process.exit(1);
}

const active = Object.values(FREE_LLM_PROVIDERS).filter((p) => p.isActive);

createServer({ token, allowedOrigins }).listen(port, host, () => {
  console.log(`\n🚀 Gateway sur http://${host}:${port}`);
  console.log(`   ${active.length} providers actifs : ${active.map((p) => p.id).join(', ') || '(aucun)'}`);
  console.log(`   Auth  : ${token ? 'jeton requis' : '⚠️  aucune (loopback uniquement)'}`);
  console.log(`   CORS  : ${allowedOrigins.length ? allowedOrigins.join(', ') : 'désactivé'}\n`);
  console.log('   POST /v1/chat/completions     GET /v1/models     GET /health\n');

  if (active.length === 0) {
    console.log('   Aucun provider configuré — `npm run keys` pour voir ce qui manque.\n');
  }
});
