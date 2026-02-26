import { BusinessObject, relationship } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";
import { TestSetting } from "@business-objects";
import { Uuid, Email } from "@base-types";

export class TestItem extends BusinessObject {
  id!: number;

  name?: string;

  email?: Email;

  @relationship({ type: "References" })
  testSetting?: TestSetting;

  testSettingId?: Uuid;
}

applyTestPostgresDataSource(TestItem);
