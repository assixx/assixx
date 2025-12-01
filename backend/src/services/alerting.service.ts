/**
 * Alerting Service
 * Handles notifications to Slack, Teams, PagerDuty and other external services
 */
import axios from 'axios';

import { execute } from '../utils/db.js';
import { logger } from '../utils/logger.js';

interface SlackAlert {
  channel: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  fields?: Record<string, string | number | boolean>;
}

interface TeamsAlert {
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  facts?: { name: string; value: string }[];
  actions?: {
    type: string;
    name: string;
    target: string;
  }[];
}

interface PagerDutyIncident {
  summary: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  details: Record<string, unknown>;
  component?: string;
  group?: string;
}

interface PagerDutyResponse {
  incident: {
    id: string;
  };
}

/**
 *
 */
export class AlertingService {
  /**
   * Send alert to Slack
   * @param alert - The alert parameter
   */
  async sendSlackAlert(alert: SlackAlert): Promise<void> {
    if (process.env['SLACK_WEBHOOK_URL'] == null || process.env['SLACK_WEBHOOK_URL'] === '') {
      logger.warn('Slack webhook URL not configured, skipping alert');
      return;
    }

    const color = {
      info: '#36a64f',
      warning: '#ff9800',
      critical: '#f44336',
    }[alert.severity];

    try {
      const response = await axios.post(process.env['SLACK_WEBHOOK_URL'], {
        channel: alert.channel,
        attachments: [
          {
            color,
            title: alert.title,
            text: alert.message,
            fields: Object.entries(alert.fields ?? {}).map(([k, v]: [string, unknown]) => ({
              title: k,
              value: String(v),
              short: true,
            })),
            footer: 'Assixx Alert System',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      });

      logger.info(`Slack alert sent successfully: ${alert.title}`);

      // Log alert to database
      await this.logAlert(
        'slack',
        alert.severity,
        alert.channel,
        alert.title,
        alert.message,
        response.status,
      );
    } catch (error: unknown) {
      logger.error('Failed to send Slack alert:', error);
      await this.logAlert(
        'slack',
        alert.severity,
        alert.channel,
        alert.title,
        alert.message,
        0,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /**
   * Send alert to Microsoft Teams
   * @param alert - The alert parameter
   */
  async sendTeamsAlert(alert: TeamsAlert): Promise<void> {
    if (process.env['TEAMS_WEBHOOK_URL'] == null || process.env['TEAMS_WEBHOOK_URL'] === '') {
      logger.warn('Teams webhook URL not configured, skipping alert');
      return;
    }

    const themeColor = {
      info: '36a64f',
      warning: 'ff9800',
      critical: 'f44336',
    }[alert.severity];

    try {
      const card = {
        '@type': 'MessageCard',
        '@context': 'https://schema.org/extensions',
        themeColor,
        summary: alert.title,
        sections: [
          {
            activityTitle: alert.title,
            activitySubtitle: 'Assixx Alert System',
            activityImage: 'https://assixx.com/logo.png',
            text: alert.message,
            facts: alert.facts ?? [],
            markdown: true,
          },
        ],
        potentialAction: alert.actions ?? [],
      };

      const response = await axios.post(process.env['TEAMS_WEBHOOK_URL'], card);

      logger.info(`Teams alert sent successfully: ${alert.title}`);

      // Log alert to database
      await this.logAlert(
        'teams',
        alert.severity,
        'teams',
        alert.title,
        alert.message,
        response.status,
      );
    } catch (error: unknown) {
      logger.error('Failed to send Teams alert:', error);
      await this.logAlert(
        'teams',
        alert.severity,
        'teams',
        alert.title,
        alert.message,
        0,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  /** Build PagerDuty incident payload */
  private buildPagerDutyPayload(incident: PagerDutyIncident): object {
    return {
      incident: {
        type: 'incident',
        title: incident.summary,
        service: { id: process.env['PAGERDUTY_SERVICE_ID'], type: 'service_reference' },
        urgency: incident.severity === 'critical' ? 'high' : 'low',
        body: { type: 'incident_body', details: JSON.stringify(incident.details, null, 2) },
        incident_key: `assixx-${String(Date.now())}`,
        ...(incident.component != null && incident.component !== '' ?
          { component: { id: incident.component, type: 'component_reference' } }
        : {}),
        ...(incident.group != null && incident.group !== '' ?
          { priority: { id: incident.group, type: 'priority_reference' } }
        : {}),
      },
    };
  }

  /** Check if PagerDuty is configured */
  private isPagerDutyConfigured(): boolean {
    return (
      process.env['PAGERDUTY_TOKEN'] != null &&
      process.env['PAGERDUTY_TOKEN'] !== '' &&
      process.env['PAGERDUTY_SERVICE_ID'] != null &&
      process.env['PAGERDUTY_SERVICE_ID'] !== ''
    );
  }

  /**
   * Create PagerDuty incident
   * @param incident - The incident parameter
   */
  async sendPagerDutyAlert(incident: PagerDutyIncident): Promise<void> {
    if (!this.isPagerDutyConfigured()) {
      logger.warn('PagerDuty not configured, skipping alert');
      return;
    }

    const detailsJson = JSON.stringify(incident.details);
    try {
      const token = process.env['PAGERDUTY_TOKEN'] ?? '';
      const response = await axios.post<PagerDutyResponse>(
        'https://api.pagerduty.com/incidents',
        this.buildPagerDutyPayload(incident),
        {
          headers: {
            Authorization: `Token token=${token}`,
            Accept: 'application/vnd.pagerduty+json;version=2',
            'Content-Type': 'application/json',
            From: process.env['PAGERDUTY_EMAIL'] ?? 'assixx@example.com',
          },
        },
      );
      logger.info(`PagerDuty incident created: ${response.data.incident.id}`);
      await this.logAlert(
        'pagerduty',
        incident.severity,
        'incident',
        incident.summary,
        detailsJson,
        response.status,
      );
    } catch (error: unknown) {
      logger.error('Failed to create PagerDuty incident:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      await this.logAlert(
        'pagerduty',
        incident.severity,
        'incident',
        incident.summary,
        detailsJson,
        0,
        errMsg,
      );
      throw error;
    }
  }

  /** Convert details to Slack fields format */
  private toSlackFields(details: Record<string, unknown>): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(details)) {
      // eslint-disable-next-line security/detect-object-injection
      fields[key] = String(value);
    }
    return fields;
  }

  /** Convert details to Teams facts format */
  private toTeamsFacts(details: Record<string, unknown>): { name: string; value: string }[] {
    return Object.entries(details).map(([name, value]: [string, unknown]) => ({
      name,
      value: String(value),
    }));
  }

  /** Send alert to all configured channels based on severity */
  async sendCriticalAlert(
    title: string,
    message: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    const slackPromise = this.sendSlackAlert({
      channel: process.env['SLACK_CRITICAL_CHANNEL'] ?? '#alerts-critical',
      severity: 'critical',
      title,
      message,
      fields: this.toSlackFields(details),
    }).catch((e: unknown) => logger.error('Slack critical alert failed:', e));

    const teamsPromise = this.sendTeamsAlert({
      severity: 'critical',
      title,
      message,
      facts: this.toTeamsFacts(details),
    }).catch((e: unknown) => logger.error('Teams critical alert failed:', e));

    const pagerPromise = this.sendPagerDutyAlert({
      summary: title,
      severity: 'critical',
      details: { message, ...details },
    }).catch((e: unknown) => logger.error('PagerDuty critical alert failed:', e));

    await Promise.allSettled([slackPromise, teamsPromise, pagerPromise]);
  }

  /**
   * Log alert to database for audit trail
   * @param alertType - The alertType parameter
   * @param severity - The severity parameter
   * @param channel - The channel parameter
   * @param title - The title parameter
   * @param message - The message parameter
   * @param responseCode - The responseCode parameter
   * @param errorMessage - The errorMessage parameter
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
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
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
    } catch (error: unknown) {
      logger.error('Failed to log alert to database:', error);
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService();
export default alertingService;
