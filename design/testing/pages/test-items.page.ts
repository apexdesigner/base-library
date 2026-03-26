import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestItemPersistedArray } from '@business-objects-client';
import { AddButtonComponent } from '@components';
import { ExportTsvButtonComponent } from '@components';
import { ImportTsvButtonComponent } from '@components';
import { RefreshButtonComponent } from '@components';
import { SearchBarComponent } from '@components';

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
        attributes: { alignCenter: true },
        contains: [
          { h1: 'Test Items' },
          { element: 'div', attributes: { grow: null } },
          {
            element: 'import-tsv-button',
            attributes: { array: '<- testItems' },
          },
          {
            element: 'export-tsv-button',
            attributes: { array: '<- testItems' },
          },
          {
            element: 'refresh-button',
            attributes: { array: '<- testItems' },
          },
          {
            element: 'add-button',
            attributes: { array: '<- testItems', added: '-> testItems.read()' },
          }
        ]
      },
      {
        element: 'search-bar',
        attributes: { array: '<- testItems' },
      },
      {
        if: '!testItems.reading',
        contains: [
          {
            element: 'dt-table',
            attributes: { dataSource: '<- testItems', routerLinkTemplate: '/test-items/{id}' },
            contains: [
              { element: 'dt-column', name: 'name', attributes: { property: 'name', header: 'Name' } },
              { element: 'dt-column', name: 'email', attributes: { property: 'email', header: 'Email' } },
              { element: 'dt-column', name: 'setting', attributes: { property: 'testSetting.name', header: 'Setting' } }
            ]
          }
        ],
        elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
      }
    ]
  }
]);
