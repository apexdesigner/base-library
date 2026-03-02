import { BusinessObject, relationship } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";

export class TestCategory extends BusinessObject {
  id!: number;

  name?: string;

  @relationship({ type: "References" })
  parentCategory?: TestCategory;
  parentCategoryId?: number;

  @relationship({ pairedWith: "parentCategory" })
  childCategories?: TestCategory[];
}

applyTestPostgresDataSource(TestCategory);
