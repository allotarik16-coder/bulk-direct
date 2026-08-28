# Free LLM Gateway

A unified, zero-cost AI gateway that aggregates **9+ free LLM providers** with intelligent routing, automatic failover, and dynamic model discovery.

## Features

✅ **9 Free LLM Providers** — OpenCode, DuckDuckGo, Cloudflare, The Old LLM, UncloseAI, AI Horde, Felo, Chipotle, Veo

✅ **Intelligent Routing** — 5 strategies with health-aware failover

✅ **Dynamic Model Discovery** — Automatic model catalog with caching

✅ **Health Tracking** — Monitor provider availability and performance

✅ **Zero Cost** — No API keys, no signup, no billing

✅ **Production Ready** — Built on TypeScript with full type safety

---

## Installation

```bash
npm install free-llm-gateway
# or
yarn add free-llm-gateway
```

---

## Quick Start

### Basic Usage

```typescript
import { gateway } from 'free-llm-gateway';

// Execute an LLM request (automatic provider selection)
const response = await gateway.execute({
  model: 'claude',
  messages: [
    { role: 'user', content: 'Hello, world!' }
  ],
  stream: true
});

console.log(response.content);
console.log(`Served by: ${response.providerId}`);
```

### With Specific Strategy

```typescript
// Use fast HTTP-only strategy (no browser automation)
const response = await gateway.execute(
  {
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Explain AI' }],
  },
  'fast-http'
);
```

### Discover Models

```typescript
// Discover all available models
const allModels = await gateway.getAllModels();
console.log(allModels);
// Output: [
//   { provider: { id: 'opencode', ... }, model: { id: 'claude-fable-5', ... } },
//   { provider: { id: 'opencode', ... }, model: { id: 'glm', ... } },
//   ...
// ]

// Find a specific model
const found = await gateway.findModel('claude');
console.log(found?.provider.name); // "The Old LLM"
console.log(found?.model.displayName); // "Claude 4.6 Opus"

// Discover models from one provider
const openCodeModels = await gateway.discoverModels('opencode');
```

### Health Monitoring

```typescript
// Get overall gateway health
const summary = gateway.getSummary();
console.log(summary);
// Output: {
//   totalProviders: 9,
//   healthyProviders: 8,
//   unhealthyProviders: 1,
//   strategies: ['smart-fallback', 'fast-http', 'reliable-only', ...],
//   healthStatus: [...]
// }

// Check specific provider health
const health = gateway.getProviderHealth('opencode');
console.log(health);
// Output: {
//   providerId: 'opencode',
//   healthy: true,
//   lastCheckTime: 2024-08-28T...,
//   consecutiveFailures: 0
// }

// Reset a provider (for recovery)
gateway.resetProviderHealth('opencode');
```

---

## Routing Strategies

### 1. **smart-fallback** (Default)
Balances reliability with latency. Tries providers in order, skipping unhealthy ones.

```typescript
await gateway.execute(request, 'smart-fallback');
```

**Fallback chain**: opencode → theoldllm → duckduckgo → cloudflare → aihorde → uncloseai

### 2. **fast-http**
Uses only direct HTTP providers (no browser automation). Best for server environments.

```typescript
await gateway.execute(request, 'fast-http');
```

**Eligible providers**: opencode, theoldllm (HTTP via Playwright)

### 3. **reliable-only**
Excludes reverse-engineered/unofficial providers. Safest for production.

```typescript
await gateway.execute(request, 'reliable-only');
```

**Eligible providers**: opencode, uncloseai, aihorde

### 4. **browser-friendly**
Allows browser automation. Good for UI/desktop apps.

```typescript
await gateway.execute(request, 'browser-friendly');
```

### 5. **cost-optimized**
Prioritizes low resource usage (all free, so focuses on transport efficiency).

```typescript
await gateway.execute(request, 'cost-optimized');
```

---

## Available Providers

| Provider | Alias | Transport | Models | Rate Limit | Proxy |
|----------|-------|-----------|--------|-----------|-------|
| **OpenCode** | `oc` | HTTP | Kimi, GLM, Qwen | Per-IP | ✅ |
| **DuckDuckGo** | `ddgw` | Browser | GPT-4o, Claude | Per-session | ❌ |
| **Cloudflare** | `cfp` | WebSocket | GLM 5.2, Kimi, DeepSeek | Per-IP | ❌ |
| **The Old LLM** | `tllm` | Browser | GPT-5.4, Claude (all) | Per-session | ✅ |
| **UncloseAI** | `unc` | Passthrough | Any (100+ models) | Unknown | ❌ |
| **AI Horde** | `horde` | Passthrough | 100+ crowdsourced | Shared queue | ❌ |
| **Felo** | `felo` | Reverse-eng | Chat/Search | Unknown | ❌ |
| **Chipotle** | `pepper` | Reverse-eng | Pepper AI | Per-IP | ❌ |
| **Veo** | `veo-free` | HTTP | Video gen (VEO 3.1) | 6/hour | ❌ |

---

## Configuration

### Custom Strategy

```typescript
import { FreeLLMRouter } from 'free-llm-gateway';

const router = new FreeLLMRouter();
router.setDefaultStrategy('fast-http');

const strategies = router.getStrategies();
console.log(strategies); // ['smart-fallback', 'fast-http', 'reliable-only', ...]
```

### Cache Management

```typescript
// Clear all model cache
gateway.clearCache();

// Clear cache for one provider
gateway.clearCache('opencode');

// Refresh models (skip cache)
await gateway.discoverModels('opencode', /* forceRefresh */ true);

// View cache stats
console.log(gateway.getCacheStats());
// Output: [
//   { provider: 'opencode', totalCached: 5, expiredAt: ... },
//   { provider: 'duckduckgo', totalCached: 2, expiredAt: ... },
//   ...
// ]
```

---

## Advanced: Manual Routing

```typescript
import { FreeLLMRouter, ModelDiscovery } from 'free-llm-gateway';

const router = new FreeLLMRouter();
const discovery = new ModelDiscovery();

// Manual provider selection
const { provider, model } = await router.route({
  model: 'claude-opus',
  messages: [...],
}, 'smart-fallback');

console.log(`Using: ${provider.name} (${model})`);

// Manual model discovery
const allModels = await discovery.discoverAllModels();
allModels.forEach((models, providerId) => {
  console.log(`${providerId}: ${models.map(m => m.id).join(', ')}`);
});
```

---

## Error Handling

```typescript
try {
  const response = await gateway.execute({
    model: 'unknown-model',
    messages: [{ role: 'user', content: 'Hello' }],
  });
} catch (error) {
  if (error.message === 'No free LLM providers available') {
    console.error('All providers are down');
  } else {
    console.error('Routing error:', error);
  }
}
```

---

## Performance Notes

| Aspect | Performance |
|--------|-------------|
| **Direct HTTP** | 100-500ms latency, instant recovery |
| **Browser-based** | 1-3s latency (browser startup), stable |
| **Reverse-engineered** | 500-2000ms latency, behavior may drift |
| **Passthrough** | 100-300ms latency, flexible model support |
| **AI Horde queue** | 10s-5min (crowdsourced, variable) |

### Tips for Production

1. **Use `fast-http` strategy** for server APIs — avoids browser overhead
2. **Monitor health status** — watch `consecutiveFailures` to detect issues early
3. **Implement request timeouts** — set your HTTP client timeout to 30s (AI Horde may queue)
4. **Cache model discovery** — default 1 hour cache reduces startup overhead
5. **Rotate strategies** — fallback to `reliable-only` if `smart-fallback` hits rate limits

---

## Architecture

```
Free LLM Gateway
├── Router (intelligent provider selection)
│   ├── 5 routing strategies
│   ├── Health tracking (consecutive failures, last error)
│   └── Fallback chain management
├── Discovery (dynamic model catalog)
│   ├── Static config (built-in models)
│   ├── Runtime API polling (AI Horde, UncloseAI)
│   └── LRU cache with expiry
└── Executor (provider-specific transport)
    ├── Direct HTTP (OpenCode, The Old LLM)
    ├── Browser automation (Playwright)
    ├── Reverse-engineered (WebSocket, SockJS)
    ├── Passthrough (UncloseAI, AI Horde)
    └── Local CLI (Devin, Auggie, ZCode)
```

---

## Troubleshooting

### "No free LLM providers available"
All providers are marked unhealthy (>3 consecutive failures). Reset health:

```typescript
gateway.resetProviderHealth('opencode');
gateway.resetProviderHealth('theoldllm');
```

### Model not found
Query cache, then check upstream:

```typescript
// Force refresh from source
await gateway.discoverModels('opencode', /* forceRefresh */ true);

// Search case-insensitive
const found = await gateway.findModel('claude-opus');
console.log(found?.model.displayName); // Might have different casing
```

### Rate limit errors
Switch strategy to spread across providers:

```typescript
// Already hitting rate limits on one provider?
// Router will automatically failover on next request
// Or manually select a different strategy:
await gateway.execute(request, 'reliable-only');
```

### Slow responses
Check strategy + latency:

```typescript
const summary = gateway.getSummary();
console.log('Health:', summary.healthStatus);
// If many providers unhealthy, consider forcing refresh:
gateway.clearCache();
```

---

## Contributing

This module is designed to be **provider-agnostic**. To add a new free LLM provider:

1. Define provider config in `src/providers/config.ts`
2. Add model discovery endpoint (if available) in `src/discovery/modelDiscovery.ts`
3. Register executor in `src/executors/` (transport-specific)
4. Add tests in `tests/`

---

## License

MIT — Use freely in any project.

---

## Disclaimer

This gateway uses free/public LLM endpoints. Providers may:
- Change their APIs without notice (especially reverse-engineered providers)
- Rate limit or block scrapers
- Vary model availability and quality
- Experience downtime

Use in production at your own risk. For critical workloads, combine with paid providers (OpenAI, Anthropic, etc.) as fallback.

---

## Support

For issues, model discovery, or routing questions:
- Check `gateway.getSummary()` for overall health
- Inspect `gateway.getHealthStatus()` for provider-specific status
- Use `gateway.discoverModels()` to verify available models
- Review router logs for fallback chain traces

