import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import { SlackAlerts } from '@apexdesigner/slack-alerts';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:setupSlackAlerts');

/**
 * Setup Slack Alerts
 *
 * Initializes the SlackAlerts client and sends a startup notification.
 * Requires `SLACK_WEBHOOK_URL` env var to enable. If not set, alerts
 * are disabled gracefully.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Startup',
    sequence: 50
  },
  async function setupSlackAlerts() {
    const packageJson = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'package.json'), 'utf-8'));
    debug('version %s', packageJson.version);

    const alerts = new SlackAlerts({
      appName: packageJson.name,
      version: packageJson.version,
      appUrl: process.env.APP_URL,
      context: process.env.NODE_ENV
    });

    App.slackAlertsProperties.instance = alerts;

    await alerts.started();
    debug('started alert sent');
  }
);
