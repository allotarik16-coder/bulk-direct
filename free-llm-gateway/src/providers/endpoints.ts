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
};
