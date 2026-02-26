---
generated-from: design/testing/business-objects/test-category/test-category.business-object.ts
generated-by: business-object.doc.md
---
# TestCategory

## Properties

| Name | Type | Required | Description |
|------|------|----------|-------------|
| id | `number` | Always |  |
| name | `string` | No |  |
| parentCategoryId | `number` | Always |  |

## Relationships

| Name | Type | Relationship | Description |
|------|------|--------------|-------------|
| parentCategory | [`TestCategory`](./test-category.md) | Belongs To |  |
| childCategories | [`TestCategory`](./test-category.md)[] | Has Many |  |

**Data Source:** [TestPostgres](../data-sources.md)

---

[← Back to Business Objects](./README.md)