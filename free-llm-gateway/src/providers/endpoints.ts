/**
 * Upstream endpoints, transcribed from the OmniRoute provider registry
 * (open-sse/config/providers/registry/<provider>/index.ts) rather than guessed.
 *
 * Only providers listed here can be routed to. A provider with no entry throws
 * at executor-creation time instead of silently POSTing to an invented URL.
 *
 * NOT reachable from a sandbox whose egress proxy blocks these hosts — every
 * entry below is transcribed, not yet confirmed against a live response.
 */
export interface ProviderEndpoint {
  /** OpenAI-compatible chat endpoint. */
  chat: string;
  /** Model-list endpoint, when the provider publishes one. */
  models?: string;
  /** Source of the values, for re-verification. */
  source: string;
}

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  opencode: {
    chat: 'https://opencode.ai/zen/v1/chat/completions',
    models: 'https://opencode.ai/zen/v1/models',
    source: 'omniroute open-sse/config/providers/registry/opencode/zen/index.ts',
  },
  theoldllm: {
    chat: 'https://theoldllm.vercel.app/api/chatgpt',
    source: 'omniroute open-sse/config/providers/registry/theoldllm/index.ts',
  },
  uncloseai: {
    chat: 'https://hermes.ai.unturf.com/v1/chat/completions',
    models: 'https://hermes.ai.unturf.com/v1/models',
    source: 'omniroute open-sse/config/providers/registry/uncloseai/index.ts',
  },
  aihorde: {
    chat: 'https://oai.aihorde.net/v1/chat/completions',
    models: 'https://oai.aihorde.net/v1/models',
    source: 'omniroute open-sse/config/providers/registry/aihorde/index.ts',
  },

  // ---------------------------------------------------------------------
  // Keyed providers: official free tiers with published, stable OpenAI-
  // compatible endpoints. Unlike the entries above these are not scraped —
  // they are the vendors' own documented APIs, so they do not break when a
  // provider adds a captcha or rotates a web token. Each needs its own key
  // from PROVIDER_API_KEY_ENV; without one the provider stays inactive.
  //
  // Catalogued from open-free-llm-api/awesome-freellm-apis, which is an
  // index of signup pages — it distributes no keys, and neither does this.
  // ---------------------------------------------------------------------
  groq: {
    chat: 'https://api.groq.com/openai/v1/chat/completions',
    models: 'https://api.groq.com/openai/v1/models',
    source: 'https://console.groq.com/docs/openai',
  },
  cerebras: {
    chat: 'https://api.cerebras.ai/v1/chat/completions',
    models: 'https://api.cerebras.ai/v1/models',
    source: 'https://inference-docs.cerebras.ai/api-reference/chat-completions',
  },
  mistral: {
    chat: 'https://api.mistral.ai/v1/chat/completions',
    models: 'https://api.mistral.ai/v1/models',
    source: 'https://docs.mistral.ai/api/',
  },
  deepseek: {
    chat: 'https://api.deepseek.com/v1/chat/completions',
    models: 'https://api.deepseek.com/v1/models',
    source: 'https://api-docs.deepseek.com/',
  },
  openrouter: {
    chat: 'https://openrouter.ai/api/v1/chat/completions',
    models: 'https://openrouter.ai/api/v1/models',
    source: 'https://openrouter.ai/docs/api-reference/overview',
  },
  xai: {
    chat: 'https://api.x.ai/v1/chat/completions',
    models: 'https://api.x.ai/v1/models',
    source: 'https://docs.x.ai/docs/api-reference',
  },
  gemini: {
    // Google's OpenAI-compatibility shim, not the native generateContent API:
    // it keeps Gemini on the same HTTPExecutor as everything else here.
    chat: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    models: 'https://generativelanguage.googleapis.com/v1beta/openai/models',
    source: 'https://ai.google.dev/gemini-api/docs/openai',
  },
};
