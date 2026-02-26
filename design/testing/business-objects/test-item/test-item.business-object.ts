import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";

export class TestItem extends BusinessObject {
  id!: number;

  name?: string;
}

applyTestPostgresDataSource(TestItem);
