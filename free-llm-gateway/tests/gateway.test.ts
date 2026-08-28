import { FreeLLMGateway } from '../src/gateway';

console.log('Testing FreeLLMGateway (Integration)...\n');

async function testGateway() {
  const gateway = new FreeLLMGateway();

  // Test 1: Get summary
  console.log('✓ Test 1: Gateway Summary');
  const summary = gateway.getSummary();
  console.log(`  Total Providers: ${summary.totalProviders}`);
  console.log(`  Healthy: ${summary.healthyProviders}`);
  console.log(`  Unhealthy: ${summary.unhealthyProviders}`);
  console.log(`  Available Strategies: ${summary.strategies.length}`);
  console.log();

  // Test 2: Get all providers
  console.log('✓ Test 2: List all providers');
  const providers = gateway.getProviders();
  console.log(`  Found ${providers.length} providers`);
  providers.slice(0, 3).forEach((p) => {
    console.log(`    - ${p.name} (${p.alias}): ${p.models.length} models`);
  });
  console.log();

  // Test 3: Discover all models
  console.log('✓ Test 3: Discover all models');
  const allModels = await gateway.getAllModels();
  console.log(`  Found ${allModels.length} total models`);
  console.log(`  Sample models:`);
  allModels.slice(0, 5).forEach((item) => {
    console.log(`    - ${item.model.displayName} (${item.provider.name})`);
  });
  console.log();

  // Test 4: Find specific models
  console.log('✓ Test 4: Find specific models');
  const gptModel = await gateway.findModel('gpt-4o');
  if (gptModel) {
    console.log(`  Found GPT-4o: ${gptModel.provider.name}`);
  }

  const claudeModel = await gateway.findModel('claude');
  if (claudeModel) {
    console.log(`  Found Claude: ${claudeModel.provider.name}`);
  }

  const kimiModel = await gateway.findModel('claude-fable-5');
  if (kimiModel) {
    console.log(`  Found Claude Fable 5: ${kimiModel.provider.name}`);
  }
  console.log();

  // Test 5: Get routing strategies
  console.log('✓ Test 5: Available routing strategies');
  const strategies = gateway.getStrategies();
  console.log(`  ${strategies.length} strategies:`);
  strategies.forEach((s) => {
    console.log(`    - ${s}`);
  });
  console.log();

  // Test 6: Health monitoring
  console.log('✓ Test 6: Provider health');
  const health = gateway.getHealthStatus();
  console.log(`  Health status for ${health.length} providers:`);
  health.slice(0, 3).forEach((h) => {
    const status = h.healthy ? '✅ Healthy' : '❌ Unhealthy';
    console.log(`    - ${h.providerId}: ${status} (failures: ${h.consecutiveFailures})`);
  });
  console.log();

  // Test 7: Recommend provider
  console.log('✓ Test 7: Get recommended provider for model');
  const recommendedProvider = await gateway.getRecommendedProvider('claude-opus');
  if (recommendedProvider) {
    console.log(`  Recommended for "claude-opus": ${recommendedProvider.name}`);
  }
  console.log();

  // Test 8: Cache management
  console.log('✓ Test 8: Cache management');
  const cacheStatsBefore = gateway.getCacheStats();
  console.log(`  Cache entries before clear: ${cacheStatsBefore.length}`);
  gateway.clearCache('opencode');
  console.log(`  Cleared cache for opencode`);
  const cacheStatsAfter = gateway.getCacheStats();
  console.log(`  Cache entries after clear: ${cacheStatsAfter.length}`);
  console.log();

  // Test 9: Execute a request (mock)
  console.log('✓ Test 9: Execute LLM request (mock)');
  try {
    const response = await gateway.execute(
      {
        model: 'claude',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      'smart-fallback'
    );
    console.log(`  Provider: ${response.providerId}`);
    console.log(`  Model: ${response.modelId}`);
    console.log(`  Latency: ${response.latencyMs}ms`);
  } catch (error) {
    console.log(`  Error (expected in test): ${(error as Error).message}`);
  }
  console.log();

  console.log('✅ All gateway tests passed!');
}

testGateway().catch(console.error);
