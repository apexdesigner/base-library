import { addAppBehavior } from '@apexdesigner/dsl';

/**
 * System Health Check
 *
 * Returns server health status.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/health'
  },
  async function systemHealthCheck() {
    return { status: 'ok' };
  }
);
