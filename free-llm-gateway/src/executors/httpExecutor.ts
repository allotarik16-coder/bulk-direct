import { BaseExecutor } from './base';
import { LLMRequest, LLMResponse } from '../types';

export class HTTPExecutor extends BaseExecutor {
  private endpoint: string;
  private modelsEndpoint?: string;
  private apiKey?: string;

  constructor(
    providerId: string,
    providerName: string,
    endpoint: string,
    modelsEndpoint?: string,
    apiKey?: string
  ) {
    super(providerId, providerName);
    this.endpoint = endpoint;
    this.modelsEndpoint = modelsEndpoint;
    this.apiKey = apiKey;
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
        },
        body: JSON.stringify(this.buildPayload(request)),
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
    // The chat endpoint is POST-only, so probe the model list when there is one.
    // Without it, report healthy rather than manufacturing an outage from a GET.
    if (!this.modelsEndpoint) return true;

    try {
      const response = await this.fetchWithTimeout(this.modelsEndpoint, {
        method: 'GET',
        headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildPayload(request: LLMRequest): any {
    // OpenAI-compatible format
    return {
      model: request.model,
      messages: request.messages,
      stream: request.stream || false,
      temperature: request.temperature || 0.7,
      max_tokens: request.maxTokens || 2048,
    };
  }

  private extractContent(data: any): string {
    // Handle OpenAI-compatible response format
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    if (data.choices?.[0]?.text) {
      return data.choices[0].text;
    }
    if (typeof data.content === 'string') {
      return data.content;
    }

    throw new Error('Unable to extract content from response');
  }
}
