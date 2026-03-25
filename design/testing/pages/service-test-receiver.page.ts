import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemTrackerService } from '@services';

/**
 * Service Test Receiver
 *
 * Page for testing service message receiving.
 */
@page({
  path: '/service-test-receiver',
  sidenavIcon: 'call_received'
})
export class ServiceTestReceiverPage extends Page {
  /** Test Item Tracker Service - Service for tracking test items */
  testItemTrackerService!: TestItemTrackerService;
}

applyTemplate(ServiceTestReceiverPage, [
  {
    element: 'flex-column',
    contains: [
      { h1: 'Service Test - Receiver' },
      { p: 'Message from sender: {{testItemTrackerService.message}}' },
      {
        element: 'a',
        text: 'Go to Sender',
        attributes: { 'mat-button': null, routerLink: '/service-test-sender' },
      },
    ],
  },
]);
