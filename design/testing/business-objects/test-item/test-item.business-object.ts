import { BusinessObject, property, relationship } from '@apexdesigner/dsl';

import { TestSetting, TestItemDetail } from '@business-objects';
import { Uuid, Email } from '@base-types';
import { Audit } from '@mixins';
import { applyAuditMixin } from '@mixins';

/**
 * Test Item
 *
 * Item used for testing business object features.
 */
export class TestItem extends BusinessObject {
  static mixins = [Audit];
  /** Id - Primary key */
  id!: number;

  /** Name - Item name */
  @property({ required: true })
  name?: string;

  /** Email - Contact email */
  email?: Email;

  /** Description - Optional description */
  description?: string;

  /** Due Date - Target completion date */
  dueDate?: Date;

  /** Test Setting - Referenced test setting */
  @relationship({ type: 'References' })
  testSetting?: TestSetting;

  /** Test Setting Id - Foreign key to test setting */
  testSettingId?: Uuid;

  /** Test Item Detail - Associated detail record */
  @relationship({ type: 'Has One' })
  testItemDetail?: TestItemDetail;
}

applyAuditMixin(TestItem, { excludeProperties: ['description'] });
