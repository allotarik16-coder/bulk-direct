// Main gateway export
export { FreeLLMGateway, gateway } from './gateway';

// Router exports
export { FreeLLMRouter } from './router/router';

// Discovery exports
export { ModelDiscovery } from './discovery/modelDiscovery';

// Configuration exports
export { FREE_LLM_PROVIDERS, PROVIDER_FALLBACK_CHAIN, TRANSPORT_TYPE_PRIORITY } from './providers/config';

// Type exports
export type {
  FreeLLMProvider,
  FreeLLMModel,
  ModelCapability,
  TransportType,
  RateLimitConfig,
  RoutingStrategy,
  DiscoveredModel,
  FreeLLMGatewayConfig,
  LLMRequest,
  LLMResponse,
  HealthStatus,
} from './types';
