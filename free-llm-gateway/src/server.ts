import http from 'node:http';
import { FreeLLMGateway } from './gateway';
import { FREE_LLM_PROVIDERS } from './providers/config';
import { LLMRequest } from './types';

/**
 * The gateway as one HTTP endpoint, so N projects need zero setup between them.
 *
 * As a library, every project that wants free LLM access has to install this
 * package AND hold its own credentials — which is per-project configuration
 * wearing a different hat. Deployed once, the keys live in exactly one place
 * and every other project is a plain fetch() to an OpenAI-compatible URL:
 *
 *   POST https://<your-gateway>/v1/chat/completions
 *
 * No SDK, no keys, nothing to update in 28 repositories when one rotates.
 */

const MAX_BODY_BYTES = 1_000_000;

export interface ServerOptions {
  /**
   * Shared secret callers must present as `Authorization: Bearer <token>`.
   *
   * Required on any non-loopback bind. An unauthenticated LLM proxy on a public
   * address is found by scanners in hours, and the bill arrives as somebody
   * else's traffic exhausting the free tiers this whole project exists to use.
   */
  token?: string;
  /** Origins allowed to call from a browser. Empty disables CORS entirely. */
  allowedOrigins?: string[];
}

/** OpenAI's error envelope: clients already know how to render this shape. */
function errorBody(message: string, type: string, code?: string) {
  return JSON.stringify({ error: { message, type, code: code ?? null } });
}

function send(res: http.ServerResponse, status: number, body: string, extra: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extra,
  });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      // Refuse before buffering the whole thing: an unbounded read is how a
      // single caller takes the process down for everyone else.
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * Constant-time-ish comparison. Not a defence against a serious side-channel
 * attacker over a network, but it costs nothing and removes the trivial
 * early-exit leak of a plain !==.
 */
function tokenMatches(expected: string, received: string): boolean {
  if (expected.length !== received.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ received.charCodeAt(i);
  return diff === 0;
}

function corsHeaders(origin: string | undefined, allowed: string[]): Record<string, string> {
  if (allowed.length === 0 || !origin) return {};
  if (!allowed.includes(origin) && !allowed.includes('*')) return {};

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    Vary: 'Origin',
  };
}

/** Shape a gateway result like an OpenAI chat completion. */
function toOpenAIResponse(content: string, model: string, providerId: string) {
  return {
    id: `chatcmpl-${Date.now().toString(36)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    // Not part of OpenAI's schema: which free provider actually answered. It is
    // the first thing you want when a response looks wrong, and a client that
    // does not know the field ignores it.
    provider: providerId,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  };
}

export function createServer(options: ServerOptions = {}): http.Server {
  const gateway = new FreeLLMGateway();
  const allowedOrigins = options.allowedOrigins ?? [];

  return http.createServer(async (req, res) => {
    const cors = corsHeaders(req.headers.origin, allowedOrigins);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }

    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/health' && req.method === 'GET') {
      // Deliberately before the auth check: a load balancer probing health
      // should not need the shared secret, and this leaks nothing sensitive.
      return send(res, 200, JSON.stringify({ status: 'ok', providers: gateway.getHealthStatus() }), cors);
    }

    if (options.token) {
      const header = req.headers.authorization ?? '';
      const presented = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

      if (!presented || !tokenMatches(options.token, presented)) {
        return send(
          res,
          401,
          errorBody('Missing or invalid gateway token.', 'invalid_request_error', 'invalid_api_key'),
          cors
        );
      }
    }

    if (url.pathname === '/v1/models' && req.method === 'GET') {
      const data = Object.values(FREE_LLM_PROVIDERS)
        .filter((p) => p.isActive)
        .flatMap((p) =>
          p.models.map((m) => ({
            id: m.id,
            object: 'model',
            owned_by: p.id,
            // Callers routing their own spend need to see this without
            // cross-referencing the README.
            billing: p.billing ?? 'free',
          }))
        );

      return send(res, 200, JSON.stringify({ object: 'list', data }), cors);
    }

    if (url.pathname === '/v1/chat/completions' && req.method === 'POST') {
      let payload: any;
      try {
        payload = JSON.parse(await readBody(req));
      } catch (error) {
        const message = (error as Error).message.includes('too large')
          ? 'Request body too large.'
          : 'Request body is not valid JSON.';
        return send(res, 400, errorBody(message, 'invalid_request_error'), cors);
      }

      if (!Array.isArray(payload?.messages) || payload.messages.length === 0) {
        return send(res, 400, errorBody('`messages` must be a non-empty array.', 'invalid_request_error'), cors);
      }

      const request: LLMRequest = {
        model: payload.model ?? 'auto',
        messages: payload.messages,
        temperature: payload.temperature,
        maxTokens: payload.max_tokens,
        // `provider` is this gateway's extension: it pins one upstream instead
        // of routing. Named apart from `model` so it cannot collide with a
        // future OpenAI field.
        provider: payload.provider,
      };

      try {
        const result = await gateway.execute(request);
        const body = toOpenAIResponse(result.content, result.modelId, result.providerId);

        if (payload.stream) {
          // The executors return a complete answer, so there is nothing to
          // stream incrementally. Emitting one chunk plus [DONE] keeps
          // stream-mode clients working instead of failing them outright;
          // it is a compatibility shim, not real token streaming.
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-store',
            Connection: 'keep-alive',
            ...cors,
          });
          const chunk = {
            ...body,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
          };
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          res.write('data: [DONE]\n\n');
          return res.end();
        }

        return send(res, 200, JSON.stringify(body), cors);
      } catch (error) {
        // Every provider refused. 502 rather than 500: the fault is upstream,
        // and the distinction is what tells a caller whether retrying helps.
        return send(res, 502, errorBody((error as Error).message, 'api_error', 'all_providers_failed'), cors);
      }
    }

    return send(res, 404, errorBody(`Unknown route: ${req.method} ${url.pathname}`, 'invalid_request_error'), cors);
  });
}
