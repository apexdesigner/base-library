import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";
import { TestSetting } from "@business-objects";

export class TestItem extends BusinessObject {
  id!: number;

  name?: string;

  testSetting?: TestSetting;
}

applyTestPostgresDataSource(TestItem);
