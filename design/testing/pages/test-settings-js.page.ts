import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestSettingPersistedArray } from '@business-objects-client';

/**
 * Test Settings Js
 *
 * Test page using JS object template format.
 */
@page({
  path: '/test-settings-js',
})
export class TestSettingsJsPage extends Page {
  /** Test Settings - Array of test setting records */
  @property({ read: 'Automatically' })
  testSettings!: TestSettingPersistedArray;
}

applyTemplate(TestSettingsJsPage, [
  {
    if: 'testSettings.reading',
    contains: [
      { element: 'mat-progress-bar', mode: 'indeterminate' },
    ],
  },
  {
    if: '!testSettings.reading',
    contains: [
      {
        element: 'flex-column',
        gap: '= 20',
        contains: [
          { h2: 'Test Settings (JS Template)' },
          {
            for: 'setting',
            of: 'testSettings',
            trackBy: 'setting.id',
            contains: [
              {
                element: 'flex-row',
                gap: '= 12',
                contains: [
                  { span: '{{setting.name}}', name: 'name' },
                  { span: '{{setting.value}}', name: 'value' },
                ],
              },
            ],
            emptyContains: [
              { element: 'div', text: 'No settings found' },
            ],
          },
        ],
      },
    ],
  },
]);
