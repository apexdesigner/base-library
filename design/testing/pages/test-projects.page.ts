import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestProjectPersistedArray } from '@business-objects-client';
import { AddButtonComponent } from '@components';
import { RefreshButtonComponent } from '@components';
import { SearchBarComponent } from '@components';

/**
 * Test Projects
 *
 * Test projects list page.
 */
@page({
  path: '/test-projects',
  sidenavIcon: 'folder'
})
export class TestProjectsPage extends Page {
  /** Test Projects */
  @property({
    read: 'Automatically'
  })
  testProjects!: TestProjectPersistedArray;
}

applyTemplate(TestProjectsPage, [
  {
    element: 'flex-column',
    contains: [
      {
        element: 'flex-row',
        attributes: { alignCenter: true },
        contains: [
          { h1: 'Test Projects' },
          { element: 'div', attributes: { grow: null } },
          {
            element: 'refresh-button',
            attributes: { array: '<- testProjects' }
          },
          {
            element: 'add-button',
            attributes: { array: '<- testProjects', added: '-> testProjects.read()' }
          }
        ]
      },
      {
        element: 'search-bar',
        attributes: { array: '<- testProjects' }
      },
      {
        if: '!testProjects.reading',
        contains: [
          {
            element: 'dt-table',
            attributes: { dataSource: '<- testProjects', routerLinkTemplate: '/test-projects/{id}' },
            contains: [
              { element: 'dt-column', name: 'name', attributes: { property: 'name', header: 'Name' } },
              { element: 'dt-column', name: 'description', attributes: { property: 'description', header: 'Description' } }
            ]
          }
        ],
        elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
      }
    ]
  }
]);
