import { addAppBehavior } from '@apexdesigner/dsl';
import { Administrator } from '@roles';

/**
 * Admin Report
 *
 * Returns admin-only data for verifying role enforcement.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/admin-report',
    roles: [Administrator],
    metadata: { category: 'reporting' }
  },
  async function adminReport() {
    return { report: 'admin-only data' };
  }
);
