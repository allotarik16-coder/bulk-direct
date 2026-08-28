# Free LLM Gateway — Usage Examples

## 1. Basic Request Routing

```typescript
import { gateway } from 'free-llm-gateway';

async function askAI(question: string) {
  const response = await gateway.execute({
    model: 'any',
    messages: [
      { role: 'user', content: question }
    ],
  });
  
  console.log(`Response: ${response.content}`);
  console.log(`Served by: ${response.providerId}`);
}

askAI('What is AI?').catch(console.error);
```

## 2. Model-Specific Request

```typescript
// Route to a specific model with fallback
const response = await gateway.execute({
  model: 'claude-opus',
  messages: [{ role: 'user', content: 'Explain machine learning' }],
});

console.log(response.content);
```

## 3. Provider-Specific Request

```typescript
// Use only OpenCode (direct HTTP, no browser)
const response = await gateway.execute({
  provider: 'opencode',
  model: 'claude-fable-5',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## 4. Strategy Selection

```typescript
// Use fast-http strategy (no browser automation)
const response = await gateway.execute(
  {
    model: 'any',
    messages: [{ role: 'user', content: 'Quick response needed' }],
  },
  'fast-http' // Other options: 'reliable-only', 'browser-friendly', 'cost-optimized'
);
```

## 5. Model Discovery

```typescript
// Find all available Claude models
const allModels = await gateway.getAllModels();
const claudeModels = allModels.filter(m => 
  m.model.displayName.toLowerCase().includes('claude')
);

console.log('Available Claude models:');
claudeModels.forEach(m => {
  console.log(`  - ${m.model.displayName} (${m.provider.name})`);
});
```

## 6. Search for a Specific Model

```typescript
// Find where to use GPT-4o
const found = await gateway.findModel('gpt-4o');
if (found) {
  console.log(`GPT-4o available at: ${found.provider.name}`);
  console.log(`Provider website: ${found.provider.website}`);
}
```

## 7. Get Model Capabilities

```typescript
// Check if a model supports streaming
const capabilities = await gateway.getModelCapabilities('claude-opus');
console.log(capabilities);
// Output: [
//   { type: 'text', supported: true },
//   { type: 'tool-calling', supported: true }
// ]
```

## 8. Health Monitoring

```typescript
// Check overall gateway health
const summary = gateway.getSummary();
console.log(`Healthy providers: ${summary.healthyProviders}/${summary.totalProviders}`);

// Monitor specific provider
const opencodeHealth = gateway.getProviderHealth('opencode');
if (opencodeHealth?.healthy) {
  console.log('OpenCode is online');
} else {
  console.log(`OpenCode down (${opencodeHealth?.consecutiveFailures} failures)`);
}
```

## 9. Recovery/Reset

```typescript
// If a provider is struggling, reset its health status
gateway.resetProviderHealth('opencode');

// Now it will be considered healthy again and included in routing
const response = await gateway.execute({
  model: 'claude-fable-5',
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## 10. Cache Management

```typescript
// View what's cached
const cacheStats = gateway.getCacheStats();
cacheStats.forEach(stat => {
  console.log(`${stat.provider}: ${stat.totalCached} models cached, expires at ${stat.expiredAt}`);
});

// Clear all cache
gateway.clearCache();

// Refresh models from source
await gateway.discoverModels('opencode', /* forceRefresh */ true);

// Clear cache for one provider
gateway.clearCache('aihorde');
```

## 11. Multi-Model Comparison

```typescript
async function compareModels(question: string) {
  const providers = ['opencode', 'theoldllm', 'uncloseai'];
  
  for (const providerId of providers) {
    try {
      const response = await gateway.execute({
        provider: providerId,
        model: 'any',
        messages: [{ role: 'user', content: question }],
      });
      
      console.log(`[${providerId}] ${response.content.substring(0, 100)}...`);
    } catch (error) {
      console.log(`[${providerId}] Error: ${(error as Error).message}`);
    }
  }
}

compareModels('What is quantum computing?').catch(console.error);
```

## 12. Streaming Response

```typescript
async function streamResponse(question: string) {
  const response = await gateway.execute({
    model: 'claude',
    messages: [{ role: 'user', content: question }],
    stream: true, // Request streaming
  });
  
  // Handle streaming (implementation depends on executor)
  console.log(response.content);
}

streamResponse('Tell me a story').catch(console.error);
```

## 13. Batch Requests with Fallback

```typescript
async function batchRequests(questions: string[]) {
  const results = [];
  
  for (const q of questions) {
    try {
      const response = await gateway.execute(
        {
          model: 'any',
          messages: [{ role: 'user', content: q }],
        },
        'smart-fallback' // Auto-fallback if provider fails
      );
      results.push({
        question: q,
        answer: response.content,
        provider: response.providerId,
      });
    } catch (error) {
      console.error(`Failed for: ${q}`);
    }
  }
  
  return results;
}

const questions = [
  'What is AI?',
  'Explain quantum computing',
  'How do neural networks work?',
];

batchRequests(questions).then(results => {
  results.forEach(r => {
    console.log(`Q: ${r.question}\nA: ${r.answer}\n`);
  });
});
```

## 14. Custom Strategy Selection Logic

```typescript
async function smartRoute(model: string) {
  // Choose strategy based on model requirements
  let strategy = 'smart-fallback';
  
  if (model.includes('claude') || model.includes('gpt')) {
    // These models are available on multiple providers, use fast-http
    strategy = 'fast-http';
  } else if (model === 'unknown-experimental') {
    // Try passthrough providers (more model support)
    strategy = 'reliable-only';
  }
  
  return gateway.execute({
    model,
    messages: [{ role: 'user', content: 'Hello' }],
  }, strategy);
}

smartRoute('claude-opus').catch(console.error);
```

## 15. Error Handling & Retry

```typescript
async function executeWithRetry(request: any, maxRetries = 3) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}`);
      return await gateway.execute(request, 'smart-fallback');
    } catch (error) {
      lastError = error;
      console.error(`Attempt ${attempt} failed:`, (error as Error).message);
      
      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  throw lastError;
}

executeWithRetry({
  model: 'claude',
  messages: [{ role: 'user', content: 'Hello' }],
}).catch(console.error);
```

---

## Production Setup Checklist

```typescript
// 1. Initialize with appropriate cache duration
const gateway = new FreeLLMGateway(3600000); // 1 hour cache

// 2. Set default strategy for your use case
gateway.setDefaultStrategy('fast-http'); // Or 'reliable-only'

// 3. Monitor health periodically
setInterval(() => {
  const summary = gateway.getSummary();
  if (summary.unhealthyProviders > 3) {
    console.warn('Too many unhealthy providers!');
    // Alert ops team
  }
}, 60000); // Every minute

// 4. Use error handling
try {
  const response = await gateway.execute(request);
} catch (error) {
  // Fall back to paid provider or queue for retry
  fallbackToPaidProvider(request);
}

// 5. Log provider usage for analytics
const summary = gateway.getSummary();
console.log(JSON.stringify(summary, null, 2));
```

---

## Advanced: Custom Router Logic

```typescript
import { FreeLLMRouter } from 'free-llm-gateway';

const router = new FreeLLMRouter();

// Manual routing for complex logic
async function customRoute() {
  const request = {
    model: 'claude-opus',
    messages: [{ role: 'user', content: 'Hello' }],
  };
  
  // Get the best provider for this request
  const { provider, model } = await router.route(request, 'smart-fallback');
  
  console.log(`Using: ${provider.name} (${provider.alias})`);
  console.log(`Transport: ${provider.transport}`);
  console.log(`Rate limit: ${provider.rateLimit?.type}`);
  
  // Now use provider-specific executor
  // ...
}
```

---

For more examples and advanced usage, see `README.md` and source code.
