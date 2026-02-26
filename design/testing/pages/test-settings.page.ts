import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { TestSettingPersistedArray } from "@business-objects-client";

@page({
  path: "/test-settings",
  sidenavIcon: "settings",
})
export class TestSettingsPage extends Page {

  @property({ read: "Automatically" })
  testSettings!: TestSettingPersistedArray;
}

applyTemplate(TestSettingsPage, `
  <flex-column>
    <flex-row [alignCenter]="true">
      <h1>Test Settings</h1>
    </flex-row>
    <if condition="!testSettings.reading">
      <dt-table [dataSource]="testSettings" routerLinkTemplate="/test-settings/{id}">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="value" header="Value"></dt-column>
        <dt-column property="category" header="Category"></dt-column>
        <dt-column property="isActive" header="Active"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`);
