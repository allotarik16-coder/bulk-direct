/**
 * Where each keyed provider's credential comes from.
 *
 * Every provider in this table has a documented free tier, but none of them
 * hand out a shared key: you register and get your own. So the key lives in
 * the environment, never in this repo — a committed key would be revoked by
 * the provider within hours anyway, and would leak on the first push.
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
};

export function getApiKey(providerId: string): string | undefined {
  const envVar = PROVIDER_API_KEY_ENV[providerId];
  if (!envVar) return undefined;

  const value = process.env[envVar]?.trim();
  return value ? value : undefined;
}

export function hasApiKey(providerId: string): boolean {
  return getApiKey(providerId) !== undefined;
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
