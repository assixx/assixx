/**
 * Alerting Service Stub
 * Temporary implementation without axios dependency
 */

import { execute } from "../utils/db";
import { logger } from "../utils/logger";

interface SlackAlert {
  channel: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  fields?: Record<string, string | number | boolean>;
}

interface TeamsAlert {
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  facts?: Array<{ name: string; value: string }>;
  actions?: Array<{
    type: string;
    name: string;
    target: string;
  }>;
}

interface PagerDutyIncident {
  summary: string;
  severity: "critical" | "error" | "warning" | "info";
  details: Record<string, unknown>;
  component?: string;
  group?: string;
}

export class AlertingService {
  /**
   * Send alert to Slack (stub)
   */
  async sendSlackAlert(alert: SlackAlert): Promise<void> {
    logger.info(`[STUB] Slack alert: ${alert.title} - ${alert.message}`);
    await this.logAlert(
      "slack",
      alert.severity,
      alert.channel,
      alert.title,
      alert.message,
      200,
    );
  }

  /**
   * Send alert to Microsoft Teams (stub)
   */
  async sendTeamsAlert(alert: TeamsAlert): Promise<void> {
    logger.info(`[STUB] Teams alert: ${alert.title} - ${alert.message}`);
    await this.logAlert(
      "teams",
      alert.severity,
      "teams",
      alert.title,
      alert.message,
      200,
    );
  }

  /**
   * Create PagerDuty incident (stub)
   */
  async sendPagerDutyAlert(incident: PagerDutyIncident): Promise<void> {
    logger.info(`[STUB] PagerDuty incident: ${incident.summary}`);
    await this.logAlert(
      "pagerduty",
      incident.severity,
      "incident",
      incident.summary,
      JSON.stringify(incident.details),
      200,
    );
  }

  /**
   * Send alert to all configured channels based on severity
   */
  async sendCriticalAlert(
    title: string,
    message: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    logger.error(`[STUB] Critical Alert: ${title} - ${message}`, details);

    await Promise.all([
      this.sendSlackAlert({
        channel: "#alerts-critical",
        severity: "critical",
        title,
        message,
        fields: Object.entries(details).reduce(
          (acc, [key, value]) => {
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        ),
      }),
      this.sendTeamsAlert({
        severity: "critical",
        title,
        message,
        facts: Object.entries(details).map(([name, value]) => ({
          name,
          value: String(value),
        })),
      }),
      this.sendPagerDutyAlert({
        summary: title,
        severity: "critical",
        details: {
          message,
          ...details,
        },
      }),
    ]);
  }

  /**
   * Log alert to database for audit trail
   */
  private async logAlert(
    alertType: string,
    severity: string,
    channel: string,
    title: string,
    message: string,
    responseCode: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      await execute(
        `INSERT INTO deletion_alerts 
         (queue_id, alert_type, severity, channel, title, message, sent_at, response_code, response_body) 
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, ?)`,
        [
          0, // Queue ID 0 for general alerts
          alertType,
          severity,
          channel,
          title,
          message,
          responseCode,
          errorMessage ?? null,
        ],
      );
    } catch (error) {
      logger.error("Failed to log alert to database:", error);
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
export default alertingService;
