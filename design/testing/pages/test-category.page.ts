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
    console.log('afterRead called', this.testCategory.value);
    this.category = this.testCategory.object;
  }

  async setName() {
    await TestCategory.updateById(this.testCategory.value.id!, { name: 'Hello World' });
    await this.testCategory.read();
  }

  async clearName() {
    await TestCategory.updateById(this.testCategory.value.id!, { name: undefined });
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
        <button mat-icon-button (click)="setName()" matTooltip="Set Name">
          <mat-icon>edit</mat-icon>
        </button>
        <button mat-icon-button (click)="clearName()" matTooltip="Clear Name">
          <mat-icon>clear</mat-icon>
        </button>
      </flex-row>
      <div>category.name: "{{category.name}}"</div>
      <div>testCategory.value.name: "{{testCategory.value.name}}"</div>
      <mat-form-field>
        <mat-label>Name</mat-label>
        <input matInput [formControl]="testCategory.controls.name">
      </mat-form-field>
    </flex-column>
  </if>
`);
