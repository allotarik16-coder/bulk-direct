import assert from 'node:assert/strict';
import test from 'node:test';
import { FreeLLMRouter } from '../src/router/router';

/**
 * Regression guard: a passthrough provider accepts any model name, so requests
 * for models it does not carry come back 404. Before the model-lockout split,
 * each of those incremented the provider's consecutiveFailures, and three
 * different missing models were enough to mark a healthy provider dead.
 */
test('missing models do not mark a healthy provider unhealthy', () => {
  const router = new FreeLLMRouter();

  for (const model of ['claude-opus', 'gpt-5.4', 'gemini-3', 'llama-9']) {
    router.recordFailure('uncloseai', 'Model not found', model);
  }

  const health = router.getHealthStatus().find((h) => h.providerId === 'uncloseai');
  assert.equal(health?.healthy, true, 'provider should still be healthy');
  assert.equal(health?.consecutiveFailures, 0, 'missing models must not count as provider failures');
});

test('a real provider fault still degrades health', () => {
  const router = new FreeLLMRouter();

  for (let i = 0; i < 4; i++) {
    router.recordFailure('uncloseai', 'Request timeout', 'hermes-llama-3.1');
  }

  const health = router.getHealthStatus().find((h) => h.providerId === 'uncloseai');
  assert.equal(health?.healthy, false, 'repeated timeouts should open the breaker');
});

test('a 404 model is not routed to the same provider again', async () => {
  const router = new FreeLLMRouter();

  const first = await router.route({ model: 'claude-opus', messages: [] });
  assert.equal(first.provider.id, 'uncloseai');

  router.recordFailure('uncloseai', 'Model not found', 'claude-opus');

  const second = await router.route({ model: 'claude-opus', messages: [] });
  assert.notEqual(second.provider.id, 'uncloseai', 'locked model must fall through');
});

test('lockout is scoped to one model, not the whole provider', async () => {
  const router = new FreeLLMRouter();
  router.recordFailure('uncloseai', 'Model not found', 'claude-opus');

  assert.equal(router.isModelLocked('uncloseai', 'claude-opus'), true);
  assert.equal(router.isModelLocked('uncloseai', 'hermes-llama-3.1'), false);
});

test('a live model index keeps passthrough from swallowing unknown models', async () => {
  const router = new FreeLLMRouter();

  // Before warmup: permissive, passthrough takes anything.
  const before = await router.route({ model: 'some-exotic-model', messages: [] });
  assert.equal(before.provider.transport, 'passthrough');

  // After warmup with a real catalog, an absent model no longer matches.
  router.setModelIndex('uncloseai', ['hermes-llama-3.1']);
  router.setModelIndex('aihorde', ['koboldcpp/Mistral-7B']);

  assert.equal(router.isModelLocked('uncloseai', 'some-exotic-model'), false);
  const after = await router.route({ model: 'hermes-llama-3.1', messages: [] });
  assert.equal(after.model, 'hermes-llama-3.1');
});
