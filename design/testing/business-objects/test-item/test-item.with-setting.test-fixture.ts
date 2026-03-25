import { addTestFixture } from '@apexdesigner/dsl';
import { TestItem, TestSetting } from '@business-objects';

/**
 * With Setting
 *
 * Creates a test item linked to a test setting.
 */
addTestFixture(TestItem, async function withSetting() {
  const testSetting = await TestSetting.create({
    name: 'Item Setting',
    value: 'enabled',
    category: 'testing',
    isActive: true
  });
  const testItem = await TestItem.create({
    name: 'Item With Setting',
    email: 'settings@example.com',
    description: 'A test item linked to a setting.',
    testSettingId: testSetting.id
  });
  return { testItem, testSetting };
});
