import { readEnvVar, sourceOf } from './keyStore';

/**
 * Where each keyed provider's credential comes from.
 *
 * Every provider in this table has a documented free tier, but none of them
 * hand out a shared key: you register and get your own. So the key lives in
 * the environment or in the machine-wide file keyStore.ts resolves, never in
 * this repo — a committed key would be revoked by the provider within hours
 * anyway, and would leak on the first push.
 *
 * Configure a provider once per machine (`npm run keys:set groq gsk_…`) and
 * every project on that machine picks it up; per-repo setup is only needed
 * for CI, where the runner is a fresh box with no home directory to inherit.
 *
 * A provider whose variable is unset is left inactive rather than routed to,
 * because a request without a key is a guaranteed 401: it would burn a slot
 * in the fallback chain and read as an outage in the health tracker.
 */
export const PROVIDER_API_KEY_ENV: Record<string, string> = {
  groq: 'GROQ_API_KEY',
  cerebras: 'CEREBRAS_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  xai: 'XAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  opencode: 'OPENCODE_API_KEY',
  aihorde: 'AIHORDE_API_KEY',
  moonshot: 'MOONSHOT_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
};

/** Where to register, surfaced by check:live so a missing key is actionable. */
export const PROVIDER_SIGNUP_URL: Record<string, string> = {
  groq: 'https://console.groq.com/keys',
  cerebras: 'https://cloud.cerebras.ai',
  mistral: 'https://console.mistral.ai/api-keys',
  deepseek: 'https://platform.deepseek.com/api_keys',
  openrouter: 'https://openrouter.ai/keys',
  xai: 'https://console.x.ai',
  gemini: 'https://aistudio.google.com/apikey',
  opencode: 'https://opencode.ai',
  aihorde: 'https://stablehorde.net/register',
  moonshot: 'https://platform.kimi.ai',
  anthropic: 'https://console.anthropic.com/settings/keys',
};

export function getApiKey(providerId: string): string | undefined {
  const envVar = PROVIDER_API_KEY_ENV[providerId];
  if (!envVar) return undefined;

  return readEnvVar(envVar);
}

export function hasApiKey(providerId: string): boolean {
  return getApiKey(providerId) !== undefined;
}

/** Which file (or the process environment) a provider's key came from. */
export function apiKeySource(providerId: string): string | undefined {
  const envVar = PROVIDER_API_KEY_ENV[providerId];
  return envVar ? sourceOf(envVar) : undefined;
}

/** Providers that need a key and don't have one — what check:live reports. */
export function missingKeyProviders(): Array<{ id: string; envVar: string; signup: string }> {
  return Object.keys(PROVIDER_API_KEY_ENV)
    .filter((id) => !hasApiKey(id))
    .map((id) => ({
      id,
      envVar: PROVIDER_API_KEY_ENV[id],
      signup: PROVIDER_SIGNUP_URL[id] ?? '(no signup URL recorded)',
    }));
}
