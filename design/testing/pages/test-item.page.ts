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

applyTemplate(TestItemPage, [
  {
    if: '!testItem.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h1: '{{testItem.value.name}}' },
          { element: 'sf-fields', group: '= testItem' },
          {
            if: 'testItem.controls.testItemDetail',
            contains: [
              { h2: 'Detail' },
              { element: 'sf-fields', group: '= testItem.controls.testItemDetail' },
            ],
          },
          {
            if: 'testItem.value.testSetting',
            contains: [
              {
                element: 'div',
                contains: [
                  { strong: 'Setting:' },
                  {
                    element: 'a',
                    routerLink: "= '/test-settings/' + testItem.value.testSetting.id",
                    text: '{{testItem.value.testSetting.name}}',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    elseContains: [
      { element: 'mat-progress-bar', mode: 'indeterminate' },
    ],
  },
]);
