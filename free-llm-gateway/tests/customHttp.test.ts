import assert from 'node:assert/strict';
import test from 'node:test';
import { generateRequestToken, parseSseContent } from '../src/executors/theOldLlmExecutor';
import { accumulateFeloStreamText, parseFeloStreamLine, resolveFeloCategory } from '../src/executors/feloExecutor';
import { ExecutorFactory } from '../src/executors';
import { extractBlockedHost } from '../src/executors/base';
import { FreeLLMRouter } from '../src/router/router';
import { FREE_LLM_PROVIDERS } from '../src/providers/config';

// ── The Old LLM: token is a pure function, so it is checkable without network ──

test('request token has the shape the SPA produces', () => {
  const token = generateRequestToken(1_700_000_000_000);
  const [ts, hash, rand] = token.split('-');

  assert.equal(ts, (1_700_000_000_000).toString(36), 'first field is base36 millis');
  assert.match(hash, /^[0-9a-z]+$/, 'second field is a base36 hash');
  assert.equal(rand.length, 8, 'third field is 8 chars');
  assert.equal(token.split('-').length, 3);
});

test('token hash is deterministic for a given timestamp', () => {
  const a = generateRequestToken(1_700_000_000_000).split('-')[1];
  const b = generateRequestToken(1_700_000_000_000).split('-')[1];
  assert.equal(a, b, 'same millis must hash identically; only the suffix is random');
});

test('token hash changes with the timestamp', () => {
  const a = generateRequestToken(1_700_000_000_000).split('-')[1];
  const b = generateRequestToken(1_700_000_000_001).split('-')[1];
  assert.notEqual(a, b);
});

test('SSE deltas concatenate and [DONE] is ignored', () => {
  const sse = [
    'data: {"choices":[{"delta":{"content":"Bon"}}]}',
    'data: {"choices":[{"delta":{"content":"jour"}}]}',
    'data: [DONE]',
  ].join('\n');
  assert.equal(parseSseContent(sse), 'Bonjour');
});

test('a malformed SSE frame does not abort the rest of the stream', () => {
  const sse = ['data: {"choices":[{"delta":{"content":"A"}}]}', 'data: {broken', 'data: {"choices":[{"delta":{"content":"B"}}]}'].join('\n');
  assert.equal(parseSseContent(sse), 'AB');
});

// ── Felo: each event carries the FULL answer, so frames must be diffed ──

test('felo frames are diffed, not concatenated', () => {
  const frame = (text: string) => `data:${JSON.stringify({ content: JSON.stringify({ text }) })}`;
  const raw = [frame('Le'), frame('Le ciel'), frame('Le ciel est bleu')].join('\n');

  // Naive concatenation would give "LeLe cielLe ciel est bleu".
  assert.equal(accumulateFeloStreamText(raw), 'Le ciel est bleu');
});

test('felo emits only the new suffix per frame', () => {
  const frame = (text: string) => `data:${JSON.stringify({ content: JSON.stringify({ text }) })}`;
  const first = parseFeloStreamLine(frame('Le'), '');
  assert.equal(first.newText, 'Le');

  const second = parseFeloStreamLine(frame('Le ciel'), first.nextPreviousText);
  assert.equal(second.newText, ' ciel', 'only the suffix is new');
});

test('a rewritten felo answer replaces rather than appends', () => {
  const frame = (text: string) => `data:${JSON.stringify({ content: JSON.stringify({ text }) })}`;
  const rewritten = parseFeloStreamLine(frame('Autre chose'), 'Le ciel');
  assert.equal(rewritten.newText, 'Autre chose');
  assert.equal(rewritten.nextPreviousText, 'Autre chose');
});

test('non-data lines are ignored', () => {
  assert.equal(parseFeloStreamLine(': keepalive', 'abc').nextPreviousText, 'abc');
  assert.equal(parseFeloStreamLine('', 'abc').newText, null);
});

test('unknown felo model falls back to the chat category', () => {
  assert.equal(resolveFeloCategory('felo-scholar'), 'scholar');
  assert.equal(resolveFeloCategory('nope'), 'chat');
  assert.equal(resolveFeloCategory(undefined), 'chat');
});

// ── Wiring ──

test('factory builds the custom-http executors', () => {
  const factory = new ExecutorFactory();
  assert.equal(factory.getExecutor('theoldllm').constructor.name, 'TheOldLlmExecutor');
  assert.equal(factory.getExecutor('felo').constructor.name, 'FeloExecutor');
});

test('providers still lacking an executor throw, naming what is missing', () => {
  const factory = new ExecutorFactory();
  assert.throws(() => factory.getExecutor('cloudflare'), /WebSocket\/SockJS/);
  assert.throws(() => factory.getExecutor('chipotle'), /WebSocket\/SockJS/);
  assert.throws(() => factory.getExecutor('duckduckgo'), /BrowserExecutor/);
});

test('every provider the router can pick has a usable executor', async () => {
  const factory = new ExecutorFactory();
  const router = new FreeLLMRouter();

  for (const provider of router.getProviders().filter((p) => p.isActive)) {
    assert.doesNotThrow(
      () => factory.getExecutor(provider.id),
      `routable provider "${provider.id}" must not throw at executor creation`
    );
  }
});

test('each provider record key equals its id', () => {
  // Everything (routing, executors, endpoints, health) addresses providers by
  // this one string. A drift here fails silently rather than loudly.
  for (const [key, provider] of Object.entries(FREE_LLM_PROVIDERS)) {
    assert.equal(provider.id, key, `key "${key}" and id "${provider.id}" must match`);
  }
});

// ── Egress-proxy rejections must not read as provider auth failures ──

test('a blocked host is named in full, not truncated at the first dot', () => {
  const msg =
    'HTTP 403: Forbidden Host not in allowlist: opencode.ai. Add this host to your network egress settings.';
  assert.equal(extractBlockedHost(msg), 'opencode.ai');
});

test('subdomains survive extraction', () => {
  assert.equal(
    extractBlockedHost('Host not in allowlist: hermes.ai.unturf.com. Add this host'),
    'hermes.ai.unturf.com'
  );
});

test('an ordinary 403 is not mistaken for an egress block', () => {
  assert.equal(extractBlockedHost('HTTP 403: Forbidden {"error":"bad key"}'), null);
});
