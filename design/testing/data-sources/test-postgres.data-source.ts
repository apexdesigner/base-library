import { DataSource } from "@apexdesigner/dsl";

export class TestPostgres extends DataSource {
  defaultIdType = Number;

  configuration = {
    persistenceType: "Postgres"
  };
}
