import { BaseExecutor } from './base';
import { LLMRequest, LLMResponse } from '../types';

/**
 * Passthrough executor for providers that accept any model name
 * (UncloseAI, AI Horde, etc.)
 */
export class PassthroughExecutor extends BaseExecutor {
  private endpoint: string;
  private modelsEndpoint?: string;
  private dummyApiKey: string = 'dummy-key-for-passthrough';

  constructor(providerId: string, providerName: string, endpoint: string, modelsEndpoint?: string) {
    super(providerId, providerName);
    this.endpoint = endpoint;
    this.modelsEndpoint = modelsEndpoint;
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.dummyApiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: request.stream || false,
          temperature: request.temperature || 0.7,
          max_tokens: request.maxTokens || 2048,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const content = this.extractContent(data);

      return {
        providerId: this.providerId,
        modelId: request.model,
        content,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const { error: errorMsg } = this.buildError(error);
      throw new Error(`${this.providerName} failed: ${errorMsg}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    // Without a model-list endpoint there is nothing cheap to probe: the chat
    // endpoint is POST-only, so a GET would report a false outage.
    if (!this.modelsEndpoint) return true;

    try {
      const response = await this.fetchWithTimeout(this.modelsEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.dummyApiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private extractContent(data: any): string {
    // Handle various response formats
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.choices?.[0]?.text) {
      return data.choices[0].text;
    }
    if (data.message) {
      return data.message;
    }
    if (typeof data === 'string') {
      return data;
    }

    throw new Error('Unable to extract content from response');
  }
}
