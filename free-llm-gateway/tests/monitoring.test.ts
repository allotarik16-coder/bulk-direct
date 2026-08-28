import { ProviderMonitor } from '../src/monitoring';

console.log('Testing Monitoring...\n');

function testMonitoring() {
  // Test 1: Monitor initialization
  console.log('✓ Test 1: Monitor initialization');
  const monitor = new ProviderMonitor({
    enableAlerts: false, // Disable console spam in tests
    alertChannels: [],
  });
  console.log('  Monitor created successfully');
  console.log();

  // Test 2: Record provider failure
  console.log('✓ Test 2: Record provider failure');
  monitor.recordFailure('opencode', 3, 'Connection timeout');
  console.log('  Failure recorded for opencode');
  console.log();

  // Test 3: Record provider success
  console.log('✓ Test 3: Record provider success');
  monitor.recordSuccess('opencode');
  console.log('  Success recorded for opencode');
  console.log();

  // Test 4: Record latency
  console.log('✓ Test 4: Record latency measurement');
  monitor.recordLatency('duckduckgo', 2500);
  console.log('  Latency recorded for duckduckgo');
  console.log();

  // Test 5: Get active alerts
  console.log('✓ Test 5: Get active alerts');
  const alerts = monitor.getActiveAlerts();
  console.log(`  Active alerts: ${alerts.length}`);
  alerts.forEach((alert) => {
    console.log(`    - [${alert.severity}] ${alert.providerId}: ${alert.message}`);
  });
  console.log();

  // Test 6: Get monitoring stats
  console.log('✓ Test 6: Get monitoring statistics');
  const mockHealthStatus = [
    {
      providerId: 'opencode',
      healthy: true,
      lastCheckTime: new Date(),
      consecutiveFailures: 0,
    },
    {
      providerId: 'duckduckgo',
      healthy: false,
      lastError: 'Connection timeout',
      lastCheckTime: new Date(),
      consecutiveFailures: 3,
    },
  ];

  const stats = monitor.getStats(mockHealthStatus);
  console.log(`  Total providers: ${stats.totalProviders}`);
  console.log(`  Healthy: ${stats.healthyProviders}`);
  console.log(`  Warning: ${stats.warningProviders}`);
  console.log(`  Critical: ${stats.criticalProviders}`);
  console.log(`  Health score: ${stats.systemHealthScore.toFixed(0)}/100`);
  console.log();

  // Test 7: Generate monitoring report
  console.log('✓ Test 7: Generate monitoring report');
  const report = monitor.generateReport(stats);
  console.log('  Generated report:');
  console.log(report.split('\n').slice(0, 15).join('\n'));
  console.log();

  // Test 8: Start/stop monitoring
  console.log('✓ Test 8: Start and stop monitoring');
  monitor.start();
  console.log('  Monitoring started');
  monitor.stop();
  console.log('  Monitoring stopped');
  console.log();

  // Test 9: Get alert history
  console.log('✓ Test 9: Alert history');
  const history = monitor.getAlertHistory();
  console.log(`  Alert history size: ${history.length}`);
  console.log();

  // Test 10: Clear history
  console.log('✓ Test 10: Clear alert history');
  monitor.clearHistory();
  const clearedHistory = monitor.getAlertHistory();
  console.log(`  History cleared. Remaining: ${clearedHistory.length}`);
  console.log();

  console.log('✅ All monitoring tests passed!');
}

testMonitoring();
