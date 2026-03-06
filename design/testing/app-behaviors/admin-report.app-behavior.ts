import { addAppBehavior } from '@apexdesigner/dsl';
import { Administrator } from '@roles';

addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/admin-report',
    roles: [Administrator]
  },
  async function adminReport() {
    return { report: 'admin-only data' };
  }
);
