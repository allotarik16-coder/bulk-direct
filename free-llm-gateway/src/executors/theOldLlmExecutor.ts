import { BaseExecutor } from './base';
import { LLMRequest, LLMResponse } from '../types';
import { PROVIDER_ENDPOINTS } from '../providers/endpoints';

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const TOKEN_SEED = 'oldllm-client-2026';
const UA_PREFIX = CHROME_UA.slice(0, 20); // "Mozilla/5.0 (Windows"
const CLIENT_VERSION = '3.8.4';

/**
 * Reproduces the SPA's `rie()`:
 *   e = `${now}-${TOKEN_SEED}-${navigator.userAgent.slice(0,20)}`
 *   t = djb2-ish hash of e
 *   -> `${now.toString(36)}-${abs(t).toString(36)}-${8 hex chars}`
 *
 * The seed is a static constant and the UA prefix is ours to choose, so this is
 * a pure function — no browser needed, despite the provider's "browser session"
 * description. Ported from omniroute open-sse/executors/theoldllm.ts.
 */
export function generateRequestToken(now: number = Date.now()): string {
  const e = `${now}-${TOKEN_SEED}-${UA_PREFIX}`;
  let t = 0;
  for (let i = 0; i < e.length; i++) {
    t = (t << 5) - t + e.charCodeAt(i);
    t = t & t; // force int32 wraparound
  }
  const r = randomHex8();
  return `${now.toString(36)}-${Math.abs(t).toString(36)}-${r}`;
}

function randomHex8(): string {
  return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

/** Collapse an SSE body into its concatenated delta text. */
export function parseSseContent(sseText: string): string {
  let content = '';
  for (const line of sseText.split('\n')) {
    if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
    try {
      const d = JSON.parse(line.slice(6));
      content += d.choices?.[0]?.delta?.content || d.choices?.[0]?.delta?.text || '';
    } catch {
      // A partial or non-JSON frame; the next one carries the text.
    }
  }
  return content;
}

export class TheOldLlmExecutor extends BaseExecutor {
  private endpoint: string;

  constructor(providerId: string, providerName: string) {
    super(providerId, providerName);
    const endpoint = PROVIDER_ENDPOINTS[providerId]?.chat;
    if (!endpoint) throw new Error(`No endpoint configured for "${providerId}"`);
    this.endpoint = endpoint;
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const response = await this.fetchWithTimeout(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': CLIENT_VERSION,
          'X-Request-Token': generateRequestToken(),
          'User-Agent': CHROME_UA,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: request.stream ?? true,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 2048,
        }),
      });

      const body = await response.text();

      if (!response.ok) {
        // Vercel's bot protection fronts this host; surface it as its own thing
        // so it is not mistaken for the model being unavailable.
        if (isVercelMitigation(response, body)) {
          throw new Error('Blocked by Vercel bot protection (needs a different egress IP)');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = body.includes('data: ') ? parseSseContent(body) : extractJsonContent(body);

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
    // POST-only endpoint with no model list; a GET would report a false outage.
    return true;
  }
}

export function isVercelMitigation(response: Response, body: string): boolean {
  const mitigation = response.headers.get('x-vercel-mitigated')?.toLowerCase();
  if (mitigation === 'deny' || mitigation === 'challenge') return true;
  return (
    (response.status === 403 || response.status === 429) &&
    /vercel security checkpoint|"message"\s*:\s*"forbidden"/i.test(body)
  );
}

function extractJsonContent(body: string): string {
  const data = JSON.parse(body);
  return data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? '';
}
