import { BaseExecutor } from './base';
import { HTTPExecutor } from './httpExecutor';
import { PassthroughExecutor } from './passthroughExecutor';
import { TheOldLlmExecutor } from './theOldLlmExecutor';
import { FeloExecutor } from './feloExecutor';
import { FREE_LLM_PROVIDERS } from '../providers/config';
import { PROVIDER_ENDPOINTS } from '../providers/endpoints';
import { getApiKey } from '../providers/apiKeys';

export { BaseExecutor, HTTPExecutor, PassthroughExecutor, TheOldLlmExecutor, FeloExecutor };

/**
 * Executor factory - creates appropriate executor for a provider
 */
export class ExecutorFactory {
  private executors: Map<string, BaseExecutor> = new Map();

  /**
   * Get or create executor for a provider
   */
  getExecutor(providerId: string): BaseExecutor {
    if (this.executors.has(providerId)) {
      return this.executors.get(providerId)!;
    }

    const provider = FREE_LLM_PROVIDERS[providerId];
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`);
    }

    const executor = this.createExecutor(providerId, provider);
    this.executors.set(providerId, executor);
    return executor;
  }

  /**
   * Create executor based on provider transport type
   */
  private createExecutor(providerId: string, provider: any): BaseExecutor {
    switch (provider.transport) {
      case 'direct-http':
        return this.createHTTPExecutor(providerId, provider);
      case 'passthrough':
        return this.createPassthroughExecutor(providerId, provider);
      // Bespoke HTTP handshakes (token minting, two-step stream handoff) that
      // the generic HTTPExecutor cannot express.
      case 'custom-http':
        return this.createCustomHTTPExecutor(providerId, provider);

      // The transports below are declared in the provider catalog but have no
      // executor yet. They must fail loudly: falling back to HTTPExecutor would
      // POST OpenAI-shaped JSON at a page/WebSocket that does not speak it, and
      // the resulting 4xx would look like a provider outage rather than a gap here.
      case 'browser-automation':
        throw new Error(
          `"${providerId}" needs a Playwright-based BrowserExecutor, which is not implemented yet.`
        );
      case 'reverse-engineered':
        throw new Error(
          `"${providerId}" needs a WebSocket/SockJS executor, which is not implemented yet.`
        );
      case 'local-cli':
        throw new Error(`"${providerId}" needs a LocalCLIExecutor, which is not implemented yet.`);
      default:
        throw new Error(`Unknown transport type: ${provider.transport}`);
    }
  }

  /**
   * Create HTTP executor
   */
  private createHTTPExecutor(providerId: string, provider: any): BaseExecutor {
    const entry = PROVIDER_ENDPOINTS[providerId];
    if (!entry?.chat) {
      throw new Error(
        `No verified chat endpoint for "${providerId}". Add one to PROVIDER_ENDPOINTS before routing to it.`
      );
    }

    // The key was never passed before, so every keyed provider 401'd with
    // "Missing API key" no matter what was in the environment.
    return new HTTPExecutor(providerId, provider.name, entry.chat, entry.models, getApiKey(providerId));
  }

  /**
   * Providers whose auth is a bespoke HTTP handshake rather than a bearer token.
   */
  private createCustomHTTPExecutor(providerId: string, provider: any): BaseExecutor {
    switch (providerId) {
      case 'theoldllm':
        return new TheOldLlmExecutor(providerId, provider.name);
      case 'felo':
        return new FeloExecutor(providerId, provider.name);
      default:
        throw new Error(`No custom-http executor registered for "${providerId}"`);
    }
  }

  /**
   * Create passthrough executor
   */
  private createPassthroughExecutor(providerId: string, provider: any): BaseExecutor {
    const entry = PROVIDER_ENDPOINTS[providerId];
    if (!entry?.chat) {
      throw new Error(
        `No verified chat endpoint for "${providerId}". Add one to PROVIDER_ENDPOINTS before routing to it.`
      );
    }

    return new PassthroughExecutor(
      providerId,
      provider.name,
      entry.chat,
      entry.models,
      getApiKey(providerId)
    );
  }

  /**
   * Clear cached executors
   */
  clearCache() {
    this.executors.clear();
  }

  /**
   * Get all cached executors
   */
  getExecutors(): Map<string, BaseExecutor> {
    return new Map(this.executors);
  }
}
