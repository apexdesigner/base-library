import { Page, page, property, applyTemplate } from '@apexdesigner/dsl/page';
import { TestCategoryFormGroup } from '@business-objects-client';
import { TestCategory } from '@business-objects-client';
import { TestCategoriesPage } from '@pages';

/**
 * Test Category
 *
 * Test category detail page.
 */
@page({
  path: '/test-categories/:testCategory.id',
  parentPage: TestCategoriesPage
})
export class TestCategoryPage extends Page {
  /** Test Category - Current test category record */
  @property({
    read: 'Automatically',
    save: 'Automatically',
    afterReadCall: 'afterRead',
    include: {
      parentCategory: {},
      childCategories: {}
    }
  })
  testCategory!: TestCategoryFormGroup;

  /** Category - Category display name */
  category: TestCategory = new TestCategory();

  /** After Read - Hook called after reading the category */
  afterRead() {
    console.log('afterRead called', this.testCategory.value);
    this.category = this.testCategory.object;
  }

  /** Set Name - Sets the category name */
  async setName() {
    await TestCategory.updateById(this.testCategory.value.id!, { name: 'Hello World' });
    await this.testCategory.read();
  }

  /** Clear Name - Clears the category name */
  async clearName() {
    await TestCategory.updateById(this.testCategory.value.id!, { name: undefined });
    await this.testCategory.read();
  }
}

applyTemplate(TestCategoryPage, [
  {
    if: 'testCategory.reading',
    contains: [
      { element: 'mat-progress-bar', mode: 'indeterminate' },
    ],
  },
  {
    if: '!testCategory.reading',
    contains: [
      {
        element: 'flex-column',
        contains: [
          {
            element: 'flex-row',
            centerVertical: '= true',
            contains: [
              { h2: '{{category.name}}' },
              {
                element: 'button',
                name: 'setName',
                'mat-icon-button': true,
                click: '-> setName()',
                matTooltip: 'Set Name',
                contains: [{ 'mat-icon': 'edit' }],
              },
              {
                element: 'button',
                name: 'clearName',
                'mat-icon-button': true,
                click: '-> clearName()',
                matTooltip: 'Clear Name',
                contains: [{ 'mat-icon': 'clear' }],
              },
            ],
          },
          { div: 'category.name: "{{category.name}}"' },
          { div: 'testCategory.value.name: "{{testCategory.value.name}}"' },
          {
            element: 'mat-form-field',
            contains: [
              { 'mat-label': 'Name' },
              {
                element: 'input',
                matInput: true,
                formControl: '= testCategory.controls.name',
              },
            ],
          },
        ],
      },
    ],
  },
]);
