import { FreeLLMProvider } from '../types';

// INVARIANT: each record key must equal its `id`. The router, executor factory,
// endpoint table and health map all address providers by that one string; when
// they drifted apart ("felo" vs "felo-web"), felo threw at executor creation and
// its health tracking silently no-opped. Guarded by tests/customHttp.test.ts.
export const FREE_LLM_PROVIDERS: Record<string, FreeLLMProvider> = {
  opencode: {
    id: 'opencode',
    alias: 'oc',
    name: 'OpenCode Free',
    website: 'https://opencode.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: true,
    // Confirmed live via /zen/v1/models on 2026-08-28: this proxies real Claude
    // models, not the Kimi/GLM/Qwen lineup the OmniRoute transcription implied.
    models: [
      { id: 'claude-fable-5', name: 'Claude Fable 5', displayName: 'Claude Fable 5 (via OpenCode Zen)', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'claude-opus-5', name: 'Claude Opus 5', displayName: 'Claude Opus 5 (via OpenCode Zen)', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', displayName: 'Claude Opus 4.8 (via OpenCode Zen)', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', displayName: 'Claude Opus 4.7 (via OpenCode Zen)', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-ip', limit: 100, window: 3600 },
  },
  duckduckgo: {
    id: 'duckduckgo',
    alias: 'ddgw',
    name: 'DuckDuckGo AI Chat',
    website: 'https://duckduckgo.com/duckchat',
    // Also plain HTTP upstream (VQD token via GET /duckchat/v1/status), but
    // reaching it needs the anti-bot challenge solver + fe-version tracking
    // that OmniRoute keeps in a dedicated 312-line module. Not ported.
    transport: 'browser-automation',
    proxySupported: false,
    isActive: false, // needs the VQD challenge solver
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o (via DuckDuckGo)', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'claude', name: 'Claude', displayName: 'Claude by Anthropic', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-session', limit: 50, window: 3600 },
  },
  cloudflare: {
    id: 'cloudflare',
    alias: 'cfp',
    name: 'Cloudflare AI Playground',
    website: 'https://playground.ai.cloudflare.com',
    transport: 'reverse-engineered',
    proxySupported: false,
    isActive: false, // no executor yet (see executors/index.ts)
    models: [
      { id: 'glm-5.2', name: 'GLM 5.2', displayName: 'GLM 5.2', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'kimi-k2.7', name: 'Kimi K2.7 Code', displayName: 'Kimi K2.7 Code', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'deepseek-v4', name: 'DeepSeek V4 Pro', displayName: 'DeepSeek V4 Pro', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'gpt-oss-120b', name: 'GPT-OSS-120B', displayName: 'GPT-OSS-120B', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-ip', limit: 50, window: 3600 },
  },
  theoldllm: {
    id: 'theoldllm',
    alias: 'tllm',
    name: 'The Old LLM',
    website: 'https://theoldllm.vercel.app',
    // Despite the "browser session" wording in its provider blurb, this is
    // plain HTTP: X-Request-Token is a deterministic hash of a static seed,
    // so no browser is involved. See executors/theOldLlmExecutor.ts.
    transport: 'custom-http',
    proxySupported: true,
    isActive: true,
    models: [
      { id: 'gpt-5.4', name: 'GPT-5.4', displayName: 'GPT-5.4', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'claude-opus', name: 'Claude Opus', displayName: 'Claude 4.6 Opus', capabilities: [{ type: 'text', supported: true }, { type: 'tool-calling', supported: true }], costPerMTok: 0 },
      { id: 'claude-sonnet', name: 'Claude Sonnet', displayName: 'Claude Sonnet', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'claude-haiku', name: 'Claude Haiku', displayName: 'Claude Haiku', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-session', limit: 100, window: 3600 },
  },
  uncloseai: {
    id: 'uncloseai',
    alias: 'unc',
    name: 'UncloseAI',
    website: 'https://uncloseai.com',
    transport: 'passthrough',
    proxySupported: false,
    isActive: true,
    // Confirmed live via /v1/models on 2026-08-28: the previous "hermes-llama-3.1"
    // ID 404s — this vllm deployment now serves a different model.
    models: [
      { id: 'Lorbus/Qwen3.6-27B-int4-AutoRound', name: 'Qwen3.6 27B (int4)', displayName: 'Qwen3.6-27B-int4-AutoRound', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'unknown' },
  },
  aihorde: {
    id: 'aihorde',
    alias: 'horde',
    name: 'AI Horde',
    website: 'https://aihorde.net',
    transport: 'passthrough',
    proxySupported: false,
    isActive: true,
    // "horde-stable" never existed as a text model (it read as an image-gen
    // ID transcribed into the wrong catalog). Workers are crowdsourced and
    // rotate constantly, so any hardcoded ID here will go stale again — this
    // one was live via /v1/models on 2026-08-28, not a stable guarantee.
    models: [
      { id: 'aphrodite/SicariusSicariiStuff/Impish_Bloodmoon_12B', name: 'Impish Bloodmoon 12B', displayName: 'Impish_Bloodmoon_12B (Horde, crowdsourced)', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0, note: 'Crowdsourced inference; model availability rotates — re-check /v1/models if this 404s' },
    ],
    rateLimit: { type: 'shared-queue' },
  },
  felo: {
    id: 'felo',
    alias: 'felo',
    name: 'Felo',
    website: 'https://felo.ai',
    // Two plain HTTP calls (open thread -> drain its stream). No browser,
    // no WebSocket. See executors/feloExecutor.ts.
    transport: 'custom-http',
    proxySupported: false,
    isActive: true,
    models: [
      { id: 'felo-chat', name: 'Felo Chat', displayName: 'Felo Chat/Search Aggregator', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'unknown' },
  },
  chipotle: {
    id: 'chipotle',
    alias: 'pepper',
    name: 'Chipotle Pepper AI',
    website: 'https://amelia.chipotle.com',
    transport: 'reverse-engineered',
    proxySupported: false,
    isActive: false, // no executor yet (see executors/index.ts)
    models: [
      { id: 'pepper-ai', name: 'Pepper AI', displayName: 'Pepper AI by IPsoft Amelia', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-ip', limit: 50, window: 3600 },
  },
};

// Only providers with a working executor AND a transcribed endpoint belong here.
// Adding a catalogued-but-unimplemented provider makes routing throw at execute().
export const PROVIDER_FALLBACK_CHAIN = ['opencode', 'theoldllm', 'felo', 'uncloseai', 'aihorde'];

export const TRANSPORT_TYPE_PRIORITY: Record<string, number> = {
  'direct-http': 1,
  'custom-http': 2,
  'browser-automation': 3,
  'passthrough': 3,
  'reverse-engineered': 4,
  'local-cli': 5,
};
