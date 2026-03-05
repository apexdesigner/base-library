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

applyTemplate(
  TestCategoriesPage,
  `
  <if condition="testCategories.reading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </if>
  <if condition="!testCategories.reading">
    <flex-column>
      <h2>Test Categories</h2>
      <for const="category" of="testCategories">
        <a [routerLink]="'/test-categories/' + category.id">{{category.name}}</a>
        <when-empty>
          <div>No categories found</div>
        </when-empty>
      </for>
    </flex-column>
  </if>
`
);
