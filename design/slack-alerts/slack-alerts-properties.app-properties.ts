import { AppProperties, property } from '@apexdesigner/dsl/app-properties';
import { SlackAlerts } from '@apexdesigner/slack-alerts';

/**
 * Slack Alerts
 *
 * Server-side singleton holding the SlackAlerts instance for sending
 * lifecycle notifications to Slack.
 */
export class SlackAlertsProperties extends AppProperties {
  /** Instance - The SlackAlerts client */
  @property({ hidden: true })
  instance?: SlackAlerts;
}
