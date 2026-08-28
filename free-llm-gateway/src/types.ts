export interface FreeLLMProvider {
  id: string;
  alias: string;
  name: string;
  website: string;
  models: FreeLLMModel[];
  transport: TransportType;
  rateLimit?: RateLimitConfig;
  proxySupported: boolean;
  isActive: boolean;
  lastHealthCheck?: Date;
}

export interface FreeLLMModel {
  id: string;
  name: string;
  displayName: string;
  capabilities: ModelCapability[];
  costPerMTok?: number;
  note?: string;
}

export interface ModelCapability {
  type: 'text' | 'vision' | 'tool-calling' | 'streaming';
  supported: boolean;
  note?: string;
}

export type TransportType =
  | 'direct-http'
  | 'custom-http'
  | 'browser-automation'
  | 'reverse-engineered'
  | 'passthrough'
  | 'local-cli';

export interface RateLimitConfig {
  type: 'per-ip' | 'per-session' | 'shared-queue' | 'unknown';
  limit?: number;
  window?: number;
  resetMs?: number;
}

export interface RoutingStrategy {
  name: string;
  priority: (provider: FreeLLMProvider, model?: string) => number;
  fallbackChain: string[];
}

export interface DiscoveredModel {
  providerId: string;
  modelId: string;
  discoveredAt: Date;
  available: boolean;
  latency?: number;
}

export interface FreeLLMGatewayConfig {
  providers: string[];
  defaultStrategy: string;
  healthCheckIntervalMs: number;
  cacheDurationMs: number;
  maxConcurrentBrowsers?: number;
}

export interface LLMRequest {
  model: string;
  provider?: string;
  messages: any[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  providerId: string;
  modelId: string;
  content: string;
  completionTokens?: number;
  promptTokens?: number;
  latencyMs: number;
}

export interface HealthStatus {
  providerId: string;
  healthy: boolean;
  lastError?: string;
  lastCheckTime: Date;
  consecutiveFailures: number;
}
