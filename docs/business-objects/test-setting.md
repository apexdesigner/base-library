---
generated-from: design/testing/business-objects/test-setting/test-setting.business-object.ts
generated-by: business-object.doc.md
---
# TestSetting

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | [`Uuid`](../base-types.md#uuid) | Always |  |
| name | `string` | No |  |
| value | `string` | No |  |
| description | `string` | No |  |
| category | `string` | No |  |
| isActive | `boolean` | No |  |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| testItems | [`TestItem`](./test-item.md)[] | Has Many |  |

**Data Source:** [TestFile](../data-sources.md)

---

[← Back to Business Objects](./README.md)