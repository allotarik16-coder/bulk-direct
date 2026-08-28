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
import { PROVIDER_ENDPOINTS } from '../src/providers/endpoints';
import { missingKeyProviders } from '../src/providers/apiKeys';

const PROMPT = 'Réponds exactement: BONJOUR';

/**
 * A model ID we invented from a stale/guessed catalog reads identically to a
 * dead provider ("Model not found" either way). Fetching the real list turns
 * that ambiguity into an actual fix: the correct ID to put in config.ts.
 */
async function probeRealModels(providerId: string): Promise<void> {
  const modelsUrl = PROVIDER_ENDPOINTS[providerId]?.models;
  if (!modelsUrl) return;

  try {
    const res = await fetch(modelsUrl, { signal: AbortSignal.timeout(10000) });
    const body = await res.text();
    console.log(`   [models@${providerId}] HTTP ${res.status}: ${body.slice(0, 300)}\n`);
  } catch (error) {
    console.log(`   [models@${providerId}] fetch failed: ${(error as Error).message}\n`);
  }
}

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
      await probeRealModels(provider.id);
    }
  }

  console.log(`${ok}/${routable.length} providers ont répondu.\n`);

  // A provider that is simply unconfigured should not look like a failure:
  // it never ran. Name the variable and the signup page instead.
  const missing = missingKeyProviders();
  if (missing.length > 0) {
    console.log(`${missing.length} providers en attente d'une clé (non testés) :\n`);
    for (const { id, envVar, signup } of missing) {
      console.log(`   ${pad(id, 12)} ${pad(envVar, 22)} ${signup}`);
    }
    console.log('\nInscription gratuite, puis `npm run keys:set <provider> <clé>` :');
    console.log('la clé est enregistrée pour toute la machine, pas pour ce seul projet.\n');
  }

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
