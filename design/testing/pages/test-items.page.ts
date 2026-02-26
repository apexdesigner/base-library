import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { TestItemPersistedArray } from "@business-objects-client";

@page({
  path: "/test-items",
  sidenavIcon: "list",
})
export class TestItemsPage extends Page {

  @property({
    read: "Automatically",
    include: { testSetting: {} },
  })
  testItems!: TestItemPersistedArray;
}

applyTemplate(TestItemsPage, `
  <flex-column>
    <flex-row [alignCenter]="true">
      <h1>Test Items</h1>
    </flex-row>
    <if condition="!testItems.reading">
      <dt-table [dataSource]="testItems" routerLinkTemplate="/test-items/{id}">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="testSetting.name" header="Setting"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`);
