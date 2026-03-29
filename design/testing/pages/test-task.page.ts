import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestTaskFormGroup } from '@business-objects-client';
import { DeleteButtonComponent } from '@components';
import { RefreshButtonComponent } from '@components';
import { TestProjectPage } from '@pages';

/**
 * Test Task
 *
 * Test task detail page with project reference for testing child-to-parent save propagation.
 */
@page({
  path: '/test-tasks/:testTask.id',
  parentPage: TestProjectPage,
})
export class TestTaskPage extends Page {
  /** Test Task */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    include: { testProject: {} },
  })
  testTask!: TestTaskFormGroup;
}

applyTemplate(TestTaskPage, [
  {
    if: '!testTask.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          {
            element: 'flex-row',
            name: 'header',
            attributes: { alignCenter: true },
            contains: [
              { h1: '{{testTask.value.name}}' },
              { element: 'div', attributes: { grow: null } },
              {
                element: 'refresh-button',
                attributes: { object: '<- testTask' },
              },
              {
                element: 'delete-button',
                attributes: { object: '<- testTask', afterDeleteRoute: "<- '/test-projects/' + testTask.value.testProjectId" },
              },
            ],
          },
          { element: 'sf-fields', name: 'taskFields', attributes: { group: '<- testTask' } },
          {
            if: 'testTask.controls.testProject',
            name: 'projectSection',
            contains: [
              { h2: 'Project' },
              { element: 'sf-fields', name: 'projectFields', attributes: { group: '<- testTask.controls.testProject' } },
            ],
          },
        ],
      },
    ],
    elseContains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }],
  },
]);
