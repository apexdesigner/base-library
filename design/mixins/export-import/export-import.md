# Export Import

The [Export Import](export-import.mixin.ts) mixin adds portable JSON export and import to any business object. It traverses the object graph — following child relationships (belongs-to-parent) downward and capturing referenced objects with their identifying context — so that an exported object can be imported into a different database where IDs differ.

## Concepts

An **export root** is the business object instance the export starts from. The mixin walks the schema from the root and collects three categories of data:

- **The root object** itself (all scalar properties).
- **Children** — objects that belong to the root (or to its children, recursively). These are owned and will be created during import.
- **References** — objects that the root or its children point to via `References` relationships. These are not owned; they must already exist in the target database. The export captures enough information to find them by unique constraint or natural key.

A **reference anchor** is the set of properties needed to locate a referenced object in the target database. For a `Room` that belongs to a `School`, the anchor includes both the room's identifying properties and the school's identifying properties, since the room cannot be found without first finding the school.

## Runtime Schema Access

The mixin leverages two runtime entry points to discover the object graph:

- **`App.businessObjects`** — a map of all business object classes keyed by name (e.g., `App.businessObjects.Room`). Each class has `static schema` (a Zod schema with relationship metadata) and `static entityName`.
- **`Model.schema.shape`** — the Zod shape object for a business object. Relationship properties are tagged with their type (`belongsTo`, `hasMany`, `hasOne`, `references`) and their target entity name and foreign key. Scalar properties carry type and constraint metadata. The `.unique()` constraints on the schema provide the fields needed for anchor resolution.

By reading `App.businessObjects` and each schema's shape, the mixin can dynamically discover all relationships and properties at runtime without hard-coding any specific business object names.

## Export Logic

Export is an instance behavior exposed as `GET /api/<plural>/:id/export`. It returns a JSON document.

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

The export produces a single JSON document:

```json
{
  "version": 1,
  "exportedAt": "2026-03-16T12:00:00.000Z",
  "rootType": "TutoringSession",
  "rootRef": "TutoringSession:42",
  "objects": {
    "TutoringSession:42": {
      "type": "TutoringSession",
      "role": "root",
      "properties": {
        "name": "Monday Session",
        "scheduledAt": "2026-03-17T10:00:00.000Z",
        "notes": "Bring workbook"
      },
      "references": {
        "room": { "ref": "Room:7" },
        "instructor": { "ref": "Instructor:3" }
      },
      "children": {
        "sessionActivities": ["SessionActivity:101", "SessionActivity:102"]
      }
    },
    "SessionActivity:101": {
      "type": "SessionActivity",
      "role": "child",
      "parentRef": "TutoringSession:42",
      "parentRelationship": "tutoringSession",
      "properties": {
        "title": "Warm-up quiz",
        "durationMinutes": 15
      },
      "references": {
        "activityTemplate": { "ref": "ActivityTemplate:50" }
      },
      "children": {}
    },
    "Room:7": {
      "type": "Room",
      "role": "reference",
      "anchor": {
        "name": "Room 204",
        "school": { "ref": "School:1" }
      }
    },
    "School:1": {
      "type": "School",
      "role": "reference",
      "anchor": {
        "name": "Lincoln Elementary"
      }
    },
    "Instructor:3": {
      "type": "Instructor",
      "role": "reference",
      "anchor": {
        "email": "jane.doe@example.com"
      }
    },
    "ActivityTemplate:50": {
      "type": "ActivityTemplate",
      "role": "reference",
      "anchor": {
        "name": "Warm-up quiz",
        "category": { "ref": "ActivityCategory:10" }
      }
    },
    "ActivityCategory:10": {
      "type": "ActivityCategory",
      "role": "reference",
      "anchor": {
        "name": "Quizzes"
      }
    }
  }
}
```

### Key Design Decisions

- **Keyed by `Type:sourceId`** — the source ID is only used as a local key within the file to wire up internal references. It is never used during import for database lookups.
- **Role field** — `root`, `child`, or `reference` makes the role of each object explicit.
- **References use `ref` pointers** — within the file, references point to other entries by their `Type:sourceId` key rather than embedding the anchor inline. This avoids duplicating anchor data when the same object is referenced from multiple places.
- **Children listed by relationship name** — the `children` map uses the has-many/has-one relationship name as the key, with an array of `Type:sourceId` refs.
- **Flat object map** — all objects live in a single `objects` map regardless of depth. The parent-child and reference relationships are captured via `ref` pointers. This keeps the structure simple and avoids deep nesting.

### ID Type Handling

The `Type:sourceId` key format works with any ID type:

| ID Type | Example Key |
|---|---|
| `number` | `Room:7` |
| `Uuid` | `TestSetting:a1b2c3d4-...` |
| `string` | `Tenant:acme-corp` |

## Import Logic

Import is a class behavior exposed as `POST /api/<plural>/import` that accepts the JSON document as the request body.

### Phase 1 — Resolve References

For each object with `role: "reference"`:

1. Build a `where` clause from the anchor properties.
2. For anchor properties that are themselves references (e.g., `school` in the room anchor), resolve those first (depth-first). Replace the `ref` with the resolved ID.
3. Query the database: `Model.findOne({ where })`.
4. If not found, throw an error listing the unresolved reference with its anchor. Do not create reference objects — they must already exist.
5. Build a map of `Type:sourceId` to the real database ID.

### Phase 2 — Create Root and Children

Process objects in parent-before-child order:

1. Start with the root object.
2. For each scalar property, copy the value.
3. For each `references` entry, look up the real ID from the reference map and set the foreign key.
4. Create the object via `Model.create(...)`.
5. Record the new real ID in the ID map (`Type:sourceId` to new ID).
6. Process children in the order listed. For each child, set its parent foreign key from the ID map, resolve its references, and create it. Recurse for grandchildren.

### Conflict Handling

The import behavior accepts an optional `onConflict` parameter:

| Value | Behavior |
|---|---|
| `"skip"` (default) | If root already exists (matched by anchor), skip the entire import and return the existing object. |
| `"error"` | Throw if root already exists. |
| `"replace"` | Delete the existing root (cascading to children) and re-import. |

Root existence is checked using the same anchor logic as references — unique constraints or natural keys.

### Transaction Safety

The entire import runs inside a database transaction. If any step fails (missing reference, validation error, constraint violation), the transaction rolls back and no partial data is created.

## Configuration

The mixin accepts configuration when applied:

```typescript
export interface ExportImportConfig {
  /** Properties to exclude from export (e.g., computed or sensitive fields). */
  excludeProperties?: string[];

  /**
   * Child relationship names to exclude from export.
   * Use this to skip large or irrelevant subtrees.
   * Names correspond to the has-many or has-one relationship name on the business object
   * (e.g., "auditLogs", "sessionActivities").
   */
  excludeChildren?: string[];

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
  excludeChildren: ["auditLogs"],
  referenceAnchors: {
    Instructor: ["email"],
    Room: ["name", "schoolId"],
  },
});
```

## Limitations

1. **References must pre-exist in the target database.** The import does not create referenced objects. If a room referenced in the export does not exist in the target database, the import fails.

2. **Circular child ownership is not supported.** If object A belongs to B and B belongs to A, the traversal would loop. The mixin only follows belongs-to-parent relationships in a tree structure (parent to children downward).

3. **Self-referencing children require ordering.** If a business object has a self-referencing belongs-to (e.g., a category tree), children must be imported in dependency order — parents before children. The import sorts by depth in the self-reference chain.

4. **Many-to-many relationships are not directly supported.** If two objects are related through a join table (a business object with two belongs-to relationships), the join object is exported as a child of the root. The other side of the join must be a reference that exists in the target database.

5. **Computed and virtual properties are not exported.** Only persisted scalar properties appear in the export. If a business object has computed behaviors or after-read enrichment, those values are not captured.

6. **Embedded objects are exported as opaque JSON.** Interface definitions stored as embedded JSON are included verbatim. If the embedded structure references IDs from other tables, those IDs will not be translated during import.

7. **File-based data sources (non-database) may not support transactions.** The transaction safety guarantee depends on the data source supporting transactions. File-based data sources like `TestFile` may not roll back cleanly on failure.

8. **No depth-limited export.** The export always traverses the full depth of the object tree. The `excludeChildren` config can skip specific relationship names, but there is no option to limit traversal to a certain depth.

9. **Anchor resolution depends on unique constraints or explicit configuration.** If a referenced business object has no unique constraint and no `referenceAnchors` configuration, the fallback (all non-null scalars) may not reliably identify the object. Explicit `referenceAnchors` configuration is recommended for any referenced type without a unique constraint.

10. **Schema compatibility.** The export file does not embed the schema version. If the schema changes between export and import (properties added, removed, or renamed), the import may fail or produce incomplete data. The `version` field in the export is for format versioning, not schema versioning.

11. **Large object graphs.** The export loads the entire object tree into memory. For business objects with thousands of children, this could be slow or exceed memory limits. Consider pagination or streaming for very large graphs.

12. **Lifecycle hooks fire during import.** Before/After Create hooks on the business object will run for each created object during import. This is usually desirable (e.g., setting defaults) but could cause unintended side effects (e.g., sending notification emails). The mixin does not suppress lifecycle hooks.
