import { FreeLLMProvider, DiscoveredModel, FreeLLMModel } from '../types';
import { FREE_LLM_PROVIDERS } from '../providers/config';
import { PROVIDER_ENDPOINTS } from '../providers/endpoints';

export class ModelDiscovery {
  private discoveredModels: Map<string, DiscoveredModel> = new Map();
  private modelCache: Map<string, FreeLLMModel[]> = new Map();
  private cacheExpiry: Map<string, Date> = new Map();
  private cacheDurationMs: number;
  private discoveryTimeoutMs: number = 5000;

  constructor(cacheDurationMs: number = 3600000) {
    this.cacheDurationMs = cacheDurationMs;
    this.initializeCache();
  }

  /**
   * Initialize cache with static models from provider configs
   */
  private initializeCache() {
    Object.entries(FREE_LLM_PROVIDERS).forEach(([providerId, provider]) => {
      this.modelCache.set(providerId, provider.models);
      this.cacheExpiry.set(providerId, new Date(Date.now() + this.cacheDurationMs));

      // Register discovered models
      provider.models.forEach((model) => {
        const key = `${providerId}:${model.id}`;
        this.discoveredModels.set(key, {
          providerId,
          modelId: model.id,
          discoveredAt: new Date(),
          available: true,
        });
      });
    });
  }

  /**
   * Discover available models for a specific provider
   * Can be extended with runtime model discovery endpoints
   */
  async discoverModels(providerId: string, forceRefresh: boolean = false): Promise<FreeLLMModel[]> {
    // Check cache first
    if (!forceRefresh && this.isCacheValid(providerId)) {
      return this.modelCache.get(providerId) || [];
    }

    const provider = FREE_LLM_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    try {
      const models = await this.fetchProviderModels(provider);
      this.modelCache.set(providerId, models);
      this.cacheExpiry.set(providerId, new Date(Date.now() + this.cacheDurationMs));
      return models;
    } catch (error) {
      console.error(`Failed to discover models for ${providerId}:`, error);
      // Return cached models on error
      return this.modelCache.get(providerId) || provider.models;
    }
  }

  /**
   * Discover all available models across all providers
   */
  async discoverAllModels(forceRefresh: boolean = false): Promise<Map<string, FreeLLMModel[]>> {
    const results = new Map<string, FreeLLMModel[]>();

    const providerDiscoveries = Object.keys(FREE_LLM_PROVIDERS).map((providerId) =>
      this.discoverModels(providerId, forceRefresh)
        .then((models) => {
          results.set(providerId, models);
        })
        .catch((error) => {
          console.error(`Discovery failed for ${providerId}:`, error);
          results.set(providerId, FREE_LLM_PROVIDERS[providerId].models);
        })
    );

    await Promise.all(providerDiscoveries);
    return results;
  }

  /**
   * Check if cache is still valid for a provider
   */
  private isCacheValid(providerId: string): boolean {
    const expiry = this.cacheExpiry.get(providerId);
    if (!expiry) return false;
    return expiry.getTime() > Date.now();
  }

  /**
   * Fetch available models from a provider
   * This is extensible for runtime API calls
   */
  private async fetchProviderModels(provider: FreeLLMProvider): Promise<FreeLLMModel[]> {
    // For now, return static config. This can be extended with:
    // - OpenCode: GET https://opencode.ai/zen/v1/models
    // - AI Horde: GET https://aihorde.net/api/v2/models
    // - Other providers: Custom endpoints

    switch (provider.id) {
      case 'aihorde':
        return this.fetchAIHordeModels();
      case 'uncloseai':
        return this.fetchUncloseAIModels();
      default:
        return provider.models;
    }
  }

  /**
   * fetch() with an abort-based timeout (RequestInit has no `timeout` field).
   */
  private async fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.discoveryTimeoutMs);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch models from AI Horde API
   */
  private async fetchAIHordeModels(): Promise<FreeLLMModel[]> {
    try {
      const url = PROVIDER_ENDPOINTS['aihorde']?.models;
      if (!url) return FREE_LLM_PROVIDERS['aihorde'].models;

      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // oai.aihorde.net is OpenAI-compatible: { data: [{ id }, ...] }.
      const payload = (await response.json()) as { data?: Array<{ id: string }> };
      return (payload.data ?? []).map((m) => ({
        id: m.id,
        name: m.id,
        displayName: m.id,
        capabilities: [{ type: 'text' as const, supported: true }],
        costPerMTok: 0,
      }));
    } catch (error) {
      console.warn('Failed to fetch AI Horde models:', error);
      return FREE_LLM_PROVIDERS['aihorde'].models;
    }
  }

  /**
   * Fetch models from UncloseAI
   */
  private async fetchUncloseAIModels(): Promise<FreeLLMModel[]> {
    try {
      const url = PROVIDER_ENDPOINTS['uncloseai']?.models;
      if (!url) return FREE_LLM_PROVIDERS['uncloseai'].models;

      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: 'Bearer dummy-key-for-public-list',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as any;
      return (data.data || []).map((m: any) => ({
        id: m.id,
        name: m.id,
        displayName: m.id,
        capabilities: [{ type: 'text' as const, supported: true }, { type: 'streaming' as const, supported: true }],
        costPerMTok: 0,
      }));
    } catch (error) {
      console.warn('Failed to fetch UncloseAI models:', error);
      return FREE_LLM_PROVIDERS['uncloseai'].models;
    }
  }

  /**
   * Search for a specific model across providers
   */
  async findModel(modelQuery: string, providerId?: string): Promise<{ provider: FreeLLMProvider; model: FreeLLMModel } | null> {
    const normalizedQuery = modelQuery.toLowerCase();

    if (providerId) {
      const provider = FREE_LLM_PROVIDERS[providerId];
      if (!provider) return null;

      const models = await this.discoverModels(providerId);
      const model = models.find((m) => m.id.toLowerCase().includes(normalizedQuery) || m.name.toLowerCase().includes(normalizedQuery));
      return model ? { provider, model } : null;
    }

    // Search across all providers
    const allModels = await this.discoverAllModels();
    for (const [providerId, models] of allModels) {
      const model = models.find((m) => m.id.toLowerCase().includes(normalizedQuery) || m.name.toLowerCase().includes(normalizedQuery));
      if (model) {
        return { provider: FREE_LLM_PROVIDERS[providerId], model };
      }
    }

    return null;
  }

  /**
   * Get model capabilities
   */
  async getModelCapabilities(modelId: string, providerId?: string): Promise<any> {
    const found = await this.findModel(modelId, providerId);
    if (!found) {
      return null;
    }
    return found.model.capabilities;
  }

  /**
   * Clear cache for a provider
   */
  clearCache(providerId?: string) {
    if (providerId) {
      this.modelCache.delete(providerId);
      this.cacheExpiry.delete(providerId);
    } else {
      this.modelCache.clear();
      this.cacheExpiry.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalCached: number; expiredAt: Date }[] {
    return Array.from(this.cacheExpiry.entries()).map(([providerId, expiry]) => ({
      provider: providerId,
      totalCached: this.modelCache.get(providerId)?.length || 0,
      expiredAt: expiry,
    })) as any;
  }
}
