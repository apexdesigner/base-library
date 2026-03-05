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

applyTemplate(
  ServiceTestSenderPage,
  `
  <flex-column>
    <h1>Service Test - Sender</h1>
    <p>Current message: {{testItemTrackerService.message}}</p>
    <button mat-raised-button color="primary" (click)="send()">Send Message</button>
    <a mat-button routerLink="/service-test-receiver">Go to Receiver</a>
  </flex-column>
`
);
