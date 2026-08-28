// Main gateway export
export { FreeLLMGateway, gateway } from './gateway';

// Deploy once, call from anywhere: the same router behind an OpenAI-compatible
// HTTP endpoint, so calling projects need a URL instead of this package.
export { createServer } from './server';
export type { ServerOptions } from './server';

// Router exports
export { FreeLLMRouter } from './router/router';

// Discovery exports
export { ModelDiscovery } from './discovery/modelDiscovery';

// Executor exports
export { BaseExecutor, HTTPExecutor, PassthroughExecutor, ExecutorFactory } from './executors';

// Benchmark exports
export { ProviderBenchmark } from './benchmarks';
export type { BenchmarkResult, BenchmarkStats } from './benchmarks';

// Monitoring exports
export { ProviderMonitor } from './monitoring';
export type { Alert, AlertSeverity, MonitoringConfig, MonitoringStats } from './monitoring';

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
