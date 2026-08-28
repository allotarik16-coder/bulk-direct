import { FreeLLMProvider } from '../types';

export const FREE_LLM_PROVIDERS: Record<string, FreeLLMProvider> = {
  opencode: {
    id: 'opencode',
    alias: 'oc',
    name: 'OpenCode Free',
    website: 'https://opencode.ai',
    transport: 'direct-http',
    proxySupported: true,
    isActive: true,
    models: [
      { id: 'kimi', name: 'Kimi', displayName: 'Kimi by Moonshot', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'glm', name: 'GLM', displayName: 'GLM 4 by Zhipu', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'qwen', name: 'Qwen', displayName: 'Qwen by Alibaba', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'mimx', name: 'MiMo', displayName: 'MiMo', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
      { id: 'minimax', name: 'MiniMax', displayName: 'MiniMax Model', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-ip', limit: 100, window: 3600 },
  },
  duckduckgo: {
    id: 'duckduckgo-web',
    alias: 'ddgw',
    name: 'DuckDuckGo AI Chat',
    website: 'https://duckduckgo.com/duckchat',
    transport: 'browser-automation',
    proxySupported: false,
    isActive: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', displayName: 'GPT-4o (via DuckDuckGo)', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
      { id: 'claude', name: 'Claude', displayName: 'Claude by Anthropic', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-session', limit: 50, window: 3600 },
  },
  cloudflare: {
    id: 'cloudflare-playground',
    alias: 'cfp',
    name: 'Cloudflare AI Playground',
    website: 'https://playground.ai.cloudflare.com',
    transport: 'reverse-engineered',
    proxySupported: false,
    isActive: true,
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
    transport: 'browser-automation',
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
    models: [
      { id: 'hermes-llama-3.1', name: 'Hermes 3 Llama 3.1', displayName: 'Hermes-3-Llama-3.1-8B-AWQ', capabilities: [{ type: 'text', supported: true }, { type: 'streaming', supported: true }], costPerMTok: 0 },
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
    models: [
      { id: 'horde-stable', name: 'Stable Diffusion', displayName: 'Stable Diffusion (Horde)', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0, note: 'Crowdsourced inference' },
    ],
    rateLimit: { type: 'shared-queue' },
  },
  felo: {
    id: 'felo-web',
    alias: 'felo',
    name: 'Felo',
    website: 'https://felo.ai',
    transport: 'reverse-engineered',
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
    isActive: true,
    models: [
      { id: 'pepper-ai', name: 'Pepper AI', displayName: 'Pepper AI by IPsoft Amelia', capabilities: [{ type: 'text', supported: true }], costPerMTok: 0 },
    ],
    rateLimit: { type: 'per-ip', limit: 50, window: 3600 },
  },
};

export const PROVIDER_FALLBACK_CHAIN = ['opencode', 'theoldllm', 'duckduckgo', 'cloudflare', 'aihorde', 'uncloseai'];

export const TRANSPORT_TYPE_PRIORITY: Record<string, number> = {
  'direct-http': 1,
  'browser-automation': 2,
  'passthrough': 3,
  'reverse-engineered': 4,
  'local-cli': 5,
};
