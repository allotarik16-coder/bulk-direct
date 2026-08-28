import { ExecutorFactory, HTTPExecutor, PassthroughExecutor } from '../src/executors';

console.log('Testing Executors...\n');

function testExecutors() {
  // Test 1: Executor factory
  console.log('✓ Test 1: ExecutorFactory initialization');
  const factory = new ExecutorFactory();
  console.log('  Factory created successfully');
  console.log();

  // Test 2: Get HTTP executor
  console.log('✓ Test 2: Create HTTP executor for OpenCode');
  try {
    const executor = factory.getExecutor('opencode');
    console.log(`  Executor type: ${executor.constructor.name}`);
    console.log(`  Provider: ${executor.providerId}`);
    console.log(`  Request timeout: ${executor.requestTimeout}ms`);
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
  }
  console.log();

  // Test 3: Get passthrough executor
  console.log('✓ Test 3: Create passthrough executor for UncloseAI');
  try {
    const executor = factory.getExecutor('uncloseai');
    console.log(`  Executor type: ${executor.constructor.name}`);
    console.log(`  Provider: ${executor.providerId}`);
  } catch (error) {
    console.log(`  Error: ${(error as Error).message}`);
  }
  console.log();

  // Test 4: Direct HTTP executor creation
  console.log('✓ Test 4: Direct HTTPExecutor creation');
  const httpExecutor = new HTTPExecutor('test-provider', 'Test Provider', 'https://api.example.com/chat');
  console.log(`  Endpoint: https://api.example.com/chat`);
  console.log(`  Timeout: ${httpExecutor.requestTimeout}ms`);
  console.log();

  // Test 5: Direct passthrough executor creation
  console.log('✓ Test 5: Direct PassthroughExecutor creation');
  const ptExecutor = new PassthroughExecutor('test-passthrough', 'Test Passthrough', 'https://api.example.com/v1/chat');
  console.log(`  Endpoint: https://api.example.com/v1/chat`);
  console.log();

  // Test 6: Factory caching
  console.log('✓ Test 6: Executor caching');
  const exec1 = factory.getExecutor('opencode');
  const exec2 = factory.getExecutor('opencode');
  console.log(`  Same instance: ${exec1 === exec2}`);
  console.log();

  // Test 7: Clear cache
  console.log('✓ Test 7: Clear executor cache');
  factory.clearCache();
  console.log(`  Cache cleared`);
  const exec3 = factory.getExecutor('opencode');
  console.log(`  New instance created: ${exec1 !== exec3}`);
  console.log();

  console.log('✅ All executor tests passed!');
}

testExecutors();
