import { BusinessObject, relationship } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";
import { TestSetting } from "@business-objects";
import { Uuid } from "@base-types";

export class TestItem extends BusinessObject {
  id!: number;

  name?: string;

  @relationship({ type: "References" })
  testSetting?: TestSetting;

  testSettingId?: Uuid;
}

applyTestPostgresDataSource(TestItem);
