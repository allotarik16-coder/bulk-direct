import { BaseExecutor } from './base';
import { HTTPExecutor } from './httpExecutor';
import { PassthroughExecutor } from './passthroughExecutor';
import { FREE_LLM_PROVIDERS } from '../providers/config';

export { BaseExecutor, HTTPExecutor, PassthroughExecutor };

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
      case 'browser-automation':
        // TODO: Implement BrowserExecutor with Playwright
        return this.createHTTPExecutor(providerId, provider); // Fallback for now
      case 'reverse-engineered':
        // TODO: Implement ReverseEngineeredExecutor (WebSocket, SockJS, etc.)
        return this.createHTTPExecutor(providerId, provider); // Fallback for now
      case 'local-cli':
        // TODO: Implement LocalCLIExecutor
        throw new Error(`Local CLI executors not yet implemented: ${providerId}`);
      default:
        throw new Error(`Unknown transport type: ${provider.transport}`);
    }
  }

  /**
   * Create HTTP executor
   */
  private createHTTPExecutor(providerId: string, provider: any): BaseExecutor {
    let endpoint = '';

    switch (providerId) {
      case 'opencode':
        endpoint = 'https://opencode.ai/zen/v1/chat/completions';
        break;
      case 'theoldllm':
        endpoint = 'https://theoldllm.vercel.app/api/chat';
        break;
      default:
        endpoint = `https://${provider.website?.replace('https://', '').split('/')[0]}/api/chat`;
    }

    return new HTTPExecutor(providerId, provider.name, endpoint);
  }

  /**
   * Create passthrough executor
   */
  private createPassthroughExecutor(providerId: string, provider: any): BaseExecutor {
    let endpoint = '';

    switch (providerId) {
      case 'uncloseai':
        endpoint = 'https://api.uncloseai.com/v1/chat/completions';
        break;
      case 'aihorde':
        endpoint = 'https://api.aihorde.net/v2/generate/text/async';
        break;
      default:
        endpoint = provider.website || '';
    }

    if (!endpoint) {
      throw new Error(`No endpoint configured for ${providerId}`);
    }

    return new PassthroughExecutor(providerId, provider.name, endpoint);
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
