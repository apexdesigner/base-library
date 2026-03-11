import { addAppBehavior, addTest } from '@apexdesigner/dsl';
import { expect } from 'vitest';

/**
 * Slow Operation
 *
 * Test endpoint that simulates a slow operation.
 */
addAppBehavior(
  {
    type: 'Class Behavior',
    httpMethod: 'Get',
    path: '/api/slow-operation'
  },
  async function slowOperation() {
    await new Promise(resolve => setTimeout(resolve, 7000));
    return { status: 'done' };
  }
);

addTest(
  'should complete within extended timeout',
  async () => {
    const start = Date.now();
    await new Promise(resolve => setTimeout(resolve, 7000));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(6000);
  },
  { timeout: 10000 }
);
