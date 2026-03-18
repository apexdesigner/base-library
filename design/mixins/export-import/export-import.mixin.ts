import { Mixin } from '@apexdesigner/dsl';

export interface ExportImportConfig {
  /** Properties to exclude from export (e.g., computed or sensitive fields). */
  excludeProperties?: string[];

  /**
   * Relationship names to exclude from export and import.
   * For child relationships (has-many, has-one), the entire subtree is skipped
   * on export and ignored during child synchronization on import.
   * For reference relationships (belongs-to, references), the foreign key is
   * excluded and the referenced object is not included in the export.
   */
  excludeRelationships?: string[];

  /**
   * Override anchor properties for referenced types.
   * Key is the business object name, value is the list of properties to use as the anchor.
   * When not specified, unique constraints are used, falling back to all non-null scalars.
   */
  referenceAnchors?: Record<string, string[]>;

  /**
   * Roles allowed to use the export and import behaviors.
   * When not specified, the default roles for behaviors apply.
   */
  roles?: string[];
}

/**
 * Export Import
 *
 * Adds portable JSON export and import to any business object.
 */
export class ExportImport extends Mixin {}
