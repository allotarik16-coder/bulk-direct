import { FreeLLMRouter } from './router/router';
import { ModelDiscovery } from './discovery/modelDiscovery';
import { ExecutorFactory } from './executors';
import { QuotaExhaustedError } from './executors/anthropicExecutor';
import { FreeLLMProvider, LLMRequest, LLMResponse, HealthStatus, FreeLLMModel } from './types';
import { FREE_LLM_PROVIDERS } from './providers/config';

export class FreeLLMGateway {
  private router: FreeLLMRouter;
  private discovery: ModelDiscovery;
  private executorFactory: ExecutorFactory;
  private cacheDurationMs: number;

  constructor(cacheDurationMs: number = 3600000) {
    this.cacheDurationMs = cacheDurationMs;
    this.router = new FreeLLMRouter();
    this.discovery = new ModelDiscovery(cacheDurationMs);
    this.executorFactory = new ExecutorFactory();
  }

  /**
   * Execute an LLM request with automatic provider selection.
   *
   * An exhausted quota is the one failure this retries on its own: the primary
   * provider is put on cooldown and the next one in the chain serves the same
   * request, so a spent Claude allowance degrades to a free model instead of
   * surfacing as an error. Every other failure still throws — a 401 answered by
   * silently switching to a weaker model would hide the broken key behind worse
   * output, which is far harder to notice than a failed request.
   */
  async execute(request: LLMRequest, strategy: string = 'smart-fallback'): Promise<LLMResponse> {
    const exhausted: string[] = [];

    // Bounded by the catalog: each pass puts one provider on cooldown, so the
    // loop cannot revisit it and cannot outlast the provider list.
    for (let attempt = 0; attempt <= Object.keys(FREE_LLM_PROVIDERS).length; attempt++) {
      const { provider, model } = await this.router.route(request, strategy);

      try {
        const executor = this.executorFactory.getExecutor(provider.id);
        const response = await executor.execute({ ...request, model });

        this.router.recordSuccess(provider.id);
        return response;
      } catch (error) {
        if (error instanceof QuotaExhaustedError) {
          this.router.recordQuotaExhausted(error.providerId, error.retryAfterMs);
          exhausted.push(provider.id);
          continue; // routing now skips it — the next provider gets this request
        }

        this.router.recordFailure(provider.id, (error as Error).message, model);
        throw error;
      }
    }

    throw new Error(
      `All providers are out of quota (${exhausted.join(', ')}). Retry once a window resets.`
    );
  }

  /**
   * Fetch every provider's live model list and hand it to the router, so that
   * routing can skip a passthrough provider that does not carry the requested
   * model. Optional: without it the router stays permissive for passthrough.
   *
   * Does network I/O — call it at startup, not per request.
   */
  async warmup(): Promise<void> {
    const discovered = await this.discovery.discoverAllModels();
    discovered.forEach((models, providerId) => {
      this.router.setModelIndex(
        providerId,
        models.map((m) => m.id)
      );
    });
  }

  /**
   * Get all available providers
   */
  getProviders(): FreeLLMProvider[] {
    return this.router.getProviders();
  }

  /**
   * Get available routing strategies
   */
  getStrategies(): string[] {
    return this.router.getStrategies();
  }

  /**
   * Set default routing strategy
   */
  setDefaultStrategy(strategy: string) {
    this.router.setDefaultStrategy(strategy);
  }

  /**
   * Discover available models
   */
  async discoverModels(providerId?: string, forceRefresh: boolean = false): Promise<Map<string, FreeLLMModel[]> | FreeLLMModel[]> {
    if (providerId) {
      return this.discovery.discoverModels(providerId, forceRefresh);
    }
    return this.discovery.discoverAllModels(forceRefresh);
  }

  /**
   * Find a specific model
   */
  async findModel(modelQuery: string, providerId?: string): Promise<{ provider: FreeLLMProvider; model: FreeLLMModel } | null> {
    return this.discovery.findModel(modelQuery, providerId);
  }

  /**
   * Get model capabilities
   */
  async getModelCapabilities(modelId: string, providerId?: string) {
    return this.discovery.getModelCapabilities(modelId, providerId);
  }

  /**
   * Get health status of all providers
   */
  getHealthStatus(): HealthStatus[] {
    return this.router.getHealthStatus();
  }

  /**
   * Get provider health status
   */
  getProviderHealth(providerId: string): HealthStatus | undefined {
    return this.router.getHealthStatus().find((h) => h.providerId === providerId);
  }

  /**
   * When a provider whose quota ran out is expected back, or null if it is
   * available now. Health alone cannot answer this: a cooling-down provider
   * is still healthy, it just has nothing left this window.
   */
  cooldownEndsAt(providerId: string): Date | null {
    return this.router.cooldownEndsAt(providerId);
  }

  /**
   * Reset provider health (for recovery)
   */
  resetProviderHealth(providerId: string) {
    this.router.resetProviderHealth(providerId);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.discovery.getCacheStats();
  }

  /**
   * Clear discovery cache
   */
  clearCache(providerId?: string) {
    this.discovery.clearCache(providerId);
  }

  /**
   * Get recommended provider for a model
   */
  async getRecommendedProvider(modelQuery: string, strategy: string = 'smart-fallback'): Promise<FreeLLMProvider | null> {
    const found = await this.findModel(modelQuery);
    if (!found) return null;
    return found.provider;
  }

  /**
   * List all available models (flat)
   */
  async getAllModels(): Promise<Array<{ provider: FreeLLMProvider; model: FreeLLMModel }>> {
    const allDiscovered = await this.discoverModels();
    const result: Array<{ provider: FreeLLMProvider; model: FreeLLMModel }> = [];

    (allDiscovered as Map<string, FreeLLMModel[]>).forEach((models, providerId) => {
      const provider = FREE_LLM_PROVIDERS[providerId];
      if (provider) {
        models.forEach((model) => {
          result.push({ provider, model });
        });
      }
    });

    return result;
  }

  /**
   * Get gateway summary/stats
   */
  getSummary() {
    const providers = this.getProviders();
    const healthStatus = this.getHealthStatus();
    const healthy = healthStatus.filter((h) => h.healthy).length;

    return {
      totalProviders: providers.length,
      healthyProviders: healthy,
      unhealthyProviders: providers.length - healthy,
      strategies: this.getStrategies(),
      cacheStats: this.getCacheStats(),
      healthStatus: healthStatus,
    };
  }
}

// Export singleton instance
export const gateway = new FreeLLMGateway();
