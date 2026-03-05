import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemFormGroup } from '@business-objects-client';
import { TestItemsPage } from '@pages';

/**
 * Test Item
 *
 * Test item detail page.
 */
@page({
  path: '/test-items/:testItem.id',
  parentPage: TestItemsPage
})
export class TestItemPage extends Page {
  /** Test Item - Current test item record */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    include: { testSetting: {}, testItemDetail: {} }
  })
  testItem!: TestItemFormGroup;
}

applyTemplate(
  TestItemPage,
  `
  <if condition="!testItem.reading">
    <flex-column>
      <h1>{{testItem.value.name}}</h1>
      <sf-fields [group]="testItem"></sf-fields>
      <if condition="testItem.controls.testItemDetail">
        <h2>Detail</h2>
        <sf-fields [group]="testItem.controls.testItemDetail"></sf-fields>
      </if>
      <if condition="testItem.value.testSetting">
        <div>
          <strong>Setting:</strong>
          <a [routerLink]="'/test-settings/' + testItem.value.testSetting.id">
            {{testItem.value.testSetting.name}}
          </a>
        </div>
      </if>
    </flex-column>
    <else>
      <mat-progress-bar mode="indeterminate"></mat-progress-bar>
    </else>
  </if>
`
);
