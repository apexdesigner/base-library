# Export Import

The [Export Import](export-import.mixin.ts) mixin adds portable JSON export and import to any business object. It traverses the object graph — following child relationships (belongs-to-parent) downward and capturing referenced objects with their identifying context — so that an exported object can be imported into a different database where IDs differ.

## Concepts

An **export root** is the business object instance the export starts from. The mixin walks the schema from the root and collects three categories of data:

- **The root object** itself (all scalar properties).
- **Children** — objects that belong to the root (or to its children, recursively). These are owned and will be created, updated, or removed during import.
- **References** — objects that the root or its children point to via `References` relationships. These are not owned; they must already exist in the target database. The export captures enough information to find them by unique constraint or natural key.

A **reference anchor** is the set of properties needed to locate a referenced object in the target database. For a `Room` that belongs to a `School`, the anchor includes both the room's identifying properties and the school's identifying properties, since the room cannot be found without first finding the school.

## Runtime Schema Access

The mixin leverages two runtime entry points to discover the object graph:

- **`App.businessObjects`** — a map of all business object classes keyed by name (e.g., `App.businessObjects.Room`). Each class has `static schema` (a Zod schema with relationship metadata) and `static entityName`.
- **`Model.schema.shape`** — the Zod shape object for a business object. Relationship properties are tagged with their type (`belongsTo`, `hasMany`, `hasOne`, `references`) and their target entity name and foreign key. Scalar properties carry type and constraint metadata. The `.unique()` constraints on the schema provide the fields needed for anchor resolution.

By reading `App.businessObjects` and each schema's shape, the mixin can dynamically discover all relationships and properties at runtime without hard-coding any specific business object names.

## Export Behaviors

The mixin provides three levels of export: a single instance, a filtered set from one entity, and a multi-entity bulk export.

### Instance Export

Export is an instance behavior exposed as `GET /api/<plural>/:id/export`. It returns a JSON document containing the single root and its graph.

### Export Many (Class Behavior)

The [exportMany](export-import.export-many.behavior.ts) class behavior is exposed as `POST /api/<plural>/export-many`. It accepts a `where` filter in the request body and exports every matching instance as a root, combining them into a single file. Each matched instance is traversed independently using the same graph-walking logic as the instance export. References that appear in multiple roots are deduplicated in the flat object map.

### Bulk Export (App Behavior)

The [bulkExport](export-import.bulk-export.app-behavior.ts) app behavior is exposed as `POST /api/bulk-export`. It accepts a map of entity names to where filters and produces a single combined export file. Only business objects that have the Export Import mixin applied can be included; the behavior throws if a requested entity name does not have the mixin. Each entity's matches are traversed as roots, and references are deduplicated across all entities.

```json
{
  "TutoringSession": { "instructorId": 3 },
  "Workshop": { "status": "published" }
}
```

## Export Logic

### Graph Traversal

Starting from the root instance:

1. **Load the root** with all scalar properties.
2. **Read the schema** via `Model.schema` to discover all relationships.
3. **Walk has-many and has-one relationships** where the child's relationship back to the parent is `Belongs To` with the parent as the relationship target. For each child type, look up its class from `App.businessObjects`, read its schema for further relationships, and recurse — collecting its scalars, its children, and its references.
4. **Walk belongs-to and references relationships** on the root and every collected child. For each referenced object, build a reference anchor (see below). Do not recurse into the referenced object's children.

### Reference Anchor Resolution

To build an anchor for a referenced object:

1. Look up the referenced business object's unique constraints. If one exists, load those properties — that is the anchor.
2. If no unique constraint, fall back to all non-null scalar properties (excluding `id` and foreign keys).
3. If the referenced object itself has `Belongs To` or `References` relationships that are part of the unique constraint or needed for identification, recursively build anchors for those as well. This is the "room belongs to school" case — the anchor for the room includes the anchor for the school.

### What Gets Exported

For each object (root, child, or reference):

- All scalar properties (excluding `id` and auto-generated foreign keys).
- Embedded objects (JSON-stored interface definitions) are included as-is.
- `Belongs To` foreign keys are excluded (reconstructed from the parent-child nesting during import).
- `References` foreign keys are excluded (resolved from anchors during import).

## File Content Structure

The export produces a single JSON document. The `objects` map is organized by entity type, then by source ID, making the structure normalized and flat.

```json
{
  "version": 1,
  "exportedFrom": "https://app.example.com",
  "exportedAt": "2026-03-16T12:00:00.000Z",
  "rootType": "TutoringSession",
  "rootIds": ["42"],
  "objects": {
    "TutoringSession": {
      "42": {
        "role": "root",
        "properties": {
          "name": "Monday Session",
          "scheduledAt": "2026-03-17T10:00:00.000Z",
          "notes": "Bring workbook"
        },
        "references": {
          "room": { "ref": "Room.7" },
          "instructor": { "ref": "Instructor.3" }
        },
        "children": {
          "sessionActivities": ["SessionActivity.101", "SessionActivity.102"]
        }
      }
    },
    "SessionActivity": {
      "101": {
        "role": "child",
        "parentRef": "TutoringSession.42",
        "parentRelationship": "tutoringSession",
        "properties": {
          "title": "Warm-up quiz",
          "durationMinutes": 15
        },
        "references": {
          "activityTemplate": { "ref": "ActivityTemplate.50" }
        },
        "children": {}
      },
      "102": {
        "role": "child",
        "parentRef": "TutoringSession.42",
        "parentRelationship": "tutoringSession",
        "properties": {
          "title": "Main lesson",
          "durationMinutes": 30
        },
        "references": {},
        "children": {}
      }
    },
    "Room": {
      "7": {
        "role": "reference",
        "anchor": {
          "name": "Room 204",
          "school": { "ref": "School.1" }
        }
      }
    },
    "School": {
      "1": {
        "role": "reference",
        "anchor": {
          "name": "Lincoln Elementary"
        }
      }
    },
    "Instructor": {
      "3": {
        "role": "reference",
        "anchor": {
          "email": "jane.doe@example.com"
        }
      }
    },
    "ActivityTemplate": {
      "50": {
        "role": "reference",
        "anchor": {
          "name": "Warm-up quiz",
          "category": { "ref": "ActivityCategory.10" }
        }
      }
    },
    "ActivityCategory": {
      "10": {
        "role": "reference",
        "anchor": {
          "name": "Quizzes"
        }
      }
    }
  }
}
```

### Key Design Decisions

- **`exportedFrom`** — set from `process.env.appUrl`, falling back to `os.hostname()`. Identifies which environment produced the export so consumers know where the data came from.
- **Nested by type then ID** — `objects.TutoringSession.42` instead of a flat `objects["TutoringSession:42"]`. This normalizes the structure by entity type, makes it easy to iterate all objects of a given type, and avoids encoding conventions in string keys.
- **Dot-separated ref pointers** — references within the file use `Type.sourceId` (e.g., `"Room.7"`) to point to entries in the nested map. The source ID is only used as a local key within the file to wire up internal references; it is never used during import for database lookups.
- **`rootIds` array** — supports single and multi-root exports. For a single instance export this contains one ID; for `exportMany` and `bulkExport` it contains all matched root IDs.
- **`rootType`** — present for single-entity exports. For `bulkExport` with multiple entity types, this field is omitted and the roots are identified by their `role: "root"` entries across multiple type keys in the `objects` map.
- **Role field** — `root`, `child`, or `reference` makes the role of each object explicit.
- **References use `ref` pointers** — within the file, references point to other entries by their `Type.sourceId` key rather than embedding the anchor inline. This avoids duplicating anchor data when the same object is referenced from multiple places.
- **Children listed by relationship name** — the `children` map uses the has-many/has-one relationship name as the key, with an array of `Type.sourceId` refs.
- **Flat normalized map** — all objects live in the `objects` map keyed by type then ID. The parent-child and reference relationships are captured via `ref` pointers. This keeps the structure simple and avoids deep nesting.

### ID Type Handling

The nested key format works with any ID type:

| ID Type | Example Path | Ref Pointer |
|---|---|---|
| `number` | `objects.Room["7"]` | `Room.7` |
| `Uuid` | `objects.TestSetting["a1b2c3d4-..."]` | `TestSetting.a1b2c3d4-...` |
| `string` | `objects.Tenant["acme-corp"]` | `Tenant.acme-corp` |

## Import Logic

Import is a class behavior exposed as `POST /api/<plural>/import` that accepts the JSON document as the request body. The import uses an iterative multi-pass approach to resolve references and create objects, controlled by a `_targetId` field that tracks what has been resolved.

### Iterative Resolution

Rather than requiring a strict ordering of operations, the import iterates in passes until all items are processed:

1. **Initialize** — parse the file and annotate each item with `_targetId: null`. This internal tracking field indicates the item has not yet been resolved to a real database ID.
2. **Reference resolution pass** — for each reference object where `_targetId` is null, attempt to resolve it. Build a `where` clause from the anchor. If the anchor contains `ref` pointers to other references, check whether those references already have a `_targetId`. If they do, substitute the real ID and query. If they don't, skip this reference for now — it will be retried on the next pass.
3. **Repeat** until all references have a `_targetId` or a pass makes no progress. If a pass completes with no new resolutions and unresolved references remain, throw an error listing the unresolved references with their anchors.

### Root and Children Import

Once all references are resolved, the import creates the root and synchronizes children:

1. **Check for existing root** — use the anchor or conflict-handling strategy to determine whether the root already exists in the target database.
2. **If the root does not exist** — create the root object, setting scalar properties and resolving reference foreign keys from the `_targetId` map. Record the new ID as the root's `_targetId`.
3. **If the root exists** (and `onConflict` is `"update"`) — update the root's scalar properties and reference foreign keys.
4. **Synchronize children** — for each child relationship on the root (and recursively on children):
   - **Add** — children present in the file but not in the database are created.
   - **Update** — children present in both are updated with the file's property values.
   - **Remove** — children present in the database but not in the file are deleted.
   - Matching existing children to file entries uses the same anchor logic as references: unique constraints or natural keys. If a child has no unique constraint, fall back to matching on all non-null scalar properties (excluding `id` and foreign keys).
5. **Record each child's `_targetId`** as it is created or matched, so that grandchildren can reference their parent's real ID on subsequent iterations.

The child synchronization is itself iterative — children are processed in passes just like references, since a child may reference another child that hasn't been created yet. Passes continue until all children have a `_targetId`.

### Conflict Handling

The import behavior accepts an optional `onConflict` parameter:

| Value | Behavior |
|---|---|
| `"skip"` (default) | If root already exists (matched by anchor), skip the entire import and return the existing object. |
| `"error"` | Throw if root already exists. |
| `"update"` | Update the existing root's properties and synchronize children (add/update/remove). |
| `"replace"` | Delete the existing root (cascading to children) and re-import from scratch. |

Root existence is checked using the same anchor logic as references — unique constraints or natural keys.

### Transaction Safety

The entire import runs inside a database transaction. If any step fails (missing reference, validation error, constraint violation), the transaction rolls back and no partial data is created or modified.

## Configuration

The mixin accepts configuration when applied:

```typescript
export interface ExportImportConfig {
  /** Properties to exclude from export (e.g., computed or sensitive fields). */
  excludeProperties?: string[];

  /**
   * Relationship names to exclude from export.
   * For child relationships (has-many, has-one), the entire subtree is skipped.
   * For reference relationships (belongs-to, references), the foreign key is
   * excluded and the referenced object is not included in the export.
   * Names correspond to the relationship name on the business object
   * (e.g., "auditLogs", "instructor", "room").
   */
  excludeRelationships?: string[];

  /**
   * Override anchor properties for referenced types.
   * Key is the business object name, value is the list of properties to use as the anchor.
   * When not specified, unique constraints are used, falling back to all non-null scalars.
   */
  referenceAnchors?: Record<string, string[]>;
}
```

Example usage:

```typescript
applyExportImportMixin(TutoringSession, {
  excludeProperties: ["createdAt", "updatedAt"],
  excludeRelationships: ["auditLogs", "instructor"],
  referenceAnchors: {
    Instructor: ["email"],
    Room: ["name", "schoolId"],
  },
});
```

## Limitations

1. **References must pre-exist in the target database.** The import does not create referenced objects. If a room referenced in the export does not exist in the target database, the import fails.

2. **Circular child ownership is not supported.** If object A belongs to B and B belongs to A, the traversal would loop. The mixin only follows belongs-to-parent relationships in a tree structure (parent to children downward).

3. **Self-referencing children require ordering.** If a business object has a self-referencing belongs-to (e.g., a category tree), children must be imported in dependency order — parents before children. The iterative pass approach handles this naturally since a child whose parent hasn't been created yet will be retried on the next pass.

4. **Many-to-many relationships are not directly supported.** If two objects are related through a join table (a business object with two belongs-to relationships), the join object is exported as a child of the root. The other side of the join must be a reference that exists in the target database.

5. **Computed and virtual properties are not exported.** Only persisted scalar properties appear in the export. If a business object has computed behaviors or after-read enrichment, those values are not captured.

6. **Embedded objects are exported as opaque JSON.** Interface definitions stored as embedded JSON are included verbatim. If the embedded structure references IDs from other tables, those IDs will not be translated during import.

7. **File-based data sources (non-database) may not support transactions.** The transaction safety guarantee depends on the data source supporting transactions. File-based data sources like `TestFile` may not roll back cleanly on failure.

8. **No depth-limited export.** The export always traverses the full depth of the object tree. The `excludeRelationships` config can skip specific relationships, but there is no option to limit traversal to a certain depth.

9. **Anchor resolution depends on unique constraints or explicit configuration.** If a referenced business object has no unique constraint and no `referenceAnchors` configuration, the fallback (all non-null scalars) may not reliably identify the object. Explicit `referenceAnchors` configuration is recommended for any referenced type without a unique constraint.

10. **Schema compatibility.** The export file does not embed the schema version. If the schema changes between export and import (properties added, removed, or renamed), the import may fail or produce incomplete data. The `version` field in the export is for format versioning, not schema versioning.

11. **Large object graphs.** The export loads the entire object tree into memory. For business objects with thousands of children, this could be slow or exceed memory limits. Consider pagination or streaming for very large graphs.

12. **Lifecycle hooks fire during import.** Before/After Create and Before/After Update hooks on the business object will run for each created or updated object during import. This is usually desirable (e.g., setting defaults) but could cause unintended side effects (e.g., sending notification emails). The mixin does not suppress lifecycle hooks.

13. **Child matching depends on identifiable properties.** The update conflict mode matches existing children to file entries using unique constraints or natural keys. If children have no distinguishing properties beyond their parent foreign key, matching may be ambiguous. In this case, `"replace"` mode (which deletes and recreates) is more reliable than `"update"`.
