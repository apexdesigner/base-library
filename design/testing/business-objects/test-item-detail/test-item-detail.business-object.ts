import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";
import { TestItem } from "@business-objects";

export class TestItemDetail extends BusinessObject {
  id!: number;

  notes?: string;

  priority?: number;

  testItem?: TestItem;
  testItemId!: number;
}

applyTestPostgresDataSource(TestItemDetail);
