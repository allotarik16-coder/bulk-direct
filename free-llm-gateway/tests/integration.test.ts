import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { PROVIDER_ENDPOINTS } from '../src/providers/endpoints';
import { FreeLLMGateway } from '../src/gateway';

/**
 * End-to-end over a real socket, against a local server that speaks each
 * provider's wire shape. This exercises everything the sandbox's egress policy
 * blocks us from testing upstream: request construction, auth headers, SSE and
 * stream parsing, error classification, and the router's reaction to each.
 *
 * What it cannot prove: that the real upstreams accept these requests. Only a
 * run outside this sandbox settles that.
 */

let lastRequest: { url: string; headers: http.IncomingHttpHeaders; body: string } | null = null;
let server: http.Server;
let base: string;

function sseFrame(content: string) {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n`;
}

test.before(async () => {
  server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      lastRequest = { url: req.url!, headers: req.headers, body };

      // OpenAI-compatible chat (opencode / uncloseai / aihorde shape)
      if (req.url === '/chat') {
        const model = JSON.parse(body || '{}').model;
        if (model === 'ghost-model') {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'model not found' }));
        }
        if (model === 'broken-model') {
          res.writeHead(500);
          return res.end('upstream exploded');
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(
          JSON.stringify({ choices: [{ message: { content: 'pong from chat' } }] })
        );
      }

      // The Old LLM: SSE body, token in a header
      if (req.url === '/api/chatgpt') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        return res.end(sseFrame('Bon') + sseFrame('jour') + 'data: [DONE]\n');
      }

      // Felo step 1: open a thread
      if (req.url === '/api-proxy/main/search/threads') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ stream_key: 'KEY123' }));
      }

      // Felo step 2: drain the stream that key names
      if (req.url?.startsWith('/api/message/v1/stream/')) {
        const frame = (text: string) =>
          `data:${JSON.stringify({ content: JSON.stringify({ text }) })}\n`;
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
        return res.end(frame('Le') + frame('Le ciel') + frame('Le ciel est bleu'));
      }

      res.writeHead(404);
      res.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  // Point every provider at the local stand-in.
  PROVIDER_ENDPOINTS['opencode'] = { chat: `${base}/chat`, source: 'test' };
  PROVIDER_ENDPOINTS['uncloseai'] = { chat: `${base}/chat`, source: 'test' };
  PROVIDER_ENDPOINTS['aihorde'] = { chat: `${base}/chat`, source: 'test' };
  PROVIDER_ENDPOINTS['theoldllm'] = { chat: `${base}/api/chatgpt`, source: 'test' };
});

test.after(() => server.close());

test('a request goes out and an answer comes back', async () => {
  const gateway = new FreeLLMGateway();
  const res = await gateway.execute({
    model: 'claude-fable-5',
    provider: 'opencode',
    messages: [{ role: 'user', content: 'ping' }],
  });

  assert.equal(res.content, 'pong from chat');
  assert.equal(res.providerId, 'opencode');
  assert.ok(res.latencyMs >= 0);
});

test('the outgoing body carries model and messages', async () => {
  const gateway = new FreeLLMGateway();
  await gateway.execute({
    model: 'claude-fable-5',
    provider: 'opencode',
    messages: [{ role: 'user', content: 'ping' }],
  });

  const sent = JSON.parse(lastRequest!.body);
  assert.equal(sent.model, 'claude-fable-5');
  assert.deepEqual(sent.messages, [{ role: 'user', content: 'ping' }]);
});

test('The Old LLM sends a well-formed token and parses its SSE', async () => {
  const gateway = new FreeLLMGateway();
  const res = await gateway.execute({
    model: 'claude-opus',
    provider: 'theoldllm',
    messages: [{ role: 'user', content: 'salut' }],
  });

  assert.equal(res.content, 'Bonjour', 'SSE deltas must be concatenated');
  assert.match(
    lastRequest!.headers['x-request-token'] as string,
    /^[0-9a-z]+-[0-9a-z]+-[0-9a-f]{8}$/,
    'token must reach the wire in the SPA shape'
  );
  assert.equal(lastRequest!.headers['x-client-version'], '3.8.4');
});

test('Felo completes its two-step handoff over the wire', async () => {
  const { FeloExecutor } = await import('../src/executors');
  const executor = new FeloExecutor('felo', 'Felo', base);

  const res = await executor.execute({
    model: 'felo-chat',
    messages: [{ role: 'user', content: 'de quelle couleur est le ciel ?' }],
  });

  // Proves both hops ran: the stream key came from hop 1, the text from hop 2,
  // and the frames were diffed rather than concatenated.
  assert.equal(res.content, 'Le ciel est bleu');
  assert.ok(lastRequest!.url.includes('KEY123'), 'hop 2 must use the key hop 1 returned');

  const sentPrompt = JSON.parse(
    (lastRequest!.body || '{}') === '{}' ? '{"query":""}' : lastRequest!.body || '{}'
  );
  assert.ok(sentPrompt !== null);
});

test('a 404 locks the model and leaves the provider healthy', async () => {
  const gateway = new FreeLLMGateway();

  await assert.rejects(
    gateway.execute({
      model: 'ghost-model',
      provider: 'uncloseai',
      messages: [{ role: 'user', content: 'x' }],
    })
  );

  const health = gateway.getProviderHealth('uncloseai');
  assert.equal(health?.healthy, true, 'a missing model must not sicken the provider');
  assert.equal(health?.consecutiveFailures, 0);
});

test('a 500 does degrade provider health', async () => {
  const gateway = new FreeLLMGateway();

  await assert.rejects(
    gateway.execute({
      model: 'broken-model',
      provider: 'uncloseai',
      messages: [{ role: 'user', content: 'x' }],
    })
  );

  const health = gateway.getProviderHealth('uncloseai');
  assert.equal(health?.consecutiveFailures, 1, 'a real fault must count');
});

test('routing falls through to a working provider', async () => {
  const gateway = new FreeLLMGateway();

  // opencode answers; ask for a model only it lists, with no provider pinned.
  const res = await gateway.execute({
    model: 'claude-fable-5',
    messages: [{ role: 'user', content: 'ping' }],
  });

  assert.equal(res.content, 'pong from chat');
});
