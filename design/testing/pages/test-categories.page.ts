import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestCategoryPersistedArray } from '@business-objects-client';
import { AddFieldComponent } from '@components';

/**
 * Test Categories
 *
 * Test categories list page.
 */
@page({
  path: '/test-categories',
  sidenavIcon: 'category'
})
export class TestCategoriesPage extends Page {
  /** Test Categories - Array of test category records */
  @property({ read: 'Automatically' })
  testCategories!: TestCategoryPersistedArray;
}

applyTemplate(TestCategoriesPage, [
  {
    if: 'testCategories.reading',
    name: 'loading',
    contains: [{ element: 'mat-progress-bar', attributes: { mode: 'indeterminate' } }]
  },
  {
    if: '!testCategories.reading',
    name: 'loaded',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h2: 'Test Categories' },
          {
            element: 'add-field',
            attributes: { array: '<- testCategories', added: '-> testCategories.read()' }
          },
          {
            for: 'category',
            of: 'testCategories',
            contains: [
              {
                element: 'a',
                text: '{{category.name}}',
                attributes: { routerLink: "<- '/test-categories/' + category.id" }
              }
            ],
            emptyContains: [{ div: 'No categories found' }]
          }
        ]
      }
    ]
  }
]);
