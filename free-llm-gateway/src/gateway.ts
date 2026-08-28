import { FreeLLMRouter } from './router/router';
import { ModelDiscovery } from './discovery/modelDiscovery';
import { ExecutorFactory } from './executors';
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
   * Execute an LLM request with automatic provider selection
   */
  async execute(request: LLMRequest, strategy: string = 'smart-fallback'): Promise<LLMResponse> {
    const { provider, model } = await this.router.route(request, strategy);

    try {
      const executor = this.executorFactory.getExecutor(provider.id);
      const response = await executor.execute({ ...request, model });

      this.router.recordSuccess(provider.id);
      return response;
    } catch (error) {
      this.router.recordFailure(provider.id, (error as Error).message, model);
      throw error;
    }
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
