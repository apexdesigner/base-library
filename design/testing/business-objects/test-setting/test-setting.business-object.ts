import { BusinessObject } from "@apexdesigner/dsl";
import { applyTestFileDataSource } from "@data-sources";
import { Uuid } from "@base-types";
import { TestItem } from "@business-objects";

export class TestSetting extends BusinessObject {
  id!: Uuid;

  name?: string;

  value?: string;

  description?: string;

  category?: string;

  isActive?: boolean;

  testItems?: TestItem[];
}

applyTestFileDataSource(TestSetting);
