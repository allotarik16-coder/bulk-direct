import { ExecutorFactory } from '../executors';
import { FreeLLMProvider } from '../types';
import { FREE_LLM_PROVIDERS } from '../providers/config';

export interface BenchmarkResult {
  providerId: string;
  providerName: string;
  model: string;
  latencyMs: number;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface BenchmarkStats {
  providerId: string;
  providerName: string;
  totalTests: number;
  successRate: number;
  avgLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  results: BenchmarkResult[];
}

export class ProviderBenchmark {
  private executorFactory: ExecutorFactory;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.executorFactory = new ExecutorFactory();
  }

  /**
   * Run latency benchmark for all providers
   */
  async benchmarkAll(iterations: number = 3): Promise<BenchmarkStats[]> {
    const providers = Object.values(FREE_LLM_PROVIDERS);
    const stats: BenchmarkStats[] = [];

    for (const provider of providers) {
      const providerStats = await this.benchmarkProvider(provider, iterations);
      stats.push(providerStats);
    }

    return stats.sort((a, b) => a.avgLatencyMs - b.avgLatencyMs);
  }

  /**
   * Benchmark a specific provider
   */
  async benchmarkProvider(provider: FreeLLMProvider, iterations: number = 3): Promise<BenchmarkStats> {
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const model = provider.models[0];
      if (!model) continue;

      try {
        const executor = this.executorFactory.getExecutor(provider.id);
        const startTime = Date.now();

        const result = await executor.execute({
          model: model.id,
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
        });

        results.push({
          providerId: provider.id,
          providerName: provider.name,
          model: model.id,
          latencyMs: Date.now() - startTime,
          success: true,
          timestamp: new Date(),
        });
      } catch (error) {
        results.push({
          providerId: provider.id,
          providerName: provider.name,
          model: provider.models[0]?.id || 'unknown',
          latencyMs: 0,
          success: false,
          error: (error as Error).message,
          timestamp: new Date(),
        });
      }

      // Delay between requests to avoid rate limiting
      if (i < iterations - 1) {
        await this.delay(1000);
      }
    }

    this.results.push(...results);
    return this.calculateStats(provider, results);
  }

  /**
   * Benchmark health check latency
   */
  async benchmarkHealthChecks(): Promise<Map<string, number>> {
    const latencies = new Map<string, number>();
    const providers = Object.values(FREE_LLM_PROVIDERS);

    for (const provider of providers) {
      try {
        const executor = this.executorFactory.getExecutor(provider.id);
        const latency = await executor.estimateLatency();
        latencies.set(provider.id, latency);
      } catch (error) {
        latencies.set(provider.id, 30000); // Timeout default
      }
    }

    return latencies;
  }

  /**
   * Calculate statistics from results
   */
  private calculateStats(provider: FreeLLMProvider, results: BenchmarkResult[]): BenchmarkStats {
    const successResults = results.filter((r) => r.success);
    const latencies = successResults.map((r) => r.latencyMs).sort((a, b) => a - b);

    return {
      providerId: provider.id,
      providerName: provider.name,
      totalTests: results.length,
      successRate: latencies.length === 0 ? 0 : (latencies.length / results.length) * 100,
      avgLatencyMs: latencies.length === 0 ? Infinity : latencies.reduce((a, b) => a + b, 0) / latencies.length,
      minLatencyMs: latencies.length === 0 ? Infinity : latencies[0],
      maxLatencyMs: latencies.length === 0 ? Infinity : latencies[latencies.length - 1],
      p50LatencyMs: this.percentile(latencies, 50),
      p95LatencyMs: this.percentile(latencies, 95),
      p99LatencyMs: this.percentile(latencies, 99),
      results,
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return Infinity;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  /**
   * Get benchmark report as formatted string
   */
  generateReport(stats: BenchmarkStats[]): string {
    let report = '🏃 Provider Performance Benchmark Report\n';
    report += '=========================================\n\n';

    // Summary table
    report += '| Provider | Avg Latency | Min | Max | P95 | Success |\n';
    report += '|----------|-------------|-----|-----|-----|----------|\n';

    for (const stat of stats) {
      const avgMs = stat.avgLatencyMs === Infinity ? 'N/A' : `${stat.avgLatencyMs.toFixed(0)}ms`;
      const minMs = stat.minLatencyMs === Infinity ? 'N/A' : `${stat.minLatencyMs.toFixed(0)}ms`;
      const maxMs = stat.maxLatencyMs === Infinity ? 'N/A' : `${stat.maxLatencyMs.toFixed(0)}ms`;
      const p95Ms = stat.p95LatencyMs === Infinity ? 'N/A' : `${stat.p95LatencyMs.toFixed(0)}ms`;
      const success = `${stat.successRate.toFixed(0)}%`;

      report += `| ${stat.providerName.padEnd(8)} | ${avgMs.padEnd(11)} | ${minMs.padEnd(5)} | ${maxMs.padEnd(5)} | ${p95Ms.padEnd(5)} | ${success.padEnd(8)} |\n`;
    }

    report += '\n📊 Detailed Breakdown:\n\n';

    for (const stat of stats) {
      report += `### ${stat.providerName}\n`;
      report += `- Success Rate: ${stat.successRate.toFixed(0)}%\n`;
      report += `- Average Latency: ${stat.avgLatencyMs === Infinity ? 'N/A' : `${stat.avgLatencyMs.toFixed(0)}ms`}\n`;
      report += `- Min/Max: ${stat.minLatencyMs === Infinity ? 'N/A' : `${stat.minLatencyMs.toFixed(0)}-${stat.maxLatencyMs.toFixed(0)}ms`}\n`;
      report += `- P95: ${stat.p95LatencyMs === Infinity ? 'N/A' : `${stat.p95LatencyMs.toFixed(0)}ms`}\n`;
      report += `- Tests: ${stat.totalTests}\n\n`;
    }

    return report;
  }

  /**
   * Export results as JSON
   */
  exportResults(): BenchmarkResult[] {
    return [...this.results];
  }

  /**
   * Clear results
   */
  clearResults() {
    this.results = [];
  }

  /**
   * Utility: delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
