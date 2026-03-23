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
  sidenavIcon: 'list'
})
export class TestItemsPage extends Page {
  /** Test Items - Array of test item records */
  @property({
    read: 'Automatically',
    include: { testSetting: {} }
  })
  testItems!: TestItemPersistedArray;
}

applyTemplate(TestItemsPage, [
  {
    element: 'flex-column',
    contains: [
      {
        element: 'flex-row',
        alignCenter: '= true',
        contains: [
          { h1: 'Test Items' },
          { element: 'div', grow: true },
          {
            element: 'add-button',
            array: '= testItems',
            added: '-> testItems.read()',
          },
        ],
      },
      {
        if: '!testItems.reading',
        contains: [
          {
            element: 'dt-table',
            dataSource: '= testItems',
            routerLinkTemplate: '/test-items/{id}',
            contains: [
              { element: 'dt-column', name: 'name', property: 'name', header: 'Name' },
              { element: 'dt-column', name: 'email', property: 'email', header: 'Email' },
              { element: 'dt-column', name: 'setting', property: 'testSetting.name', header: 'Setting' },
            ],
          },
        ],
        elseContains: [
          { element: 'mat-progress-bar', mode: 'indeterminate' },
        ],
      },
    ],
  },
]);
