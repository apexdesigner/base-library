import { Page, page, property, applyTemplate } from "@apexdesigner/dsl/page";
import { TestCategoryFormGroup } from "@business-objects-client";
import { TestCategory } from "@business-objects-client";
import { TestCategoriesPage } from "@pages";

@page({
  path: "/test-categories/:testCategory.id",
  parentPage: TestCategoriesPage,
})
export class TestCategoryPage extends Page {

  @property({
    read: "Automatically",
    save: "Automatically",
    afterReadCall: "afterRead",
    include: {
      parentCategory: {},
      childCategories: {},
    },
  })
  testCategory!: TestCategoryFormGroup;

  category: TestCategory = new TestCategory();

  afterRead() {
    console.log('afterRead called');
    this.category = this.testCategory.object;
  }

  async refresh() {
    await this.testCategory.read();
  }
}

applyTemplate(TestCategoryPage, `
  <if condition="testCategory.reading">
    <mat-progress-bar mode="indeterminate"></mat-progress-bar>
  </if>
  <if condition="!testCategory.reading">
    <flex-column>
      <flex-row [centerVertical]="true">
        <h2>{{category.name}}</h2>
        <button mat-icon-button (click)="refresh()" matTooltip="Refresh">
          <mat-icon>refresh</mat-icon>
        </button>
      </flex-row>
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
