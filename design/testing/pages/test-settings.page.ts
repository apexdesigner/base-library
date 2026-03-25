import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestSettingPersistedArray } from '@business-objects-client';
import { Administrator } from '@roles';

/**
 * Test Settings
 *
 * Test settings list page.
 */
@page({
  path: '/test-settings',
  sidenavIcon: 'settings',
  roles: [Administrator]
})
export class TestSettingsPage extends Page {
  /** Test Settings - Array of test setting records */
  @property({ read: 'Automatically' })
  testSettings!: TestSettingPersistedArray;
}

applyTemplate(TestSettingsPage, [
  {
    element: 'flex-column',
    contains: [
      {
        element: 'flex-row',
        attributes: { alignCenter: true },
        contains: [{ h1: 'Test Settings' }]
      },
      {
        if: '!testSettings.reading',
        contains: [
          {
            element: 'dt-table',
            attributes: { dataSource: '<- testSettings', routerLinkTemplate: '/test-settings/{id}' },
            contains: [
              { element: 'dt-column', name: 'name', attributes: { property: 'name', header: 'Name' } },
              { element: 'dt-column', name: 'value', attributes: { property: 'value', header: 'Value' } },
              { element: 'dt-column', name: 'category', attributes: { property: 'category', header: 'Category' } },
              { element: 'dt-column', name: 'isActive', attributes: { property: 'isActive', header: 'Active' } }
            ]
          }
        ],
        elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
      }
    ]
  }
]);
