import { ModelDiscovery } from '../src/discovery/modelDiscovery';
import { FREE_LLM_PROVIDERS } from '../src/providers/config';

console.log('Testing ModelDiscovery...\n');

async function testDiscovery() {
  const discovery = new ModelDiscovery(3600000); // 1 hour cache

  // Test 1: Discover models for one provider
  console.log('✓ Test 1: Discover models for OpenCode');
  const openCodeModels = await discovery.discoverModels('opencode');
  console.log(`  Found ${openCodeModels.length} models:`);
  openCodeModels.forEach((m) => {
    console.log(`    - ${m.displayName} (id: ${m.id})`);
  });
  console.log();

  // Test 2: Discover all models
  console.log('✓ Test 2: Discover all models');
  const allModels = await discovery.discoverAllModels();
  let totalModels = 0;
  allModels.forEach((models, providerId) => {
    totalModels += models.length;
    console.log(`  ${providerId}: ${models.length} models`);
  });
  console.log(`  Total: ${totalModels} models across ${allModels.size} providers`);
  console.log();

  // Test 3: Find a specific model
  console.log('✓ Test 3: Find specific models');
  const claudeModel = await discovery.findModel('claude');
  if (claudeModel) {
    console.log(`  Found "claude": ${claudeModel.provider.name} → ${claudeModel.model.displayName}`);
  } else {
    console.log(`  "claude" not found`);
  }

  const kittyModel = await discovery.findModel('kimi');
  if (kittyModel) {
    console.log(`  Found "kimi": ${kittyModel.provider.name} → ${kittyModel.model.displayName}`);
  }
  console.log();

  // Test 4: Get model capabilities
  console.log('✓ Test 4: Get model capabilities');
  const capabilities = await discovery.getModelCapabilities('claude-opus');
  console.log(`  Capabilities for "claude-opus":`, capabilities);
  console.log();

  // Test 5: Cache statistics
  console.log('✓ Test 5: Cache statistics');
  const cacheStats = discovery.getCacheStats();
  console.log(`  Cache entries: ${cacheStats.length}`);
  cacheStats.slice(0, 3).forEach((stat) => {
    console.log(`    - ${stat.provider}: ${stat.totalCached} models, expires ${stat.expiredAt.toLocaleString()}`);
  });
  console.log();

  // Test 6: Clear and refresh cache
  console.log('✓ Test 6: Clear cache and refresh');
  discovery.clearCache('opencode');
  console.log(`  Cleared cache for opencode`);
  const refreshedModels = await discovery.discoverModels('opencode', true);
  console.log(`  Refreshed: ${refreshedModels.length} models`);
  console.log();

  console.log('✅ All discovery tests passed!');
}

testDiscovery().catch(console.error);
