import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { PROVIDER_ENDPOINTS } from '../src/providers/endpoints';
import { createServer } from '../src/server';

/**
 * The gateway-as-a-service contract, over a real socket.
 *
 * What matters here is that N calling projects need nothing but a URL: the
 * request shape is OpenAI's, the credentials stay on this side, and a caller
 * without the shared token gets nothing.
 */

let upstream: http.Server;
let gateway: http.Server;
let gatewayUrl: string;

const TOKEN = 'test-gateway-token';

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${gatewayUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const text = await res.text();
  return { status: res.status, text, json: () => JSON.parse(text) };
}

function authed(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  };
}

test.before(async () => {
  // Stand-in upstream so no real provider is contacted.
  upstream = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const model = JSON.parse(body || '{}').model;
      if (model === 'explodes') {
        res.writeHead(500);
        return res.end('upstream exploded');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'réponse du provider' } }] }));
    });
  });
  await new Promise<void>((r) => upstream.listen(0, '127.0.0.1', r));
  const upstreamBase = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
  PROVIDER_ENDPOINTS['opencode'] = { chat: `${upstreamBase}/chat`, source: 'test' };

  gateway = createServer({ token: TOKEN, allowedOrigins: ['https://app.example'] });
  await new Promise<void>((r) => gateway.listen(0, '127.0.0.1', r));
  gatewayUrl = `http://127.0.0.1:${(gateway.address() as AddressInfo).port}`;
});

test.after(() => {
  gateway.close();
  upstream.close();
});

test('a project with only a URL and a token gets an answer', async () => {
  const res = await call(
    '/v1/chat/completions',
    authed({ model: 'claude-fable-5', provider: 'opencode', messages: [{ role: 'user', content: 'ping' }] })
  );

  assert.equal(res.status, 200);
  const body = res.json();
  assert.equal(body.choices[0].message.content, 'réponse du provider');
  assert.equal(body.object, 'chat.completion', 'clients parse by this field');
  assert.equal(body.provider, 'opencode', 'which upstream answered must be visible');
});

test('no token means no access', async () => {
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify({ model: 'claude-fable-5', messages: [{ role: 'user', content: 'ping' }] }),
  });

  // An open LLM proxy is drained by scanners; this is the whole defence.
  assert.equal(res.status, 401);
  assert.equal(res.json().error.code, 'invalid_api_key');
});

test('a wrong token is refused too', async () => {
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer not-the-token' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] }),
  });

  assert.equal(res.status, 401);
});

test('health needs no token, so a load balancer can probe it', async () => {
  const res = await call('/health');

  assert.equal(res.status, 200);
  assert.equal(res.json().status, 'ok');
});

test('the model list reports what each model costs', async () => {
  const res = await call('/v1/models', { headers: { Authorization: `Bearer ${TOKEN}` } });

  assert.equal(res.status, 200);
  const data = res.json().data;
  assert.ok(data.length > 0);
  // A caller choosing a model must not have to read the README to learn that
  // one of them bills per token.
  assert.ok(data.every((m: any) => m.billing === 'free' || m.billing === 'paid'));
});

test('a malformed body is rejected before routing', async () => {
  const res = await call('/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: 'not json at all',
  });

  assert.equal(res.status, 400);
  assert.equal(res.json().error.type, 'invalid_request_error');
});

test('missing messages is a client error, not a crash', async () => {
  const res = await call('/v1/chat/completions', authed({ model: 'claude-fable-5' }));

  assert.equal(res.status, 400);
  assert.match(res.json().error.message, /messages/);
});

test('an upstream failure reports 502, not 500', async () => {
  const res = await call(
    '/v1/chat/completions',
    authed({ model: 'explodes', provider: 'opencode', messages: [{ role: 'user', content: 'x' }] })
  );

  // The distinction tells a caller whether retrying could possibly help.
  assert.equal(res.status, 502);
  assert.equal(res.json().error.code, 'all_providers_failed');
});

test('stream: true returns SSE a client can actually parse', async () => {
  const res = await fetch(`${gatewayUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({
      model: 'claude-fable-5',
      provider: 'opencode',
      stream: true,
      messages: [{ role: 'user', content: 'ping' }],
    }),
  });
  const text = await res.text();

  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  assert.ok(text.includes('chat.completion.chunk'));
  assert.ok(text.trimEnd().endsWith('data: [DONE]'), 'clients loop until the sentinel');
});

test('CORS is granted to a listed origin and withheld from others', async () => {
  const allowed = await fetch(`${gatewayUrl}/health`, { headers: { Origin: 'https://app.example' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example');

  const stranger = await fetch(`${gatewayUrl}/health`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(stranger.headers.get('access-control-allow-origin'), null);
});

test('an unknown route says so instead of hanging', async () => {
  const res = await call('/v1/embeddings', { headers: { Authorization: `Bearer ${TOKEN}` } });

  assert.equal(res.status, 404);
});
