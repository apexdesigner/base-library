import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestSettingFormGroup } from '@business-objects-client';
import { TestSettingsPage } from '@pages';

/**
 * Test Setting
 *
 * Test setting detail page.
 */
@page({
  path: '/test-settings/:testSetting.id',
  parentPage: TestSettingsPage
})
export class TestSettingPage extends Page {
  /** Test Setting - Current test setting record */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    include: { testItems: {} }
  })
  testSetting!: TestSettingFormGroup;
}

applyTemplate(TestSettingPage, [
  {
    if: '!testSetting.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h1: '{{testSetting.value.name}}' },
          { element: 'sf-fields', attributes: { group: '<- testSetting' } },
          { h3: 'Test Items' },
          {
            for: 'item',
            of: 'testSetting.value.testItems',
            contains: [
              {
                element: 'a',
                text: '{{item.name}}',
                attributes: { routerLink: "<- '/test-items/' + item.id" },
              },
            ],
            emptyContains: [
              { div: 'No test items' },
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
