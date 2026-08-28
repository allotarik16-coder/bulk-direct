import { LLMRequest, LLMResponse } from '../types';

export abstract class BaseExecutor {
  providerId: string;
  providerName: string;
  requestTimeout: number = 30000; // 30 seconds

  constructor(providerId: string, providerName: string) {
    this.providerId = providerId;
    this.providerName = providerName;
  }

  /**
   * Execute an LLM request
   */
  abstract execute(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Check if provider is healthy (connectivity test)
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get estimated latency for this provider
   */
  async estimateLatency(): Promise<number> {
    const start = Date.now();
    try {
      await this.healthCheck();
      return Date.now() - start;
    } catch {
      return 30000; // Timeout value on failure
    }
  }

  /**
   * Build error response
   */
  protected buildError(error: unknown): { error: string; statusCode: number } {
    if (error instanceof Error) {
      const message = error.message;

      // Check egress problems FIRST. A sandbox/corporate proxy refusing a host
      // answers 403, and reading that as "Authentication failed" sends you
      // hunting for a credential that was never the problem.
      const blockedHost = extractBlockedHost(message);
      if (blockedHost) {
        return {
          error: `Blocked by network egress policy: "${blockedHost}" is not in the allowlist (not a provider error)`,
          statusCode: 403,
        };
      }
      if (/fetch failed|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|tunnel/i.test(message)) {
        return { error: `Network unreachable: ${message.slice(0, 120)}`, statusCode: 503 };
      }

      if (message.includes('timeout') || message.includes('Timeout')) {
        return { error: 'Request timeout', statusCode: 408 };
      }
      if (message.includes('429')) {
        return { error: 'Rate limited', statusCode: 429 };
      }
      if (message.includes('401') || message.includes('403')) {
        return { error: 'Authentication failed', statusCode: 401 };
      }
      if (message.includes('404')) {
        return { error: 'Model not found', statusCode: 404 };
      }

      return { error: message.substring(0, 200), statusCode: 500 };
    }

    return { error: 'Unknown error', statusCode: 500 };
  }

  /**
   * Fetch with timeout
   */
  protected async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Recognises an egress-proxy rejection, e.g.
 *   "Host not in allowlist: opencode.ai. Add this host to your network egress…"
 * Returns the host so callers can name exactly what to allow.
 */
export function extractBlockedHost(message: string): string | null {
  // Dots are part of the hostname, so they cannot be excluded from the class;
  // only the sentence-ending period is stripped afterwards. Excluding them
  // yielded "opencode" instead of "opencode.ai" — useless for an allowlist.
  const match = message.match(/host not in allowlist:\s*([^\s,]+)/i);
  return match ? match[1].replace(/\.$/, '') : null;
}
