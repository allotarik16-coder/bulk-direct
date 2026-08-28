import { FreeLLMProvider } from '../types';
import { hasApiKey } from './apiKeys';

/** Text-only model entry; every keyed provider below serves at least these. */
function textModel(id: string, name: string, displayName: string, streaming = true) {
  return {
    id,
    name,
    displayName,
    capabilities: [
      { type: 'text' as const, supported: true },
      { type: 'streaming' as const, supported: streaming },
    ],
    costPerMTok: 0,
  };
}

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

  // -----------------------------------------------------------------------
  // Keyed providers — official free tiers, documented OpenAI-compatible APIs.
  //
  // isActive is computed, not declared: each is routable exactly when its key
  // is in the environment. Hardcoding `true` would put a guaranteed 401 in the
  // fallback chain and let the health tracker read a missing key as an outage.
  //
  // Model lists are the free-tier headliners, kept short on purpose; the live
  // /models endpoint is the source of truth and warmup() overrides these.
  // -----------------------------------------------------------------------
  groq: {
    id: 'groq',
    alias: 'groq',
    name: 'Groq',
    website: 'https://groq.com',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('groq'),
    models: [
      textModel('llama-3.3-70b-versatile', 'Llama 3.3 70B', 'Llama 3.3 70B Versatile'),
      textModel('llama-3.1-8b-instant', 'Llama 3.1 8B', 'Llama 3.1 8B Instant'),
    ],
    rateLimit: { type: 'per-session', limit: 30, window: 60 },
  },
  cerebras: {
    id: 'cerebras',
    alias: 'cbr',
    name: 'Cerebras',
    website: 'https://cerebras.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('cerebras'),
    models: [
      textModel('llama-3.3-70b', 'Llama 3.3 70B', 'Llama 3.3 70B (Cerebras)'),
      textModel('llama3.1-8b', 'Llama 3.1 8B', 'Llama 3.1 8B (Cerebras)'),
    ],
    rateLimit: { type: 'per-session', limit: 5, window: 60 },
  },
  mistral: {
    id: 'mistral',
    alias: 'mist',
    name: 'Mistral AI',
    website: 'https://mistral.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('mistral'),
    models: [
      textModel('mistral-small-latest', 'Mistral Small', 'Mistral Small (latest)'),
      textModel('open-mistral-nemo', 'Mistral Nemo', 'Open Mistral Nemo'),
    ],
    rateLimit: { type: 'unknown' },
  },
  deepseek: {
    id: 'deepseek',
    alias: 'ds',
    name: 'DeepSeek',
    website: 'https://deepseek.com',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('deepseek'),
    models: [
      textModel('deepseek-chat', 'DeepSeek Chat', 'DeepSeek Chat V3'),
      textModel('deepseek-reasoner', 'DeepSeek Reasoner', 'DeepSeek Reasoner (R1)'),
    ],
    rateLimit: { type: 'unknown' },
  },
  openrouter: {
    id: 'openrouter',
    alias: 'or',
    name: 'OpenRouter',
    website: 'https://openrouter.ai',
    transport: 'passthrough',
    proxySupported: true,
    isActive: hasApiKey('openrouter'),
    // The `:free` suffix is load-bearing — it selects OpenRouter's zero-cost
    // endpoint for the same weights. Drop it and the identical model bills at
    // full rate, so these IDs are copied verbatim, never "tidied".
    //
    // This is the free route to Kimi: same Moonshot weights as the `moonshot`
    // provider below, one OpenRouter key instead of a paid Moonshot account.
    models: [
      textModel('moonshotai/kimi-k2:free', 'Kimi K2 (free)', 'Kimi K2 — OpenRouter free tier'),
      textModel('moonshotai/kimi-k2.6:free', 'Kimi K2.6 (free)', 'Kimi K2.6 — OpenRouter free tier'),
      textModel('meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (free)', 'Llama 3.3 70B Instruct — free tier'),
    ],
    rateLimit: { type: 'unknown' },
  },
  xai: {
    id: 'xai',
    alias: 'xai',
    name: 'xAI',
    website: 'https://x.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('xai'),
    models: [textModel('grok-beta', 'Grok', 'Grok (beta)')],
    rateLimit: { type: 'unknown' },
  },
  // ---------------------------------------------------------------------
  // Paid provider. Present because its rate limits and context windows are
  // far beyond any free tier, but it bills per token, so `billing: 'paid'`
  // keeps routing away from it: it answers only a request that names it, or
  // names one of the models below. The free path to the same weights is
  // openrouter's `moonshotai/kimi-*:free`.
  //
  // Prices below are list rates per Mtok (input/output) as published in
  // August 2026, recorded to make the cost visible at the call site — they
  // are not fetched, so treat them as indicative, not billing truth.
  // ---------------------------------------------------------------------
  moonshot: {
    id: 'moonshot',
    alias: 'kimi',
    name: 'Moonshot AI (Kimi)',
    website: 'https://platform.kimi.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('moonshot'),
    billing: 'paid',
    models: [
      {
        id: 'kimi-k3',
        name: 'Kimi K3',
        displayName: 'Kimi K3 (1M context, multimodal)',
        capabilities: [
          { type: 'text', supported: true },
          { type: 'streaming', supported: true },
          { type: 'tool-calling', supported: true },
          { type: 'vision', supported: true },
        ],
        costPerMTok: 3,
        note: 'Payant : ~$3 in / $15 out par Mtok',
      },
      {
        id: 'kimi-k2.6',
        name: 'Kimi K2.6',
        displayName: 'Kimi K2.6 (262k context)',
        capabilities: [
          { type: 'text', supported: true },
          { type: 'streaming', supported: true },
          { type: 'tool-calling', supported: true },
          { type: 'vision', supported: true },
        ],
        costPerMTok: 0.95,
        note: 'Payant : ~$0.95 in / $4 out par Mtok',
      },
      {
        id: 'kimi-k2.7-code',
        name: 'Kimi K2.7 Code',
        displayName: 'Kimi K2.7 Code (code-tuned)',
        capabilities: [
          { type: 'text', supported: true },
          { type: 'streaming', supported: true },
          { type: 'tool-calling', supported: true },
        ],
        costPerMTok: 0.95,
        note: 'Payant. kimi-k2.5 et la série moonshot-v1 sont retirées au 31/08/2026 — absentes ici volontairement',
      },
    ],
    rateLimit: { type: 'unknown' },
  },
  gemini: {
    id: 'gemini',
    alias: 'gem',
    name: 'Google Gemini',
    website: 'https://ai.google.dev',
    transport: 'direct-http',
    proxySupported: true,
    isActive: hasApiKey('gemini'),
    models: [
      textModel('gemini-2.0-flash', 'Gemini 2.0 Flash', 'Gemini 2.0 Flash'),
      textModel('gemini-1.5-flash', 'Gemini 1.5 Flash', 'Gemini 1.5 Flash'),
    ],
    rateLimit: { type: 'per-session', limit: 15, window: 60 },
  },
};

// Only providers with a working executor AND a verified endpoint belong here.
// Adding a catalogued-but-unimplemented provider makes routing throw at execute().
//
// Keyed providers come first: they are documented vendor APIs, so they answer
// as long as the key is valid, where the scraped ones break whenever a captcha
// or bot-check is added upstream. Ones with no key configured are inactive and
// skipped by canProviderServe, so an unkeyed install falls through to the free
// anonymous providers exactly as before.
//
// `moonshot` is deliberately absent: it bills per token, and a fallback chain
// is exactly the path that would reach it without anyone deciding to spend.
// It is reachable by naming it, or by naming a Kimi model only it carries.
export const PROVIDER_FALLBACK_CHAIN = [
  'groq',
  'cerebras',
  'gemini',
  'mistral',
  'deepseek',
  'openrouter',
  'xai',
  'opencode',
  'theoldllm',
  'felo',
  'uncloseai',
  'aihorde',
];

export const TRANSPORT_TYPE_PRIORITY: Record<string, number> = {
  'direct-http': 1,
  'custom-http': 2,
  'browser-automation': 3,
  'passthrough': 3,
  'reverse-engineered': 4,
  'local-cli': 5,
};
