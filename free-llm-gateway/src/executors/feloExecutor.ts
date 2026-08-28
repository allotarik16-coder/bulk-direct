import { BaseExecutor } from './base';
import { LLMRequest, LLMResponse } from '../types';

const FELO_BASE = 'https://felo.ai';
const FELO_THREADS_URL = `${FELO_BASE}/api-proxy/main/search/threads`;
const FELO_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';

const FELO_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Content-Type': 'application/json',
  Origin: FELO_BASE,
  Referer: `${FELO_BASE}/search?q=hello`,
  'User-Agent': FELO_USER_AGENT,
};

/** Felo has no published model list; the category drives its answer pipeline. */
const FELO_MODEL_CATEGORIES: Record<string, string> = {
  'felo-chat': 'chat',
  'felo-search': 'google',
  'felo-scholar': 'scholar',
  'felo-social': 'social',
  'felo-document': 'document',
};

export function feloStreamUrl(streamKey: string, base: string = FELO_BASE): string {
  return `${base}/api/message/v1/stream/${encodeURIComponent(streamKey)}?offset=0`;
}

export function resolveFeloCategory(model?: string | null): string {
  return FELO_MODEL_CATEGORIES[(model ?? '').toLowerCase()] ?? 'chat';
}

export function buildFeloThreadPayload(model: string | undefined | null, prompt: string) {
  const searchUuid = globalThis.crypto.randomUUID();
  return {
    query: prompt,
    search_uuid: searchUuid,
    lang: '',
    agent_lang: 'en',
    search_options: { langcode: 'en-US' },
    search_video: true,
    query_from: 'default',
    category: resolveFeloCategory(model),
    model: '',
    auto_routing: true,
    mode: 'concise',
    device_id: globalThis.crypto.randomUUID().replace(/-/g, ''),
    source_message_rid: '',
    documents: [],
    document_action: '',
    slides_source: { type: 'ask_question', files: {} },
    slide_template_uid: '',
    selected_resource_ids: [],
    process_id: searchUuid,
    stream_protocol: 'message_center_v1',
  };
}

interface FeloParsedLine {
  newText: string | null;
  nextPreviousText: string;
}

/**
 * Each `answer` event carries the FULL text so far, not a delta, so the new
 * content is the suffix past what we already have. Concatenating events
 * verbatim would repeat the whole answer on every frame.
 */
export function parseFeloStreamLine(line: string, previousText: string): FeloParsedLine {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:{')) return { newText: null, nextPreviousText: previousText };

  let outer: any;
  try {
    outer = JSON.parse(trimmed.slice(5));
  } catch {
    return { newText: null, nextPreviousText: previousText };
  }

  const content = outer?.content;
  if (typeof content !== 'string') return { newText: null, nextPreviousText: previousText };

  let contentJson: any;
  try {
    contentJson = JSON.parse(content);
  } catch {
    return { newText: null, nextPreviousText: previousText };
  }

  const text = extractFeloAnswerText(contentJson);
  if (text === null) return { newText: null, nextPreviousText: previousText };

  if (text.startsWith(previousText)) {
    const newPart = text.slice(previousText.length);
    return newPart
      ? { newText: newPart, nextPreviousText: text }
      : { newText: null, nextPreviousText: previousText };
  }

  // Upstream rewrote the answer rather than extending it; take it wholesale.
  return { newText: text, nextPreviousText: text };
}

function extractFeloAnswerText(contentJson: any): string | null {
  const text = contentJson?.text ?? contentJson?.answer;
  return typeof text === 'string' ? text : null;
}

export function accumulateFeloStreamText(rawText: string): string {
  let previousText = '';
  for (const line of rawText.split('\n')) {
    previousText = parseFeloStreamLine(line, previousText).nextPreviousText;
  }
  return previousText;
}

export class FeloExecutor extends BaseExecutor {
  /** Overridable so the two-step handoff can be driven against a test server. */
  private base: string;

  constructor(providerId: string, providerName: string, base: string = FELO_BASE) {
    super(providerId, providerName);
    this.base = base;
  }

  async execute(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      const prompt = lastUserText(request);

      // 1. Open a thread; the response carries the stream key.
      const threadResponse = await this.fetchWithTimeout(`${this.base}/api-proxy/main/search/threads`, {
        method: 'POST',
        headers: FELO_HEADERS,
        body: JSON.stringify(buildFeloThreadPayload(request.model, prompt)),
      });

      if (!threadResponse.ok) {
        throw new Error(
          `HTTP ${threadResponse.status}: ${threadResponse.statusText} ${(await threadResponse.text()).slice(0, 200)}`
        );
      }

      const thread = (await threadResponse.json()) as { stream_key?: unknown };
      const streamKey = thread?.stream_key;
      if (typeof streamKey !== 'string') {
        throw new Error('Felo did not return a stream_key');
      }

      // 2. Drain the stream that key points at.
      const streamResponse = await this.fetchWithTimeout(feloStreamUrl(streamKey, this.base), {
        method: 'GET',
        headers: {
          Accept: '*/*',
          Origin: FELO_BASE,
          Referer: FELO_HEADERS.Referer,
          'User-Agent': FELO_USER_AGENT,
        },
      });

      if (!streamResponse.ok) {
        throw new Error(
          `HTTP ${streamResponse.status}: ${streamResponse.statusText} ${(await streamResponse.text()).slice(0, 200)}`
        );
      }

      return {
        providerId: this.providerId,
        modelId: request.model,
        content: accumulateFeloStreamText(await streamResponse.text()),
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      const { error: errorMsg } = this.buildError(error);
      throw new Error(`${this.providerName} failed: ${errorMsg}`);
    }
  }

  async healthCheck(): Promise<boolean> {
    return true; // No cheap probe: opening a thread is a real request.
  }
}

/** Felo takes a single query string, not a message array. */
function lastUserText(request: LLMRequest): string {
  const lastUser = [...(request.messages ?? [])].reverse().find((m: any) => m.role === 'user');
  const content = (lastUser as any)?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part: any) => (typeof part === 'string' ? part : (part?.text ?? '')))
      .join('');
  }
  return '';
}
