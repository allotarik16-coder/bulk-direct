import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { AddressInfo } from 'node:net';

/**
 * The failover itself: when Claude's quota runs out, the same request is served
 * by a free provider instead of failing.
 *
 * Claude is stood up as a local stub rather than mocked at the module boundary,
 * so the SDK's own error classification runs — which is the part that decides
 * whether a failure is "wait, it resets" or "your key is broken", and the part
 * a hand-rolled mock would quietly get wrong.
 */

process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

let claude: http.Server;
let freeProvider: http.Server;
let claudeStatus: { status: number; body: string; headers?: Record<string, string> };
let claudeHits = 0;

test.before(async () => {
  claude = http.createServer((req, res) => {
    claudeHits++;
    res.writeHead(claudeStatus.status, {
      'Content-Type': 'application/json',
      ...(claudeStatus.headers ?? {}),
    });
    res.end(claudeStatus.body);
  });
  await new Promise<void>((r) => claude.listen(0, '127.0.0.1', r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(claude.address() as AddressInfo).port}`;

  freeProvider = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: 'réponse gratuite' } }] }));
    });
  });
  await new Promise<void>((r) => freeProvider.listen(0, '127.0.0.1', r));
  const freeBase = `http://127.0.0.1:${(freeProvider.address() as AddressInfo).port}`;

  const { PROVIDER_ENDPOINTS } = await import('../src/providers/endpoints');
  PROVIDER_ENDPOINTS['opencode'] = { chat: `${freeBase}/chat`, source: 'test' };
  PROVIDER_ENDPOINTS['uncloseai'] = { chat: `${freeBase}/chat`, source: 'test' };
  PROVIDER_ENDPOINTS['aihorde'] = { chat: `${freeBase}/chat`, source: 'test' };
});

test.after(() => {
  claude.close();
  freeProvider.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

function claudeAnswers(text: string) {
  claudeStatus = {
    status: 200,
    body: JSON.stringify({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
  };
}

function claudeIsOutOfQuota(retryAfterSeconds?: number) {
  claudeStatus = {
    status: 429,
    body: JSON.stringify({ type: 'error', error: { type: 'rate_limit_error', message: 'quota' } }),
    headers: retryAfterSeconds ? { 'retry-after': String(retryAfterSeconds) } : {},
  };
}

test('Claude answers while it has quota', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  claudeAnswers('réponse de Claude');

  const res = await new FreeLLMGateway().execute({
    model: 'claude-opus-5',
    messages: [{ role: 'user', content: 'salut' }],
  });

  assert.equal(res.providerId, 'anthropic');
  assert.equal(res.content, 'réponse de Claude');
});

test('an exhausted quota falls through to a free provider, same request', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeIsOutOfQuota();

  const res = await gateway.execute({
    model: 'claude-opus-5',
    messages: [{ role: 'user', content: 'salut' }],
  });

  // The caller gets an answer, not a 429. That is the whole feature.
  assert.notEqual(res.providerId, 'anthropic');
  assert.equal(res.content, 'réponse gratuite');
});

test('a spent quota does not mark Claude unhealthy', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeIsOutOfQuota();

  await gateway.execute({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'x' }] });

  // Being out of allowance is not a fault. Recording it as one would need
  // three failures to trigger and would outlive the window reset.
  const health = gateway.getProviderHealth('anthropic');
  assert.equal(health?.healthy, true);
  assert.equal(health?.consecutiveFailures, 0);
});

test('once exhausted, Claude is not asked again until the cooldown lapses', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeIsOutOfQuota();

  await gateway.execute({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'x' }] });
  const afterFirst = claudeHits;

  await gateway.execute({ model: 'claude-opus-5', messages: [{ role: 'user', content: 'x' }] });

  // Re-asking a provider that just said "no quota" wastes a round trip on
  // every single request for the rest of the window.
  assert.equal(claudeHits, afterFirst, 'Claude must not be retried during cooldown');
});

test('a long retry-after does not stall the failover', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeIsOutOfQuota(90); // "come back in 90 seconds"

  const started = Date.now();
  const res = await gateway.execute({
    model: 'claude-opus-5',
    messages: [{ role: 'user', content: 'x' }],
  });
  const elapsed = Date.now() - started;

  // Regression guard: the SDK retries 429s and obeys retry-after, so the
  // default client slept 90s (twice) instead of failing over. The header is
  // for scheduling the cooldown, never for blocking the caller.
  assert.equal(res.content, 'réponse gratuite');
  assert.ok(elapsed < 5000, `failover took ${elapsed}ms — the SDK is sleeping on retry-after`);

  // …and the header must still be honoured for scheduling. The SDK exposes
  // headers as a `Headers` object, where bracket access returns undefined, so
  // this silently fell back to the 60s default and threw away the real number.
  const seconds = (gateway.cooldownEndsAt('anthropic')!.getTime() - Date.now()) / 1000;
  assert.ok(seconds > 80, `cooldown is ${seconds}s — retry-after: 90 was not read`);
});

test('retry-after sets when Claude is expected back', async () => {
  const { FreeLLMRouter } = await import('../src/router/router');
  const router = new FreeLLMRouter();

  router.recordQuotaExhausted('anthropic', 120_000);

  const endsAt = router.cooldownEndsAt('anthropic');
  assert.ok(endsAt, 'a cooling-down provider must report when it returns');
  const seconds = (endsAt!.getTime() - Date.now()) / 1000;
  assert.ok(seconds > 100 && seconds <= 120, `expected ~120s, got ${seconds}`);
});

test('the cooldown expires on its own', async () => {
  const { FreeLLMRouter } = await import('../src/router/router');
  const router = new FreeLLMRouter();

  router.recordQuotaExhausted('anthropic', -1); // already elapsed

  // Nothing sweeps these, so expiry has to be lazy or a provider never returns.
  assert.equal(router.isCoolingDown('anthropic'), false);
  assert.equal(router.cooldownEndsAt('anthropic'), null);
});

test('a bad key is NOT treated as exhausted quota', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeStatus = {
    status: 401,
    body: JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }),
  };

  // Silently answering from a weaker free model would hide the broken key
  // behind worse output — far harder to notice than a failed request.
  await assert.rejects(
    gateway.execute({ model: 'claude-opus-5', provider: 'anthropic', messages: [{ role: 'user', content: 'x' }] }),
    /clé API invalide/
  );
});

test('an overloaded Claude also fails over', async () => {
  const { FreeLLMGateway } = await import('../src/gateway');
  const gateway = new FreeLLMGateway();
  claudeStatus = {
    status: 529,
    body: JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'overloaded' } }),
  };

  const res = await gateway.execute({
    model: 'claude-opus-5',
    messages: [{ role: 'user', content: 'x' }],
  });

  // Transient capacity on Anthropic's side is the same shape of problem as a
  // spent quota: try someone else, come back later.
  assert.equal(res.content, 'réponse gratuite');
});
