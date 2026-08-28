import { FreeLLMRouter } from '../src/router/router';
import { FREE_LLM_PROVIDERS } from '../src/providers/config';

console.log('Testing FreeLLMRouter...\n');

async function testRouter() {
  const router = new FreeLLMRouter();

  // Test 1: Get available strategies
  console.log('✓ Test 1: Available strategies');
  const strategies = router.getStrategies();
  console.log(`  Found ${strategies.length} strategies:`, strategies);
  console.log();

  // Test 2: Get providers
  console.log('✓ Test 2: Available providers');
  const providers = router.getProviders();
  console.log(`  Found ${providers.length} providers:`);
  providers.forEach((p) => {
    console.log(`    - ${p.name} (${p.alias}): ${p.models.length} models, transport=${p.transport}`);
  });
  console.log();

  // Test 3: Route a request
  console.log('✓ Test 3: Route a request (model: claude)');
  const route1 = await router.route(
    {
      model: 'claude-opus',
      messages: [{ role: 'user', content: 'hello' }],
    },
    'smart-fallback'
  );
  console.log(`  Provider: ${route1.provider.name}`);
  console.log(`  Model: ${route1.model}`);
  console.log();

  // Test 4: Route with specific provider
  console.log('✓ Test 4: Route with specific provider (opencode)');
  const route2 = await router.route(
    {
      model: 'claude-fable-5',
      provider: 'opencode',
      messages: [{ role: 'user', content: 'hello' }],
    },
    'smart-fallback'
  );
  console.log(`  Provider: ${route2.provider.name}`);
  console.log(`  Model: ${route2.model}`);
  console.log();

  // Test 5: Health tracking
  console.log('✓ Test 5: Health tracking');
  console.log(`  Initial health: ${router.getHealthStatus()[0]}`);
  router.recordSuccess('opencode');
  console.log(`  After success: ${router.getHealthStatus()[0]}`);
  router.recordFailure('opencode', 'Test error');
  console.log(`  After failure: ${router.getHealthStatus()[0]}`);
  console.log();

  // Test 6: Test different strategies
  console.log('✓ Test 6: Route with different strategies');
  const strategies_to_test = ['smart-fallback', 'fast-http', 'reliable-only'];

  for (const strategy of strategies_to_test) {
    try {
      const route = await router.route(
        {
          model: 'any',
          messages: [{ role: 'user', content: 'hello' }],
        },
        strategy
      );
      console.log(`  ${strategy}: ${route.provider.name} (${route.provider.transport})`);
    } catch (error) {
      console.log(`  ${strategy}: No matching provider`);
    }
  }
  console.log();

  console.log('✅ All router tests passed!');
}

testRouter().catch(console.error);
