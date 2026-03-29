import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestProjectFormGroup } from '@business-objects-client';
import { AccordionComponent } from '@components';
import { DeleteButtonComponent } from '@components';
import { RefreshButtonComponent } from '@components';
import { TestProjectsPage } from '@pages';

/**
 * Test Project
 *
 * Test project detail page with fields and task accordion.
 */
@page({
  path: '/test-projects/:testProject.id',
  parentPage: TestProjectsPage,
})
export class TestProjectPage extends Page {
  /** Test Project */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    include: { testTasks: {} },
  })
  testProject!: TestProjectFormGroup;
}

applyTemplate(TestProjectPage, [
  {
    if: '!testProject.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          {
            element: 'flex-row',
            name: 'header',
            attributes: { alignCenter: true },
            contains: [
              { h1: '{{testProject.value.name}}' },
              { element: 'div', attributes: { grow: null } },
              {
                element: 'refresh-button',
                attributes: { object: '<- testProject' },
              },
              {
                element: 'delete-button',
                attributes: { object: '<- testProject', afterDeleteRoute: '/test-projects' },
              },
            ],
          },
          {
            element: 'flex-row',
            attributes: { gap: '<- 24' },
            contains: [
              {
                element: 'flex-column',
                name: 'fieldsColumn',
                attributes: { grow: null, style: 'flex: 1' },
                contains: [
                  { element: 'sf-fields', attributes: { group: '<- testProject' } },
                ],
              },
              {
                element: 'flex-column',
                name: 'tasksColumn',
                attributes: { grow: null, style: 'flex: 1' },
                contains: [
                  { h2: 'Tasks' },
                  {
                    element: 'accordion',
                    attributes: {
                      array: '<- testProject.controls.testTasks',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }],
  },
]);
