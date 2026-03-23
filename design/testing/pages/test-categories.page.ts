import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestCategoryPersistedArray } from '@business-objects-client';

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
    contains: [
      { element: 'mat-progress-bar', mode: 'indeterminate' },
    ],
  },
  {
    if: '!testCategories.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          { h2: 'Test Categories' },
          {
            for: 'category',
            of: 'testCategories',
            contains: [
              {
                element: 'a',
                routerLink: "= '/test-categories/' + category.id",
                text: '{{category.name}}',
              },
            ],
            emptyContains: [
              { div: 'No categories found' },
            ],
          },
        ],
      },
    ],
  },
]);
