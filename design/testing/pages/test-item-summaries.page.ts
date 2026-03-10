import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemSummaryPersistedArray } from '@business-objects-client';

/**
 * Test Item Summaries
 *
 * List page for test item summaries view.
 */
@page({
  path: '/test-item-summaries',
  sidenavIcon: 'summarize'
})
export class TestItemSummariesPage extends Page {
  /** Test Item Summaries - Array of summary records */
  @property({ read: 'Automatically' })
  testItemSummaries!: TestItemSummaryPersistedArray;
}

applyTemplate(
  TestItemSummariesPage,
  `
  <flex-column>
    <h1>Test Item Summaries</h1>
    <if condition="!testItemSummaries.reading">
      <dt-table [dataSource]="testItemSummaries">
        <dt-column property="name" header="Name"></dt-column>
        <dt-column property="description" header="Description"></dt-column>
        <dt-column property="settingName" header="Setting"></dt-column>
        <dt-column property="itemCount" header="Count"></dt-column>
      </dt-table>
      <else>
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      </else>
    </if>
  </flex-column>
`
);
