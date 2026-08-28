import Anthropic from '@anthropic-ai/sdk';
import { BaseExecutor } from './base';
import { LLMRequest, LLMResponse } from '../types';

/**
 * Claude, as the primary provider the free ones fall back from.
 *
 * This is the one executor that uses a vendor SDK instead of raw fetch, and
 * the reason is the failover itself: distinguishing "quota exhausted, come
 * back later" from "your key is wrong" decides whether the gateway silently
 * switches to a weaker free model or surfaces a bug. The SDK exposes that as
 * typed error classes; scraping it out of a message string is guesswork that
 * breaks the first time the wording changes.
 */

/** Raised when Claude is out of capacity for now — the failover signal. */
export class QuotaExhaustedError extends Error {
  readonly providerId: string;
  /** When to try Claude again, from `retry-after` when the API sends one. */
  readonly retryAfterMs: number;

  constructor(providerId: string, message: string, retryAfterMs: number) {
    super(message);
    this.name = 'QuotaExhaustedError';
    this.providerId = providerId;
    this.retryAfterMs = retryAfterMs;
  }
}

/** No `retry-after` header: long enough not to hammer, short enough to recover. */
const DEFAULT_COOLDOWN_MS = 60_000;

export class AnthropicExecutor extends BaseExecutor {
  private client: Anthropic;
  private defaultModel: string;

  constructor(providerId: string, providerName: string, apiKey?: string, defaultModel = 'claude-opus-5') {
    super(providerId, providerName);
    this.defaultModel = defaultModel;
    this.client = new Anthropic({
      // A missing key is caught by isActive upstream; the empty string keeps
      // the constructor total so building the executor never throws.
      apiKey: apiKey ?? '',
      // The SDK retries 429s by default, and honours `retry-after` — so a
      // rate limit answering "come back in 90s" made it sleep 90 seconds,
      // twice, while the caller waited. That is the precise opposite of
      // failing over. Retrying here is the gateway's job, and its answer is
      // to route elsewhere immediately rather than wait for this provider.
      maxRetries: 0,
      timeout: this.requestTimeout,
    });
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    // Anthropic takes the system prompt as its own parameter rather than a
    // message role, so a conversation carrying one has to be split apart.
    const system = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const messages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const response = await this.client.messages.create({
        model: request.model === 'auto' ? this.defaultModel : request.model,
        // Required by the API, unlike the OpenAI-shaped providers where it is
        // optional — so it needs a real default, not a passthrough undefined.
        max_tokens: request.maxTokens ?? 4096,
        ...(system ? { system } : {}),
        messages,
      });

      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      return {
        providerId: this.providerId,
        modelId: response.model,
        content,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      throw this.classify(error);
    }
  }

  /**
   * Sort a failure into "wait and it fixes itself" versus "a human must fix
   * this". Only the first should ever trigger a silent downgrade to a free
   * provider — quietly swapping models because a key is malformed hides the
   * bug behind worse answers.
   */
  private classify(error: unknown): Error {
    if (error instanceof Anthropic.RateLimitError) {
      return new QuotaExhaustedError(
        this.providerId,
        `${this.providerName}: quota épuisé (429 ${error.type ?? 'rate_limit_error'})`,
        retryAfterMs(error) ?? DEFAULT_COOLDOWN_MS
      );
    }

    // 400 with a billing type, or 403 billing_error: credits are spent. Same
    // shape of problem as a rate limit — capacity, not correctness — but it
    // does not resolve on a timer, so the cooldown is long enough that the
    // gateway stops asking rather than retrying every minute.
    if (error instanceof Anthropic.APIError && String(error.type ?? '').includes('billing')) {
      return new QuotaExhaustedError(
        this.providerId,
        `${this.providerName}: crédits épuisés (${error.type})`,
        15 * 60_000
      );
    }

    if (error instanceof Anthropic.InternalServerError) {
      // Includes 529 overloaded_error. Transient capacity on Anthropic's side:
      // failing over is right, and it recovers on its own.
      return new QuotaExhaustedError(
        this.providerId,
        `${this.providerName}: surchargé (${error.status})`,
        retryAfterMs(error) ?? DEFAULT_COOLDOWN_MS
      );
    }

    if (error instanceof Anthropic.AuthenticationError) {
      // Never a failover: a bad key silently downgrading every request to a
      // free model is the exact bug this split exists to prevent.
      return new Error(`${this.providerName} failed: clé API invalide (401) — corrige ANTHROPIC_API_KEY`);
    }

    if (error instanceof Anthropic.NotFoundError) {
      // Surfaces as "model not found" so the router locks the model rather
      // than blaming the provider — the same treatment every other executor gets.
      return new Error(`${this.providerName} failed: Model not found (404): ${error.message.slice(0, 160)}`);
    }

    const { error: message } = this.buildError(error);
    return new Error(`${this.providerName} failed: ${message}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.models.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * `retry-after` is in seconds when present; absent on most 429s.
 *
 * The SDK exposes headers as a `Headers` object, where bracket access silently
 * returns undefined — so reading it that way always fell back to the default
 * cooldown and quietly discarded the one number the API gave us. Both shapes
 * are handled because only `.get()` works on `Headers` and only bracket access
 * works on the plain objects the tests and older SDK paths produce.
 */
function retryAfterMs(error: InstanceType<typeof Anthropic.APIError>): number | null {
  const headers = error.headers as Headers | Record<string, string> | undefined;
  if (!headers) return null;

  const raw =
    typeof (headers as Headers).get === 'function'
      ? (headers as Headers).get('retry-after')
      : (headers as Record<string, string>)['retry-after'];
  if (!raw) return null;

  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : null;
}
