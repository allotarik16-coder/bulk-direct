import { FreeLLMProvider, RoutingStrategy, LLMRequest, HealthStatus } from '../types';
import { FREE_LLM_PROVIDERS, PROVIDER_FALLBACK_CHAIN, TRANSPORT_TYPE_PRIORITY } from '../providers/config';

/**
 * A 404 / "model not found" is a fact about one model, not about the provider.
 * Executors surface it via BaseExecutor.buildError as "Model not found".
 */
export function isModelNotFound(error: string): boolean {
  return /model not found|404/i.test(error);
}

export class FreeLLMRouter {
  private healthStatus: Map<string, HealthStatus> = new Map();
  private routingStrategies: Map<string, RoutingStrategy> = new Map();
  private defaultStrategy: string = 'smart-fallback';
  /** Live model lists from discovery, per provider. */
  private modelIndex: Map<string, Set<string>> = new Map();
  /** `providerId:modelId` -> epoch ms when the lockout lifts. */
  private modelLockouts: Map<string, number> = new Map();
  private modelLockoutMs = 15 * 60 * 1000;

  constructor() {
    this.initializeHealthStatus();
    this.registerStrategies();
  }

  private initializeHealthStatus() {
    Object.keys(FREE_LLM_PROVIDERS).forEach((providerId) => {
      this.healthStatus.set(providerId, {
        providerId,
        healthy: true,
        lastCheckTime: new Date(),
        consecutiveFailures: 0,
      });
    });
  }

  private registerStrategies() {
    // Smart Fallback: Try providers in order based on health + transport type priority
    this.routingStrategies.set('smart-fallback', {
      name: 'Smart Fallback',
      priority: (provider: FreeLLMProvider) => {
        const health = this.healthStatus.get(provider.id);
        const transportPriority = TRANSPORT_TYPE_PRIORITY[provider.transport] || 999;
        const healthPenalty = health?.consecutiveFailures ? health.consecutiveFailures * 100 : 0;
        return transportPriority + healthPenalty;
      },
      fallbackChain: PROVIDER_FALLBACK_CHAIN,
    });

    // Fast HTTP Only: Prioritize direct HTTP providers
    this.routingStrategies.set('fast-http', {
      name: 'Fast HTTP Only',
      priority: (provider: FreeLLMProvider) => {
        if (provider.transport === 'direct-http') return 1;
        if (provider.proxySupported) return 2;
        return 999; // Exclude browser-based and reverse-engineered
      },
      fallbackChain: ['opencode', 'theoldllm'],
    });

    // Reliable Only: Exclude reverse-engineered and browser-based providers
    this.routingStrategies.set('reliable-only', {
      name: 'Reliable Only',
      priority: (provider: FreeLLMProvider) => {
        if (provider.transport === 'direct-http') return 1;
        if (provider.transport === 'passthrough') return 2;
        return 999;
      },
      fallbackChain: ['opencode', 'uncloseai', 'aihorde'],
    });

    // Browser-Friendly: Allow browser automation (for UI/desktop apps)
    this.routingStrategies.set('browser-friendly', {
      name: 'Browser-Friendly',
      priority: () => 1,
      fallbackChain: PROVIDER_FALLBACK_CHAIN,
    });

    // Cost-Optimized: All free, but prefer lower resource usage
    this.routingStrategies.set('cost-optimized', {
      name: 'Cost-Optimized',
      priority: (provider: FreeLLMProvider) => {
        if (provider.transport === 'direct-http') return 1;
        if (provider.transport === 'passthrough') return 2;
        return 3;
      },
      fallbackChain: PROVIDER_FALLBACK_CHAIN,
    });
  }

  /**
   * Route a request to the best available provider
   */
  async route(request: LLMRequest, strategy: string = this.defaultStrategy): Promise<{ provider: FreeLLMProvider; model: string }> {
    const routingStrategy = this.routingStrategies.get(strategy) || this.routingStrategies.get(this.defaultStrategy)!;

    // Try to find exact provider if specified
    if (request.provider) {
      const provider = FREE_LLM_PROVIDERS[request.provider];
      if (provider && this.canProviderServe(provider, request.model)) {
        return { provider, model: request.model };
      }
    }

    // Try fallback chain
    for (const providerId of routingStrategy.fallbackChain) {
      const provider = FREE_LLM_PROVIDERS[providerId];
      if (!provider) continue;

      if (this.canProviderServe(provider, request.model)) {
        return { provider, model: request.model };
      }
    }

    // Fallback: sort all active providers by priority
    const sortedProviders = Object.values(FREE_LLM_PROVIDERS)
      .filter((p) => p.isActive && this.healthStatus.get(p.id)?.healthy !== false)
      .sort((a, b) => routingStrategy.priority(a) - routingStrategy.priority(b));

    if (sortedProviders.length === 0) {
      throw new Error('No free LLM providers available');
    }

    const selectedProvider = sortedProviders[0];
    const availableModel = selectedProvider.models[0];

    if (!availableModel) {
      throw new Error(`No models available for provider ${selectedProvider.id}`);
    }

    return { provider: selectedProvider, model: availableModel.id };
  }

  /**
   * Check if a provider can serve a specific model
   */
  private canProviderServe(provider: FreeLLMProvider, modelId: string): boolean {
    // Catalogued but not routable: no executor, or no verified endpoint.
    if (!provider.isActive) return false;

    const health = this.healthStatus.get(provider.id);
    if (health && !health.healthy && health.consecutiveFailures > 3) {
      return false; // Provider is too unhealthy
    }

    // This exact model already 404'd here; the provider itself is still fine.
    if (this.isModelLocked(provider.id, modelId)) return false;

    if (provider.transport === 'passthrough') {
      // Passthrough accepts any model name, so the static catalog says nothing
      // about what is actually served. Once discovery has fetched the live list
      // (see FreeLLMGateway.warmup), trust it; until then stay permissive —
      // refusing would drop the models that are the point of passthrough.
      const live = this.modelIndex.get(provider.id);
      if (!live) return true;
      return live.has(modelId);
    }

    // Check if provider has exact model
    return provider.models.some((m) => m.id === modelId || m.name.toLowerCase() === modelId.toLowerCase());
  }

  /**
   * Publish a provider's live model list, as fetched by discovery. Lets routing
   * skip a passthrough provider that demonstrably lacks the requested model
   * instead of spending a doomed request to find out.
   */
  setModelIndex(providerId: string, modelIds: string[]) {
    this.modelIndex.set(providerId, new Set(modelIds));
  }

  /**
   * Park one (provider, model) pair without touching provider health.
   */
  lockModel(providerId: string, modelId: string, ttlMs: number = this.modelLockoutMs) {
    this.modelLockouts.set(`${providerId}:${modelId}`, Date.now() + ttlMs);
  }

  isModelLocked(providerId: string, modelId: string): boolean {
    const until = this.modelLockouts.get(`${providerId}:${modelId}`);
    if (until === undefined) return false;
    if (until > Date.now()) return true;
    this.modelLockouts.delete(`${providerId}:${modelId}`); // lazily expire
    return false;
  }

  /**
   * Record a successful request
   */
  recordSuccess(providerId: string) {
    const health = this.healthStatus.get(providerId);
    if (health) {
      health.healthy = true;
      health.consecutiveFailures = 0;
      health.lastCheckTime = new Date();
    }
  }

  /**
   * Record a failed request.
   *
   * Pass `model` so a missing model can be told apart from a sick provider.
   * Without that split, three requests for three models a passthrough provider
   * happens not to carry would mark a perfectly healthy provider dead.
   */
  recordFailure(providerId: string, error: string, model?: string) {
    if (model && isModelNotFound(error)) {
      this.lockModel(providerId, model);
      return;
    }

    const health = this.healthStatus.get(providerId);
    if (health) {
      health.consecutiveFailures++;
      health.lastError = error;
      health.lastCheckTime = new Date();

      // Mark as unhealthy after 3 consecutive failures
      if (health.consecutiveFailures > 3) {
        health.healthy = false;
      }
    }
  }

  /**
   * Get all available providers
   */
  getProviders(): FreeLLMProvider[] {
    return Object.values(FREE_LLM_PROVIDERS);
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus(): HealthStatus[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get available routing strategies
   */
  getStrategies(): string[] {
    return Array.from(this.routingStrategies.keys());
  }

  /**
   * Set default routing strategy
   */
  setDefaultStrategy(strategy: string) {
    if (!this.routingStrategies.has(strategy)) {
      throw new Error(`Unknown strategy: ${strategy}`);
    }
    this.defaultStrategy = strategy;
  }

  /**
   * Reset health status for a provider (useful for recovery)
   */
  resetProviderHealth(providerId: string) {
    const health = this.healthStatus.get(providerId);
    if (health) {
      health.healthy = true;
      health.consecutiveFailures = 0;
      health.lastCheckTime = new Date();
    }
  }
}
