import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:slackAlertsShutdown');

/**
 * Slack Alerts Shutdown
 *
 * Sends a shutdown notification to Slack during graceful shutdown.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Shutdown',
    sequence: 900
  },
  async function slackAlertsShutdown() {
    const alerts = App.slackAlertsProperties.instance;
    if (!alerts) {
      debug('no alerts instance, skipping');
      return;
    }

    await alerts.stopped(0);
    debug('stopped alert sent');
  }
);
