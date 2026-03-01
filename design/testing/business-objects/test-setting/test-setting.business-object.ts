import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestFileDataSource } from "@data-sources";
import { Uuid, Json } from "@base-types";
import { TestItem } from "@business-objects";

export class TestSetting extends BusinessObject {
  id!: Uuid;

  name?: string;

  value?: string;

  description?: string;

  category?: string;

  isActive?: boolean;

  config?: Json;

  testItems?: TestItem[];
}

applyTestFileDataSource(TestSetting);
