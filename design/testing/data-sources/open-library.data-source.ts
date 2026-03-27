import { DataSource } from '@apexdesigner/dsl';
import { openLibraryFind } from '@functions';
import { openLibraryFindById } from '@functions';

/**
 * Open Library
 *
 * A custom data source backed by the Open Library REST API.
 * Read-only: supports find and findById operations.
 */
export class OpenLibrary extends DataSource {
  defaultIdType = String;

  configuration = {
    persistenceType: 'Custom',
    find: openLibraryFind,
    findById: openLibraryFindById
  };
}
