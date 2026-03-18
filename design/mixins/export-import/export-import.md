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

- All scalar properties except `id`.
- Foreign keys for `Belongs To` and `References` relationships are included as-is, using source database IDs. The importer maps these to target IDs.
- Embedded objects (JSON-stored interface definitions) are included as-is.

## File Content Structure

The export produces a single JSON document. The `objects` map is organized by entity type, then by source ID. Each entry is the raw object — scalar properties, embedded objects, and foreign keys — exactly as they exist in the source database (minus the `id`). No wrapper structure is needed because the schema is known on both sides; the importer inspects the schema to determine which fields are reference foreign keys, which relationships are children, etc.

```json
{
  "version": 1,
  "exportedFrom": "https://app.example.com",
  "exportedAt": "2026-03-16T12:00:00.000Z",
  "roots": {
    "TutoringSession": ["42"]
  },
  "objects": {
    "TutoringSession": {
      "42": {
        "name": "Monday Session",
        "scheduledAt": "2026-03-17T10:00:00.000Z",
        "notes": "Bring workbook",
        "roomId": 7,
        "instructorId": 3
      }
    },
    "SessionActivity": {
      "101": {
        "title": "Warm-up quiz",
        "durationMinutes": 15,
        "tutoringSessionId": 42,
        "activityTemplateId": 50
      },
      "102": {
        "title": "Main lesson",
        "durationMinutes": 30,
        "tutoringSessionId": 42
      }
    },
    "Room": {
      "7": {
        "name": "Room 204",
        "schoolId": 1
      }
    },
    "School": {
      "1": {
        "name": "Lincoln Elementary"
      }
    },
    "Instructor": {
      "3": {
        "email": "jane.doe@example.com"
      }
    },
    "ActivityTemplate": {
      "50": {
        "name": "Warm-up quiz",
        "activityCategoryId": 10
      }
    },
    "ActivityCategory": {
      "10": {
        "name": "Quizzes"
      }
    }
  }
}
```

### How the Importer Uses the Schema

The file contains no role annotations, ref pointers, or child lists — the schema provides all of that:

- **Roots** — identified by the `roots` map (entity name → source ID arrays).
- **Children** — the importer walks the root's schema to find has-many/has-one relationships where the inverse is `Belongs To`. It looks up children in the `objects` map by entity type, matching on the parent foreign key (e.g., all `SessionActivity` entries where `tutoringSessionId` matches a root's source ID).
- **References** — any entity type in `objects` that is not a root type and not a child type is a reference. The importer resolves references using their anchor properties (unique constraints or configured `referenceAnchors`).
- **Foreign key mapping** — foreign keys in roots and children (e.g., `"roomId": 7`) use source IDs. The importer maps these to target IDs: for references via anchor resolution, for parent-child via the `_targetId` tracking map.

### Key Design Decisions

- **`exportedFrom`** — set from `process.env.appUrl`, falling back to `os.hostname()`. Identifies which environment produced the export so consumers know where the data came from.
- **Raw objects** — each entry at `objects.<Type>.<id>` is the plain object with scalar properties, embedded objects, and foreign keys. No `role`, `properties`, `references`, or `children` wrappers. The schema is known on both sides, so the importer can classify fields by inspecting the schema.
- **Nested by type then ID** — `objects.TutoringSession.42` instead of a flat `objects["TutoringSession:42"]`. This normalizes the structure by entity type, makes it easy to iterate all objects of a given type, and avoids encoding conventions in string keys.
- **Foreign keys as implicit references** — reference relationships are expressed through their foreign key values (e.g., `"roomId": 7`). The source ID `7` maps to `objects.Room["7"]`, which contains the anchor properties for resolving the reference in the target database. No separate ref pointer syntax is needed.
- **`roots` map** — always a map of entity name to source ID arrays (e.g., `{ "TutoringSession": ["42"] }`). This unified format works for all export levels — single instance, `exportMany`, and `bulkExport` — so the importer only handles one structure.
- **Flat normalized map** — all objects live in the `objects` map keyed by type then ID. Parent-child relationships are inferred from the schema and foreign keys. This keeps the structure simple and avoids deep nesting.

### ID Type Handling

The nested key format works with any ID type:

| ID Type | Example Path | Ref Pointer |
|---|---|---|
| `number` | `objects.Room["7"]` | `Room.7` |
| `Uuid` | `objects.TestSetting["a1b2c3d4-..."]` | `TestSetting.a1b2c3d4-...` |
| `string` | `objects.Tenant["acme-corp"]` | `Tenant.acme-corp` |

## Import Logic

The [import](export-import.import.app-behavior.ts) app behavior is exposed as `POST /api/import`. It accepts the JSON export document as the request body and an optional `dryRun` query parameter. The import uses an iterative multi-pass approach to resolve references and create objects, controlled by a `_targetId` field that tracks what has been resolved.

### Iterative Resolution

Rather than requiring a strict ordering of operations, the import iterates in passes until all items are processed. Each item in the `objects` map is tracked with an internal `_targetId` (initially null) that records the real database ID once the item is resolved or created.

1. **Initialize** — parse the file. For every entry across all types in `objects`, set `_targetId: null`.
2. **Pass** — iterate over all items where `_targetId` is null. For each item, check whether all of its foreign keys (as determined by the schema) point to items that already have a `_targetId`. If they do, the item is ready to process:
   - **References** — build a `where` clause from the anchor properties (unique constraints or configured `referenceAnchors`), substituting any foreign keys with their already-resolved `_targetId` values. Query the database with `Model.findOne({ where })`. If found, record the database ID as `_targetId`. If not found, throw an error.
   - **Roots** — check for an existing root using anchor logic. If found, update its properties; if not, create it. Record the database ID as `_targetId`.
   - **Children** — look up the parent's `_targetId` to set the parent foreign key. Resolve any reference foreign keys from the `_targetId` map. Create or match/update against existing children in the database. Record the database ID as `_targetId`.
   - If any foreign key points to an item whose `_targetId` is still null, skip this item — it will be retried on the next pass.
3. **Repeat** until all items have a `_targetId`, a pass makes no progress, or 100 passes have been executed. If the limit is reached or a pass completes with no new resolutions and unresolved items remain, throw an error listing them.

### Child Synchronization

When importing roots (whether new or existing), children are synchronized:

- **Add** — children present in the file but not in the database are created.
- **Update** — children present in both are updated with the file's property values.
- **Remove** — children present in the database but not in the file are deleted.

Matching existing children to file entries uses the same anchor logic as references: unique constraints or natural keys. If a child has no unique constraint, fall back to matching on all non-null scalar properties (excluding `id` and foreign keys).

### Dry Run

When `dryRun=true` is passed as a query parameter, the import runs the full resolution and validation logic inside a transaction, then rolls back instead of committing. The response includes a summary of what would happen: roots to create/update, children to add/update/remove, and resolved references. This lets users preview the import without modifying data.

### Transaction Safety

The entire import runs inside a database transaction. If any step fails (missing reference, validation error, constraint violation), the transaction rolls back and no partial data is created or modified.

## Configuration

The mixin accepts configuration when applied:

```typescript
export interface ExportImportConfig {
  /** Properties to exclude from export (e.g., computed or sensitive fields). */
  excludeProperties?: string[];

  /**
   * Relationship names to exclude from export and import.
   * For child relationships (has-many, has-one), the entire subtree is skipped
   * on export and ignored during child synchronization on import.
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

  /**
   * Roles allowed to use the export and import behaviors.
   * When not specified, the default roles for behaviors apply.
   */
  roles?: string[];
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

## Prerequisites

### System Request Context (auth module)

The auth module needs to provide a `SystemRequestContext` that marks a request as preauthorized, causing the auth middleware to skip per-object role checks. The import wraps its internal operations (creating children, updating roots, resolving references) in this context so they are not constrained by the current user's roles. The `roles` config on the mixin controls who can call the export/import endpoints; `SystemRequestContext` covers everything that happens inside.

### Import Context

The import wraps its entire operation in an `ImportContext` with a single `isImporting: boolean` flag, managed via `AsyncLocalStorage`. Individual Before/After Create and Before/After Update behaviors can check this flag to decide whether to skip (e.g., sending notification emails, triggering workflows). The import does not globally suppress event handlers — each behavior owns its own skip logic.

