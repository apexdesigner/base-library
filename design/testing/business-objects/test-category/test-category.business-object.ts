import { BusinessObject, relationship } from '@apexdesigner/dsl';

/**
 * Test Category
 *
 * Hierarchical category for organizing test items.
 */
export class TestCategory extends BusinessObject {
  /** Id - Primary key */
  id!: number;

  /** Name - Category name */
  name?: string;

  /** Parent Category - Parent category for nesting */
  @relationship({ type: 'References' })
  parentCategory?: TestCategory;
  /** Parent Category Id - Foreign key to parent category */
  parentCategoryId?: number;

  /** Child Categories - Nested child categories */
  @relationship({ pairedWith: 'parentCategory' })
  childCategories?: TestCategory[];
}
