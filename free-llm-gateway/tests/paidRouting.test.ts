import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * A paid provider inside a gateway built for free endpoints is a money bug
 * waiting to happen: nothing in a successful response tells you it cost
 * anything. These tests pin the one rule that keeps it safe — a paid provider
 * answers only a request that asked for it by name.
 *
 * The key has to exist before the catalog is evaluated (isActive is computed
 * at module load), so every import here is dynamic and deliberately ordered.
 */
process.env.MOONSHOT_API_KEY = 'sk-test-moonshot';

/**
 * Imported lazily rather than at the top of the file: the assignment above has
 * to land before config.ts is evaluated, and tsx compiles this to CJS, where a
 * top-level await is a hard error.
 */
async function load() {
  const config = await import('../src/providers/config');
  const { FreeLLMRouter } = await import('../src/router/router');

  const paidIds = Object.values(config.FREE_LLM_PROVIDERS)
    .filter((p) => p.billing === 'paid')
    .map((p) => p.id);

  return { ...config, FreeLLMRouter, paidIds };
}

test('the catalog actually has a paid provider to guard', async () => {
  const { FREE_LLM_PROVIDERS, paidIds } = await load();

  // Otherwise every assertion below passes vacuously.
  assert.ok(paidIds.includes('moonshot'), 'moonshot should be catalogued as paid');
  assert.equal(FREE_LLM_PROVIDERS.moonshot.isActive, true, 'the test key should activate it');
});

test('no paid provider sits in the fallback chain', async () => {
  const { PROVIDER_FALLBACK_CHAIN, paidIds } = await load();

  for (const id of paidIds) {
    assert.ok(
      !PROVIDER_FALLBACK_CHAIN.includes(id),
      `${id} bills per token; a fallback chain would reach it without anyone deciding to spend`
    );
  }
});

test('a free passthrough gets first refusal on a Kimi model', async () => {
  const { FreeLLMRouter } = await load();
  const router = new FreeLLMRouter();

  const { provider } = await router.route({
    model: 'kimi-k3',
    messages: [{ role: 'user', content: 'x' }],
  });

  // Before warmup a passthrough claims any model name, so it is tried first.
  // That costs one 404 on a model it never had, and it is the trade we want:
  // the alternative is spending money to avoid a wasted free request.
  assert.notEqual(provider.billing, 'paid');
});

test('once discovery knows what the free providers serve, Kimi reaches Moonshot', async () => {
  const { FreeLLMRouter, FREE_LLM_PROVIDERS } = await load();
  const router = new FreeLLMRouter();

  // What warmup() does in production: replace "accepts any model name" with
  // the live list. Now no free provider claims kimi-k3, and the paid one is
  // reachable — because the caller named a model only it carries.
  for (const p of Object.values(FREE_LLM_PROVIDERS)) {
    if (p.transport === 'passthrough') router.setModelIndex(p.id, ['some-other-model']);
  }

  const { provider, model } = await router.route({
    model: 'kimi-k3',
    messages: [{ role: 'user', content: 'x' }],
  });

  assert.equal(provider.id, 'moonshot');
  assert.equal(model, 'kimi-k3', 'the requested model must survive routing');
});

test('a request for an unknown model never lands on the paid provider', async () => {
  const { FreeLLMRouter } = await load();
  const router = new FreeLLMRouter();
  const { provider } = await router.route({
    model: 'some-model-nobody-lists',
    messages: [{ role: 'user', content: 'x' }],
  });

  // The last-resort branch ignores request.model, so a paid provider reached
  // here would be billed AND answering a different question than the one asked.
  assert.notEqual(provider.billing, 'paid');
});

test('pinning the paid provider explicitly still works', async () => {
  const { FreeLLMRouter } = await load();
  const router = new FreeLLMRouter();
  const { provider } = await router.route({
    provider: 'moonshot',
    model: 'kimi-k2.6',
    messages: [{ role: 'user', content: 'x' }],
  });

  assert.equal(provider.id, 'moonshot');
});

test('the free Kimi route is catalogued and costs nothing', async () => {
  const { FREE_LLM_PROVIDERS } = await load();
  const free = FREE_LLM_PROVIDERS.openrouter.models.filter((m) => m.id.startsWith('moonshotai/kimi'));

  assert.ok(free.length > 0, 'OpenRouter is the free path to Kimi and must list it');
  for (const model of free) {
    // Dropping `:free` bills the identical model at full rate, so the suffix
    // is part of the identifier, not decoration.
    assert.ok(model.id.endsWith(':free'), `${model.id} must keep its :free suffix`);
    assert.equal(model.costPerMTok, 0);
  }
});

test('retired Moonshot models are not catalogued', async () => {
  const { FREE_LLM_PROVIDERS } = await load();
  const ids = FREE_LLM_PROVIDERS.moonshot.models.map((m) => m.id);

  // kimi-k2.5 and the moonshot-v1 series sunset 2026-08-31; routing to one
  // reads as a dead provider rather than a withdrawn model.
  assert.ok(!ids.includes('kimi-k2.5'));
  assert.ok(!ids.some((id) => id.startsWith('moonshot-v1')));
});

test('every paid model carries a visible price', async () => {
  const { FREE_LLM_PROVIDERS, paidIds } = await load();

  for (const id of paidIds) {
    for (const model of FREE_LLM_PROVIDERS[id].models) {
      assert.ok(
        (model.costPerMTok ?? 0) > 0,
        `${id}/${model.id} costs money and must not report costPerMTok 0`
      );
    }
  }
});
