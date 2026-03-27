# Custom Data Sources

Custom data sources wrap external APIs (REST, GraphQL, legacy systems) behind the same persistence interface used by PostgreSQL and file-based data sources. Business objects on a custom data source get the same generated CRUD routes, client services, and form groups — consumers don't know the backing is custom.

## Data Source Design File

Set `persistenceType: 'Custom'` in the configuration. Import handler functions from `@functions` and assign them to the CRUD operation names:

```typescript
import { DataSource } from '@apexdesigner/dsl';
import { myFind } from '@functions';
import { myFindById } from '@functions';

export class ExternalApi extends DataSource {
  defaultIdType = String;

  configuration = {
    persistenceType: 'Custom',
    find: myFind,
    findById: myFindById,
  };
}
```

Only register the operations your API supports. Unregistered operations throw at runtime with a descriptive error.

## Handler Signatures

Every handler receives `persistence` as the first parameter, followed by `entity` (the business object name), then operation-specific parameters:

| Handler | Signature |
|---------|-----------|
| `find` | `(persistence, entity, filter?) => Promise<T[]>` |
| `findOne` | `(persistence, entity, filter) => Promise<T \| null>` |
| `findById` | `(persistence, entity, id, filter?) => Promise<T \| null>` |
| `create` | `(persistence, entity, data) => Promise<T>` |
| `updateById` | `(persistence, entity, id, data) => Promise<T \| null>` |
| `deleteById` | `(persistence, entity, id) => Promise<boolean>` |

The `persistence` parameter provides access to `resolveIncludes` and other persistence operations.

## Entity Branching

A single handler serves all business objects on the data source. Branch on the `entity` parameter:

```typescript
async function myFind(persistence: any, entity: string, filter?: any): Promise<any[]> {
  if (entity === 'Customer') {
    // fetch customers from external API
  }
  if (entity === 'Order') {
    // fetch orders from external API
  }
  return [];
}
```

## Mapping API Responses

Return plain objects matching the business object's property names. The persistence layer handles the rest:

```typescript
const results = apiResponse.items.map((item: any) => ({
  id: item.external_id,
  name: item.display_name,
  createdAt: item.created_at || null,
}));
```

Use `null` for missing optional properties. Required properties must always have a value.

## Resolving Includes

Call `persistence.resolveIncludes()` at the end of read handlers to populate relationships. This triggers additional `find` or `findById` calls for related entities — which may be on the same or different data sources:

```typescript
async function myFindById(persistence: any, entity: string, id: string, filter?: any): Promise<any | null> {
  const response = await fetch(`https://api.example.com/${entity}/${id}`);
  if (!response.ok) return null;

  const result = mapToEntity(await response.json());

  return persistence.resolveIncludes(entity, result, filter?.include);
}
```

For `find`, resolve includes on each result:

```typescript
async function myFind(persistence: any, entity: string, filter?: any): Promise<any[]> {
  const response = await fetch(`https://api.example.com/${entity}`);
  const results = mapResults(await response.json());

  return Promise.all(
    results.map((r: any) => persistence.resolveIncludes(entity, r, filter?.include))
  );
}
```

Without `resolveIncludes`, included relationships will not be populated even when the API consumer requests them.

## Batch ID Lookups

When the persistence layer resolves relationships, it calls `find` with a `where.id.in` filter containing an array of foreign key values. Your handler must handle this pattern:

```typescript
if (entity === 'Author') {
  const ids = filter?.where?.id?.in as string[] | undefined;

  if (ids) {
    // Batch lookup by IDs — used by relationship resolution
    const results = [];
    for (const authorId of ids) {
      const author = await fetchAuthorById(authorId);
      if (author) results.push(author);
    }
    return Promise.all(
      results.map((r: any) => persistence.resolveIncludes(entity, r, filter?.include))
    );
  }

  // Normal search query
  const query = filter?.where?.name?.ilike?.replace(/%/g, '') || '';
  return searchAuthors(query);
}
```

This happens when a Postgres entity references a custom entity — the federated persistence collects foreign key values and batch-resolves them via `find` with `id.in`.

## Cross-Data-Source Relationships

Custom entities can have relationships with entities on other data sources (PostgreSQL, file, other custom). The federated persistence resolves these transparently:

```typescript
// TestItem (Postgres) references OpenLibraryAuthor (Custom)
@relationship({ type: 'References' })
favoriteAuthor?: OpenLibraryAuthor;
favoriteAuthorId?: string;
```

When a consumer requests `include: { favoriteAuthor: {} }`, the federated persistence:
1. Reads the TestItem from PostgreSQL
2. Collects the `favoriteAuthorId` value
3. Calls `find` on the custom persistence with `where: { id: { in: ['OL26320A'] } }`
4. Attaches the resolved author to the result

## Read-Only Data Sources

For read-only external APIs, only register `find` and `findById`. Attempts to create, update, or delete will throw descriptive errors at runtime.

---

[← Back to Patterns](./README.md)
