import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { TestCategoryFormGroup } from "@business-objects-client";
import { TestCategoriesPage } from "@pages";

@page({
  path: "/test-categories/:testCategory.id",
  parentPage: TestCategoriesPage,
})
export class TestCategoryPage extends Page {

  @property({
    read: "Automatically",
    save: "Automatically",
    include: {
      parentCategory: {},
      childCategories: {},
    },
  })
  testCategory!: TestCategoryFormGroup;
}

applyTemplate(TestCategoryPage, `
  <if condition="testCategory.reading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </if>
  <if condition="!testCategory.reading">
    <flex-column>
      <h2>{{testCategory.value.name}}</h2>
      <mat-form-field>
        <mat-label>Name</mat-label>
        <input matInput [formControl]="testCategory.controls.name">
      </mat-form-field>
      <if condition="testCategory.value.parentCategory">
        <div>
          <strong>Parent Category:</strong>
          <a [routerLink]="'/test-categories/' + testCategory.value.parentCategory.id">
            {{testCategory.value.parentCategory.name}}
          </a>
        </div>
      </if>
      <h3>Child Categories</h3>
      <for const="child" of="testCategory.value.childCategories">
        <a [routerLink]="'/test-categories/' + child.id">{{child.name}}</a>
        <when-empty>
          <div>No child categories</div>
        </when-empty>
      </for>
    </flex-column>
  </if>
`);
