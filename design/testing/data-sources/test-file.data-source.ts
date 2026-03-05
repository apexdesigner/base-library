import { DataSource } from '@apexdesigner/dsl';
import { Uuid } from '@base-types';

/**
 * Test File
 *
 * File-based data source for testing.
 */
export class TestFile extends DataSource {
  defaultIdType = Uuid;

  configuration = {
    persistenceType: 'File',
    rootDir: process.env.FILE_DATA_DIR || './data'
  };
}
