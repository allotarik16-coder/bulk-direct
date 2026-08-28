import { HealthStatus, FreeLLMProvider } from '../types';
import { FREE_LLM_PROVIDERS } from '../providers/config';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  providerId: string;
  message: string;
  timestamp: Date;
  resolved?: boolean;
  resolvedAt?: Date;
}

export interface MonitoringConfig {
  healthCheckIntervalMs: number;
  alertThresholds: {
    consecutiveFailuresWarning: number;
    consecutiveFailuresCritical: number;
    latencyWarningMs: number;
    latencyCriticalMs: number;
  };
  enableAlerts: boolean;
  alertChannels: AlertChannel[];
}

export type AlertChannel = 'console' | 'log' | 'webhook' | 'email';

export interface MonitoringStats {
  timestamp: Date;
  totalProviders: number;
  healthyProviders: number;
  warningProviders: number;
  criticalProviders: number;
  activeAlerts: Alert[];
  avgSystemLatencyMs: number;
  systemHealthScore: number;
}

export class ProviderMonitor {
  private config: MonitoringConfig;
  private alerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private lastHealthCheck: Map<string, Date> = new Map();
  private healthCheckTimer?: ReturnType<typeof setInterval>;

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      healthCheckIntervalMs: 60000, // 1 minute
      alertThresholds: {
        consecutiveFailuresWarning: 2,
        consecutiveFailuresCritical: 5,
        latencyWarningMs: 5000,
        latencyCriticalMs: 15000,
      },
      enableAlerts: true,
      alertChannels: ['console'],
      ...config,
    };

    this.initializeAlerts();
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.healthCheckTimer) return;

    console.log('🔍 Starting provider monitoring...');

    this.healthCheckTimer = setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckIntervalMs
    );

    // Initial health check
    this.performHealthCheck();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      console.log('⏸️  Provider monitoring stopped');
    }
  }

  /**
   * Perform health check for all providers
   */
  private async performHealthCheck() {
    const providers = Object.values(FREE_LLM_PROVIDERS);

    for (const provider of providers) {
      this.lastHealthCheck.set(provider.id, new Date());
      // Health check logic would go here
      // For now, this is a placeholder
    }
  }

  /**
   * Record provider failure
   */
  recordFailure(providerId: string, consecutiveFailures: number, error: string) {
    this.checkThresholds(providerId, consecutiveFailures, error);
  }

  /**
   * Record provider success
   */
  recordSuccess(providerId: string) {
    const alertKey = `${providerId}:consecutive-failures`;
    if (this.alerts.has(alertKey)) {
      this.resolveAlert(alertKey);
    }
  }

  /**
   * Record latency measurement
   */
  recordLatency(providerId: string, latencyMs: number) {
    const config = this.config.alertThresholds;

    if (latencyMs > config.latencyCriticalMs) {
      this.createAlert(
        providerId,
        'critical',
        `Latency critically high: ${latencyMs}ms (threshold: ${config.latencyCriticalMs}ms)`
      );
    } else if (latencyMs > config.latencyWarningMs) {
      this.createAlert(
        providerId,
        'warning',
        `Latency warning: ${latencyMs}ms (threshold: ${config.latencyWarningMs}ms)`
      );
    }
  }

  /**
   * Check if thresholds are exceeded
   */
  private checkThresholds(providerId: string, consecutiveFailures: number, error: string) {
    const config = this.config.alertThresholds;

    if (consecutiveFailures >= config.consecutiveFailuresCritical) {
      this.createAlert(providerId, 'critical', `${consecutiveFailures} consecutive failures: ${error}`);
    } else if (consecutiveFailures >= config.consecutiveFailuresWarning) {
      this.createAlert(providerId, 'warning', `${consecutiveFailures} consecutive failures: ${error}`);
    }
  }

  /**
   * Create an alert
   */
  private createAlert(providerId: string, severity: AlertSeverity, message: string) {
    const alertKey = `${providerId}:${message.split(':')[0]}`;

    if (this.alerts.has(alertKey)) {
      // Alert already exists, don't create duplicate
      return;
    }

    const alert: Alert = {
      id: `${providerId}-${Date.now()}`,
      severity,
      providerId,
      message,
      timestamp: new Date(),
    };

    this.alerts.set(alertKey, alert);
    this.alertHistory.push(alert);

    if (this.config.enableAlerts) {
      this.sendAlert(alert);
    }
  }

  /**
   * Resolve an alert
   */
  private resolveAlert(alertKey: string) {
    const alert = this.alerts.get(alertKey);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.alerts.delete(alertKey);
    }
  }

  /**
   * Send alert through configured channels
   */
  private sendAlert(alert: Alert) {
    for (const channel of this.config.alertChannels) {
      switch (channel) {
        case 'console':
          this.logToConsole(alert);
          break;
        case 'log':
          this.logToFile(alert);
          break;
        case 'webhook':
          this.sendToWebhook(alert);
          break;
        case 'email':
          this.sendEmail(alert);
          break;
      }
    }
  }

  /**
   * Log alert to console
   */
  private logToConsole(alert: Alert) {
    const emoji = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    console.log(
      `${emoji} [${alert.severity.toUpperCase()}] ${alert.providerId}: ${alert.message}`
    );
  }

  /**
   * Log alert to file (placeholder)
   */
  private logToFile(alert: Alert) {
    // TODO: Implement file logging
    console.log(`📝 Would log to file: ${alert.message}`);
  }

  /**
   * Send to webhook (placeholder)
   */
  private sendToWebhook(alert: Alert) {
    // TODO: Implement webhook integration
    console.log(`🔗 Would send to webhook: ${alert.message}`);
  }

  /**
   * Send email (placeholder)
   */
  private sendEmail(alert: Alert) {
    // TODO: Implement email integration
    console.log(`📧 Would send email: ${alert.message}`);
  }

  /**
   * Initialize alerts for all providers
   */
  private initializeAlerts() {
    const providers = Object.values(FREE_LLM_PROVIDERS);
    for (const provider of providers) {
      this.lastHealthCheck.set(provider.id, new Date());
    }
  }

  /**
   * Get current monitoring stats
   */
  getStats(healthStatuses: HealthStatus[]): MonitoringStats {
    const healthy = healthStatuses.filter((h) => h.healthy).length;
    const warning = healthStatuses.filter(
      (h) => !h.healthy && h.consecutiveFailures < this.config.alertThresholds.consecutiveFailuresCritical
    ).length;
    const critical = healthStatuses.filter(
      (h) => h.consecutiveFailures >= this.config.alertThresholds.consecutiveFailuresCritical
    ).length;

    const activeAlerts = Array.from(this.alerts.values());
    const avgLatency = this.calculateAverageLatency();
    const healthScore = this.calculateHealthScore(healthy, warning, critical, healthStatuses.length);

    return {
      timestamp: new Date(),
      totalProviders: healthStatuses.length,
      healthyProviders: healthy,
      warningProviders: warning,
      criticalProviders: critical,
      activeAlerts,
      avgSystemLatencyMs: avgLatency,
      systemHealthScore: healthScore,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(): Alert[] {
    return [...this.alertHistory];
  }

  /**
   * Calculate average latency (placeholder)
   */
  private calculateAverageLatency(): number {
    // Would be calculated from actual latency measurements
    return 0;
  }

  /**
   * Calculate system health score (0-100)
   */
  private calculateHealthScore(healthy: number, warning: number, critical: number, total: number): number {
    if (total === 0) return 100;

    const healthScore = (healthy / total) * 100;
    const warningPenalty = (warning / total) * 20;
    const criticalPenalty = (critical / total) * 50;

    return Math.max(0, Math.min(100, healthScore - warningPenalty - criticalPenalty));
  }

  /**
   * Generate monitoring report
   */
  generateReport(stats: MonitoringStats): string {
    let report = '📊 Provider Monitoring Report\n';
    report += '=============================\n\n';

    report += `Timestamp: ${stats.timestamp.toLocaleString()}\n`;
    report += `System Health Score: ${stats.systemHealthScore.toFixed(0)}/100\n\n`;

    report += `Provider Status:\n`;
    report += `  ✅ Healthy: ${stats.healthyProviders}\n`;
    report += `  ⚠️  Warning: ${stats.warningProviders}\n`;
    report += `  🚨 Critical: ${stats.criticalProviders}\n`;
    report += `  Total: ${stats.totalProviders}\n\n`;

    report += `Performance:\n`;
    report += `  Average Latency: ${stats.avgSystemLatencyMs.toFixed(0)}ms\n\n`;

    if (stats.activeAlerts.length > 0) {
      report += `🚨 Active Alerts (${stats.activeAlerts.length}):\n`;
      for (const alert of stats.activeAlerts) {
        report += `  [${alert.severity.toUpperCase()}] ${alert.providerId}: ${alert.message}\n`;
      }
    } else {
      report += `✅ No active alerts\n`;
    }

    return report;
  }

  /**
   * Clear alert history
   */
  clearHistory() {
    this.alertHistory = [];
  }
}
