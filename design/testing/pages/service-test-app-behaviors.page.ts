import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
import { AppService } from '@services';
import createDebug from 'debug';

const debug = createDebug('ServiceTestAppBehaviors');

/**
 * Service Test App Behaviors
 *
 * Tests calling app behavior endpoints through the generated AppService methods.
 */
@page({ path: '/service-test-app-behaviors' })
export class ServiceTestAppBehaviorsPage extends Page {
  /** App Service */
  appService!: AppService;

  /** Health Result */
  healthResult?: string;

  /** Call Health Check */
  async callHealthCheck(): Promise<void> {
    const result = await this.appService.systemHealthCheck();
    debug('result %j', result);
    this.healthResult = JSON.stringify(result);
  }
}

applyTemplate(ServiceTestAppBehaviorsPage, [
  {
    element: 'flex-column',
    gap: '= 16',
    contains: [
      { h1: 'App Behavior Tests' },
      {
        element: 'flex-row',
        gap: '= 8',
        alignCenter: '= true',
        contains: [
          {
            element: 'button',
            'mat-flat-button': true,
            text: 'Health Check',
            click: '-> callHealthCheck()',
          },
          { span: '{{healthResult}}' },
        ],
      },
    ],
  },
]);
