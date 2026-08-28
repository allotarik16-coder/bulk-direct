# Free LLM Gateway — Production Guide

This guide covers executor implementations, benchmarking, and production monitoring for the Free LLM Gateway.

---

## 1. Executor Layer

The executor layer handles provider-specific transport and request/response translation.

### Executor Types

#### HTTPExecutor
Used for direct HTTP providers (OpenCode, The Old LLM).

```typescript
import { HTTPExecutor } from 'free-llm-gateway';

const executor = new HTTPExecutor(
  'opencode',
  'OpenCode Free',
  'https://opencode.ai/zen/v1/chat/completions'
);

const response = await executor.execute({
  model: 'kimi',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(response.content);
```

#### PassthroughExecutor
Used for providers that accept any model (UncloseAI, AI Horde).

```typescript
import { PassthroughExecutor } from 'free-llm-gateway';

const executor = new PassthroughExecutor(
  'uncloseai',
  'UncloseAI',
  'https://api.uncloseai.com/v1/chat/completions'
);

const response = await executor.execute({
  model: 'solidrust/Hermes-3-Llama-3.1-8B-AWQ',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

### ExecutorFactory

The factory creates and caches executors:

```typescript
import { ExecutorFactory } from 'free-llm-gateway';

const factory = new ExecutorFactory();

// Get (or create) executor for provider
const executor = factory.getExecutor('opencode');

// Clear cache if needed
factory.clearCache();
```

### Adding New Executors

1. **Extend BaseExecutor**
```typescript
import { BaseExecutor } from 'free-llm-gateway';

export class CustomExecutor extends BaseExecutor {
  async execute(request: LLMRequest): Promise<LLMResponse> {
    // Implementation
  }

  async healthCheck(): Promise<boolean> {
    // Health check logic
  }
}
```

2. **Register in ExecutorFactory**
```typescript
// In src/executors/index.ts
private createExecutor(providerId: string, provider: any): BaseExecutor {
  switch (provider.transport) {
    case 'custom-transport':
      return new CustomExecutor(...);
    // ...
  }
}
```

---

## 2. Benchmarking

Benchmark provider performance to understand latency, reliability, and capacity.

### Run Benchmarks

```typescript
import { ProviderBenchmark } from 'free-llm-gateway';

const benchmark = new ProviderBenchmark();

// Benchmark all providers (3 iterations each)
const stats = await benchmark.benchmarkAll(3);

// Print report
const report = benchmark.generateReport(stats);
console.log(report);
```

### Benchmark Results

```typescript
interface BenchmarkStats {
  providerId: string;
  providerName: string;
  totalTests: number;
  successRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;    // Median
  p95LatencyMs: number;    // 95th percentile
  p99LatencyMs: number;    // 99th percentile
  results: BenchmarkResult[];
}
```

### Benchmark Specific Provider

```typescript
const provider = FREE_LLM_PROVIDERS['opencode'];
const stats = await benchmark.benchmarkProvider(provider, 5);
console.log(`${provider.name}: ${stats.avgLatencyMs}ms avg`);
```

### Health Check Latency

Measure just health check latency (no request execution):

```typescript
const latencies = await benchmark.benchmarkHealthChecks();
latencies.forEach((latency, providerId) => {
  console.log(`${providerId}: ${latency}ms`);
});
```

### Export Results

```typescript
const results = benchmark.exportResults();

// Save to file
import fs from 'fs';
fs.writeFileSync('benchmark-results.json', JSON.stringify(results, null, 2));

// Clear for new run
benchmark.clearResults();
```

### Performance Expectations

| Provider | Expected Latency | Reliability | Notes |
|----------|------------------|-------------|-------|
| OpenCode | 200-500ms | 95%+ | Direct HTTP, most reliable |
| The Old LLM | 1-3s | 90%+ | Browser automation, stable |
| DuckDuckGo | 500-2000ms | 80%+ | Browser, higher variance |
| Cloudflare | 500-2000ms | 75%+ | WebSocket reverse-eng |
| AI Horde | 10s-5min | 85%+ | Crowdsourced, queue-based |
| UncloseAI | 200-500ms | 80%+ | Direct HTTP, newer service |
| Others | 1-5s | 60-80% | Experimental/reverse-eng |

---

## 3. Production Monitoring

Monitor provider health and set up alerts for production deployments.

### Start Monitoring

```typescript
import { ProviderMonitor } from 'free-llm-gateway';

const monitor = new ProviderMonitor({
  healthCheckIntervalMs: 60000, // 1 minute
  alertThresholds: {
    consecutiveFailuresWarning: 2,
    consecutiveFailuresCritical: 5,
    latencyWarningMs: 5000,
    latencyCriticalMs: 15000,
  },
  enableAlerts: true,
  alertChannels: ['console', 'webhook'],
});

// Start background monitoring
monitor.start();

// Get current stats
const health = gateway.getHealthStatus();
const stats = monitor.getStats(health);
console.log(monitor.generateReport(stats));

// Stop when done
// monitor.stop();
```

### Record Failures

Record failures when requests fail:

```typescript
router.recordFailure('opencode', 2, 'Connection timeout');
monitor.recordFailure('opencode', 2, 'Connection timeout');
```

### Record Success

Clear failure counter on success:

```typescript
router.recordSuccess('opencode');
monitor.recordSuccess('opencode');
```

### Record Latency

Track latency for performance monitoring:

```typescript
const startTime = Date.now();
const response = await gateway.execute(request);
const latencyMs = Date.now() - startTime;

monitor.recordLatency(response.providerId, latencyMs);
```

### Get Alerts

```typescript
const activeAlerts = monitor.getActiveAlerts();
activeAlerts.forEach(alert => {
  console.log(`[${alert.severity}] ${alert.providerId}: ${alert.message}`);
});

// Get alert history
const history = monitor.getAlertHistory();
console.log(`Total alerts: ${history.length}`);
```

### Alert Channels

#### Console (default)
```typescript
// Logs to console with emoji indicators
// 🚨 [CRITICAL] opencode: 5 consecutive failures: Connection timeout
// ⚠️  [WARNING] duckduckgo: 2 consecutive failures: Rate limited
```

#### Webhook
```typescript
// TODO: Implement webhook integration
const monitor = new ProviderMonitor({
  alertChannels: ['webhook'],
  webhookUrl: 'https://alerts.example.com/webhook',
});
```

#### Email
```typescript
// TODO: Implement email integration
const monitor = new ProviderMonitor({
  alertChannels: ['email'],
  emailTo: 'ops@example.com',
});
```

#### File Logging
```typescript
const monitor = new ProviderMonitor({
  alertChannels: ['log'],
  logFile: '/var/log/llm-gateway/alerts.log',
});
```

### Monitoring Report

```typescript
const report = monitor.generateReport(stats);
console.log(report);

// Output:
// 📊 Provider Monitoring Report
// =============================
//
// Timestamp: 8/28/2024, 3:45:30 PM
// System Health Score: 85/100
//
// Provider Status:
//   ✅ Healthy: 7
//   ⚠️  Warning: 1
//   🚨 Critical: 0
//   Total: 9
//
// Performance:
//   Average Latency: 1250ms
//
// 🚨 Active Alerts (1):
//   [WARNING] duckduckgo: 2 consecutive failures: Rate limited
```

---

## 4. Production Setup Checklist

```typescript
import { FreeLLMGateway, ProviderMonitor, ProviderBenchmark } from 'free-llm-gateway';

// 1. Initialize gateway
const gateway = new FreeLLMGateway(3600000); // 1 hour cache
gateway.setDefaultStrategy('smart-fallback');

// 2. Setup monitoring
const monitor = new ProviderMonitor({
  healthCheckIntervalMs: 60000,
  enableAlerts: true,
  alertChannels: ['console', 'webhook'], // Add your webhooks
  alertThresholds: {
    consecutiveFailuresWarning: 2,
    consecutiveFailuresCritical: 5,
    latencyWarningMs: 5000,
    latencyCriticalMs: 15000,
  },
});
monitor.start();

// 3. Run initial benchmark
const benchmark = new ProviderBenchmark();
const benchmarkResults = await benchmark.benchmarkAll(3);
console.log(benchmark.generateReport(benchmarkResults));

// 4. Periodic health checks
setInterval(async () => {
  const health = gateway.getHealthStatus();
  const stats = monitor.getStats(health);
  
  if (stats.systemHealthScore < 70) {
    console.warn('⚠️  System health degraded');
  }
  
  // Log metrics
  console.log(`Health: ${stats.systemHealthScore.toFixed(0)}/100`);
  console.log(`Active alerts: ${stats.activeAlerts.length}`);
}, 300000); // Every 5 minutes

// 5. Handle errors gracefully
try {
  const response = await gateway.execute(request, 'smart-fallback');
} catch (error) {
  console.error('Request failed:', error);
  // Fall back to paid provider or queue for retry
  fallbackToPaidProvider(request);
}

// 6. Log metrics to your observability platform
setInterval(() => {
  const summary = gateway.getSummary();
  const stats = monitor.getStats(gateway.getHealthStatus());
  
  // Send to Prometheus, Datadog, CloudWatch, etc.
  metricsClient.gauge('llm_gateway_health_score', stats.systemHealthScore);
  metricsClient.gauge('llm_gateway_healthy_providers', stats.healthyProviders);
  metricsClient.gauge('llm_gateway_avg_latency_ms', stats.avgSystemLatencyMs);
});
```

---

## 5. Scaling Considerations

### Browser Pool Management
For Playwright-based providers (DuckDuckGo, Cloudflare, The Old LLM):

```typescript
// TODO: Implement browser pool for concurrent requests
// - Reuse Playwright instances across requests
// - Limit concurrent browsers to avoid memory exhaustion
// - Clean up idle browsers after timeout
```

### Request Queuing
For rate-limited or slow providers:

```typescript
// TODO: Implement request queue
// - Queue requests when provider is rate-limited
// - Exponential backoff on failures
// - Prioritize by provider health/latency
```

### Caching Layer
Reduce load on providers:

```typescript
// Use gateway's built-in cache
gateway.discoverModels('opencode', false); // Use cache
gateway.discoverModels('opencode', true);  // Force refresh
```

### Load Balancing
Distribute load across healthy providers:

```typescript
// Automatically uses 'smart-fallback' strategy
await gateway.execute(request, 'smart-fallback');

// Or implement weighted round-robin
gateway.setDefaultStrategy('browser-friendly'); // Changes default
```

---

## 6. Debugging

### Enable Verbose Logging
```typescript
// Add request/response logging to executors
class DebugHTTPExecutor extends HTTPExecutor {
  async execute(request) {
    console.log('Request:', request);
    const response = await super.execute(request);
    console.log('Response:', response);
    return response;
  }
}
```

### Health Check Details
```typescript
const health = gateway.getHealthStatus();
const opencode = health.find(h => h.providerId === 'opencode');
console.log(opencode);
// {
//   providerId: 'opencode',
//   healthy: true,
//   lastCheckTime: Date,
//   consecutiveFailures: 0,
//   lastError: undefined
// }
```

### Trace Provider Selection
```typescript
const { provider, model } = await router.route(request, 'smart-fallback');
console.log(`Using: ${provider.name} (${model})`);
console.log(`Transport: ${provider.transport}`);
console.log(`Rate limit: ${provider.rateLimit?.type}`);
```

---

## 7. Troubleshooting

| Issue | Diagnosis | Solution |
|-------|-----------|----------|
| High latency | Run benchmark, check `p95LatencyMs` | Switch to `fast-http` strategy, check provider status |
| All providers down | `monitor.getStats()` shows 0 healthy | Check network, reset provider health, review alerts |
| Rate limiting | Many 429 errors in logs | Implement request queue, reduce concurrency, use fallback providers |
| Memory leak | Increasing memory usage | Clear benchmark results, check browser pool cleanup |
| Model not found | 404 errors | Refresh model discovery, check provider catalog |

---

## See Also

- [README.md](./README.md) — Basic usage guide
- [EXAMPLES.md](./EXAMPLES.md) — Code examples
- OmniRoute repository — Source of provider configurations

