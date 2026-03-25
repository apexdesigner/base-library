import { Page, page, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemTrackerService } from '@services';

/**
 * Service Test Sender
 *
 * Page for testing service message sending.
 */
@page({
  path: '/service-test-sender',
  sidenavIcon: 'send'
})
export class ServiceTestSenderPage extends Page {
  /** Test Item Tracker Service - Service for tracking test items */
  testItemTrackerService!: TestItemTrackerService;

  /** Send - Sends a test tracking message */
  send(): void {
    this.testItemTrackerService.message = 'Hello from sender!';
  }
}

applyTemplate(ServiceTestSenderPage, [
  {
    element: 'flex-column',
    contains: [
      { h1: 'Service Test - Sender' },
      { p: 'Current message: {{testItemTrackerService.message}}' },
      {
        element: 'button',
        text: 'Send Message',
        attributes: { 'mat-raised-button': null, color: 'primary', click: '-> send()' },
      },
      {
        element: 'a',
        text: 'Go to Receiver',
        attributes: { 'mat-button': null, routerLink: '/service-test-receiver' },
      },
    ],
  },
]);
