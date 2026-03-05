import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemPersistedArray } from '@business-objects-client';
import { AddButtonComponent } from '@components';

/**
 * Test Items
 *
 * Test items list page.
 */
@page({
  path: '/test-items',
  sidenavIcon: 'list',
  isDefault: true
})
export class TestItemsPage extends Page {
  /** Test Items - Array of test item records */
  @property({
    read: 'Automatically',
    include: { testSetting: {} }
  })
  testItems!: TestItemPersistedArray;
}

applyTemplate(
  TestItemsPage,
  `
  <flex-column>
    <flex-row [alignCenter]="true">
      <h1>Test Items</h1>
      <div grow></div>
      <add-button [array]="testItems" (added)="testItems.read()"></add-button>
    </flex-row>
    <if condition="!testItems.reading">
      <dt-table [dataSource]="testItems" routerLinkTemplate="/test-items/{id}">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="email" header="Email"></dt-column>
        <dt-column property="testSetting.name" header="Setting"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`
);
