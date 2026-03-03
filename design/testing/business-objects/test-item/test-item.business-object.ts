import { BusinessObject, property, relationship } from "@apexdesigner/dsl";
import { applyTestPostgresDataSource } from "@data-sources";
import { TestSetting, TestItemDetail } from "@business-objects";
import { Uuid, Email } from "@base-types";

export class TestItem extends BusinessObject {
  id!: number;

  @property({ required: true })
  name?: string;

  email?: Email;

  @relationship({ type: "References" })
  testSetting?: TestSetting;

  testSettingId?: Uuid;

  @relationship({ type: "Has One" })
  testItemDetail?: TestItemDetail;
}

applyTestPostgresDataSource(TestItem);
