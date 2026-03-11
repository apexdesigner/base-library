import { addAppBehavior } from '@apexdesigner/dsl';
import { App } from '@app';
import createDebug from 'debug';

const debug = createDebug('BaseLibrary:slackAlertsErrorHandler');

/**
 * Slack Alerts Error Handler
 *
 * Registers global error handlers that send Slack notifications for
 * uncaught exceptions and unhandled rejections.
 */
addAppBehavior(
  {
    type: 'Lifecycle Behavior',
    stage: 'Startup',
    sequence: 60
  },
  async function slackAlertsErrorHandler() {
    const alerts = App.slackAlertsProperties.instance;
    if (!alerts) {
      debug('no alerts instance, skipping');
      return;
    }

    process.on('uncaughtException', async (err) => {
      debug('uncaughtException %O', err);
      await alerts.error(err, 'Uncaught Exception');
    });

    process.on('unhandledRejection', async (reason) => {
      debug('unhandledRejection %O', reason);
      const err = reason instanceof Error ? reason : new Error(String(reason));
      await alerts.error(err, 'Unhandled Rejection');
    });

    debug('error handlers registered');
  }
);
