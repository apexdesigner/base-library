import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";

export class TestCategory extends BusinessObject {
  id!: number;

  name?: string;

  parentCategory?: TestCategory;

  childCategories?: TestCategory[];
  parentCategoryId!: number;
}

applyTestPostgresDataSource(TestCategory);
