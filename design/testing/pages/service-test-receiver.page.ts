import { Page, page, applyTemplate } from "@apexdesigner/dsl/page";
import { TestItemTrackerService } from "@services";

@page({
  path: "/service-test-receiver",
  sidenavIcon: "call_received",
})
export class ServiceTestReceiverPage extends Page {

  testItemTrackerService!: TestItemTrackerService;
}

applyTemplate(ServiceTestReceiverPage, `
  <flex-column>
    <h1>Service Test - Receiver</h1>
    <p>Message from sender: {{testItemTrackerService.message}}</p>
    <a mat-button routerLink="/service-test-sender">Go to Sender</a>
  </flex-column>
`);
