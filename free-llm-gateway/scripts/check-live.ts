/**
 * Sends one real request to every routable provider and reports what came back.
 *
 * This is the check the development sandbox cannot run: its egress proxy 403s
 * these hosts, so every endpoint in src/providers/endpoints.ts is transcribed
 * from OmniRoute's registry rather than confirmed against a live response.
 *
 *   npm run check:live
 */
import { FreeLLMGateway } from '../src/gateway';
import { FREE_LLM_PROVIDERS } from '../src/providers/config';

const PROMPT = 'Réponds exactement: BONJOUR';

async function main() {
  const gateway = new FreeLLMGateway();
  const routable = Object.values(FREE_LLM_PROVIDERS).filter((p) => p.isActive);

  console.log(`\nTest de ${routable.length} providers — une requête réelle chacun.\n`);

  let ok = 0;

  for (const provider of routable) {
    const model = provider.models[0]?.id ?? 'default';
    const started = Date.now();

    try {
      const res = await gateway.execute({
        provider: provider.id,
        model,
        messages: [{ role: 'user', content: PROMPT }],
      });

      const preview = res.content.replace(/\s+/g, ' ').trim().slice(0, 60) || '(réponse vide)';
      console.log(`✅ ${pad(provider.name)} ${pad(model, 20)} ${Date.now() - started}ms`);
      console.log(`   ${preview}\n`);
      ok++;
    } catch (error) {
      console.log(`❌ ${pad(provider.name)} ${pad(model, 20)} ${Date.now() - started}ms`);
      console.log(`   ${(error as Error).message}\n`);
    }
  }

  console.log(`${ok}/${routable.length} providers ont répondu.\n`);

  if (ok < routable.length) {
    console.log('Colle cette sortie dans la conversation pour que les échecs soient corrigés.');
  }

  // Non-zero only if nothing answered at all: partial failure is the expected
  // state for free endpoints and should not read as a broken run.
  process.exit(ok === 0 ? 1 : 0);
}

function pad(s: string, n = 18) {
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}

main().catch((error) => {
  console.error('Le script lui-même a échoué:', error);
  process.exit(1);
});
