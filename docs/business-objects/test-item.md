---
generated-from: design/testing/business-objects/test-item/test-item.business-object.ts
generated-by: business-object.doc.md
---
# TestItem

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always |  |
| name | `string` | No |  |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| testSetting | [`TestSetting`](./test-setting.md) | Belongs To |  |

**Data Source:** [TestPostgres](../data-sources.md)

---

[← Back to Business Objects](./README.md)