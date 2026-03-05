import { DataSource } from '@apexdesigner/dsl';

/**
 * Test Postgres
 *
 * PostgreSQL data source for testing.
 */
export class TestPostgres extends DataSource {
  defaultIdType = Number;

  isDefault = true;

  configuration = {
    persistenceType: 'Postgres'
  };
}
