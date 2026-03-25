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
          { element: 'sf-fields', name: 'topFields', attributes: { group: '<- testItem' } },
          {
            if: 'testItem.controls.testItemDetail',
            name: 'detailSection',
            contains: [
              { h2: 'Detail' },
              { element: 'sf-fields', name: 'detailFields', attributes: { group: '<- testItem.controls.testItemDetail' } },
            ],
          },
          {
            if: 'testItem.value.testSetting',
            name: 'settingSection',
            contains: [
              {
                element: 'div',
                contains: [
                  { strong: 'Setting:' },
                  {
                    element: 'a',
                    text: '{{testItem.value.testSetting.name}}',
                    attributes: { routerLink: "<- '/test-settings/' + testItem.value.testSetting.id" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    elseContains: [
      { element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } },
    ],
  },
]);
