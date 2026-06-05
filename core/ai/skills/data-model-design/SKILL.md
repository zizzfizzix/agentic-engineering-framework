---
name: data-model-design
description: Design entities, relationships, and fields, and plan how the data model evolves. Use when planning a data model, designing an entity, choosing field types, picking a relationship pattern, modeling cross-boundary references, or deciding when to reach for JSONB. Triggers on "design entity", "data model", "add entity", "database schema", "relationship", "many-to-many", "junction table", "foreign key", "jsonb", "add column".
---

# Data Model Design

Design entities, their fields, and the relationships between them. This skill is about the
**design decisions** — what to store, how to type it, and how things relate. It is ORM-agnostic:
the concrete entity/query syntax for the project's configured ORM is injected below, and the
mechanics of generating and applying migrations belong to the `migrate-orm` skill.

## When to use

- Planning a new data model or adding a new entity.
- Choosing field types, deciding nullability, or picking enum vs. free text vs. JSONB.
- Selecting a relationship pattern (1:1, 1:N, N:M, self-referencing).
- Modeling a reference that crosses a module / service boundary.

## 1. Design workflow

When a developer describes data requirements, work through it in order:

1. **Identify entities** — what are the distinct "things" being stored? Each becomes a table.
2. **Identify fields** — what data does each entity hold? What is required vs. optional?
3. **Identify relationships** — how do entities relate (1:1, 1:N, N:M)? Do any references cross a
   module or service boundary?
4. **Choose patterns** — pick the right field type and relationship pattern for each (sections 3–5).
5. **Implement** — write the entity definitions and a migration (see `migrate-orm`).
6. **Verify** — review the generated schema/migration and test representative queries.

Resolve the model on paper (or in discussion) before writing code. A wrong relationship or a
column that should have been a separate table is far cheaper to fix before the first migration.

## 2. Entity design

Treat each entity as one cohesive concept. Most entities share a common spine of columns; agree on
this spine once for the project and apply it consistently.

**Identity.** Every entity needs a primary key. A surrogate key (UUID or auto-increment integer)
is the safe default; UUIDs are convenient when ids must be generated client-side or merged across
systems. Prefer a stable surrogate key over a "natural" key (email, slug) that may change.

**Timestamps.** `created_at` and `updated_at` (set on every write) are worth having on almost every
entity for debugging and auditing.

**Soft delete.** If records must be recoverable or referenced after removal, add a nullable
`deleted_at` (and/or an `is_active` flag) instead of hard-deleting. Every query must then filter
out soft-deleted rows — make this the default in your data-access layer so it cannot be forgotten.

**Tenant scope.** If the project is multi-tenant, every tenant-scoped entity includes the
tenant-scope column(s) (e.g. `tenant_id`, and/or `organization_id`/`workspace_id` — whatever the
project's scoping model is), those columns are indexed, and **every query filters by them**. A
missing scope filter is a cross-tenant data leak, so enforce it centrally rather than per query.

Keep the columns that are truly part of the domain distinct from this infrastructural spine.

## 3. Field types

Pick the narrowest type that faithfully represents the data. General guidance:

| Data                                             | Use                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Short text (name, title)                         | A length-bounded string (e.g. `varchar(255)`). Always set a length.  |
| Long / unbounded text (description, notes, body) | A `text` type.                                                       |
| Integer counts / quantities                      | An integer type.                                                     |
| Money / exact decimals                           | A fixed-precision `decimal`/`numeric` (never floating point).        |
| Boolean flags                                    | A boolean with an explicit default.                                  |
| Identifiers / foreign keys                       | The same type as the referenced primary key (e.g. `uuid`). Index it. |
| Date only                                        | A `date` type.                                                       |
| Date + time                                      | A timezone-aware timestamp (e.g. `timestamptz`).                     |
| Bounded set of states                            | An enum (see below).                                                 |
| Flexible / nested / schema-less data             | `jsonb` (see below).                                                 |
| Email                                            | A length-bounded string (~320 chars).                                |
| URL                                              | `text` (URLs can be long).                                           |

**Avoid floating point for money.** Use a fixed-precision decimal or store minor units as integers.

**Always bound your strings.** Unbounded `varchar` behaves differently across databases; pick an
explicit length so the schema is portable and intent is clear.

### Enums vs. free text

When a column holds a small, known, closed set of values (status, kind, role), model it as an enum
(or a string column validated against a fixed set in the application). Enums document the valid
values, prevent typos, and make state machines explicit:

```
OrderStatus = draft | pending | confirmed | shipped | delivered | cancelled
```

If the set of values is open-ended or user-defined, use a plain string (or a lookup table) instead
of an enum so you are not migrating the schema every time a new value appears.

### Nullable vs. required

Make a field **required** (non-null) when a row is meaningless without it — and give it a value at
creation time. Make it **nullable** when "not yet known" or "not applicable" is a legitimate state,
and use a `null` default. Do not use sentinel values (empty string, `0`, `1970-01-01`) to fake
"absent"; they corrupt aggregates and hide bugs. When you make a previously-required column
nullable, decide what existing rows should hold.

### When to use JSONB

`jsonb` is the right tool for genuinely flexible data. Use it when:

- The schema is flexible or user-defined (custom field values, metadata, tags, settings).
- The data is read and written **as a whole**, not queried by its individual inner fields.
- Nesting is natural (an address object, a configuration map, a snapshot blob).

Avoid `jsonb` when:

- You need to filter, sort, join, or aggregate by an inner field — promote it to a real column.
- The data has a fixed, well-known shape — columns give you type safety and constraints.
- You need referential integrity — a foreign key cannot point into a JSONB blob.

Even for JSONB, validate the shape in the application (e.g. a schema/validator) rather than typing
it as "anything"; derive the static type from that schema instead of duplicating it by hand.

## 4. Relationship patterns

These are conceptual patterns. The concrete syntax for expressing them in the project's ORM is in
the cheatsheet section below.

### One-to-many

One parent row owns many child rows. The child holds a foreign-key column pointing at the parent's
primary key; the parent "has many" children. Example: a `Category` has many `Product` rows; each
`Product` carries a `category_id`. Index the foreign-key column.

### Many-to-many (junction table)

Two entities relate to many of each other. Model this with a **junction (join/pivot) table** whose
rows pair one id from each side — e.g. a `product_tags` table with `product_id` and `tag_id`.

Junction-table rules:

- Index both foreign-key columns (a unique composite index on the pair prevents duplicates).
- If the project is multi-tenant, carry the tenant-scope column(s) on the junction table too.
- A `created_at` is useful for auditing when the link was made.
- If the relationship itself has attributes (a `quantity`, a `sort_order`, a `role`), add them as
  columns on the junction table — it is a first-class entity at that point.

### One-to-one

One row pairs with at most one row in another table — typically used to split rarely-used or
sensitive columns off a hot table, or to extend an entity. Put a foreign key on one side with a
**unique** constraint so the one-to-one invariant is enforced by the database.

### Self-referencing (tree / hierarchy)

An entity references other rows of the same entity — categories with parent categories, comment
threads, org charts. Add a nullable `parent_id` pointing at the same table (null = root).

For read-heavy trees, denormalize to make queries cheap: store a materialized `path`
(e.g. `/root-id/parent-id/this-id`) and/or a `depth`, so you can fetch a whole subtree or breadcrumb
without recursive queries. Keep the denormalized fields in sync when the tree is reshaped.

### Polymorphic references

When one entity can point at rows of **different** types (a `Comment` attached to an order, a
ticket, or a document), store a `target_type` (a discriminator string) alongside a `target_id`.
This trades database-level referential integrity for flexibility — the application must enforce
that `(target_type, target_id)` resolves to a real row. Reach for it only when a fixed set of
explicit relations would be unwieldy.

### Ordered collections

When items within a collection have a user-defined order, store an explicit `sort_order` integer
rather than relying on insertion order or timestamps. Decide a reordering strategy (renumber on
move, or use sparse/fractional indices to avoid rewriting every row on each reorder).

## 5. Cross-boundary references

**Rule: do not create ORM-level relations across a module or service boundary.** Within a single
module/service, native ORM relations (parent/child associations) are fine and convenient. But when
the referenced entity is owned by a _different_ module or service, reference it **by id only** — a
plain foreign-key-style column holding the other entity's id, with no ORM association object — and
**fetch the related data explicitly** when you need it.

```
# Same module: an ORM relation is fine.
Product  ──relation──▶  Category        (both owned here)

# Across a boundary: store the id, no ORM relation.
Ticket.customer_id : uuid   # owned by the customers module — just an id column
Ticket.assigned_to : uuid?  # owned by the auth module — just an id column
```

To display data that lives behind the boundary, fetch it deliberately: collect the referenced ids
from your rows, ask the owning module/service for those records (via its API/query), and stitch the
results together in memory. Do not reach across the boundary with a join.

Why reference by id instead of an ORM relation across boundaries:

1. **Isolation** — each module/service owns its own entities and can evolve or be deployed
   independently; cross-boundary relations couple their schemas.
2. **No circular coupling** — bidirectional ORM relations between modules create import/dependency
   cycles that are painful to untangle.
3. **Clear ownership** — exactly one side owns each entity; a foreign id is a reference, not joint
   ownership of someone else's table.
4. **Stable contracts** — the boundary is an explicit API (ids in, records out), so the owning side
   can refactor its internal schema without breaking consumers.

## 6. Migration lifecycle (overview)

Schema changes ship as migrations. The concrete commands for generating, reviewing, and applying
migrations — and the ORM-specific workflow — live in the **`migrate-orm` skill**; defer to it for
the mechanics. The design-level rules that always apply:

- **One logical change per migration.** Keep migrations small and reviewable.
- **Review before applying.** Auto-generated does not mean correct — read the SQL diff, and watch
  for unrelated changes the generator may have picked up.
- **Additive changes are safe; destructive ones are staged.** New columns should be nullable or
  carry a default so existing rows stay valid.
- **Never rename or drop in one step.** To rename: add the new column, backfill, switch readers and
  writers, then drop the old column in a _later_ release. To remove: stop writing it, make it
  nullable, then drop it later. This keeps deploys backward-compatible.
- **Don't destroy data casually.** Prefer soft delete / archive over dropping tables.

## ORM cheatsheet (active ORM)

<!-- SLOT:orm.cheatsheet -->
<!-- /SLOT:orm.cheatsheet -->

## Anti-patterns

| Anti-pattern                                                                          | Problem                                          | Instead                                                               |
| ------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| ORM relation across a module/service boundary                                         | Tight coupling, circular deps, blurred ownership | Store the id, fetch related data explicitly (section 5)               |
| Storing computed/derived values as columns                                            | Goes stale, extra maintenance                    | Compute on read, or treat as a cache you deliberately invalidate      |
| Typing a JSONB field as "anything"                                                    | No validation, silent corruption                 | Validate against a schema and derive the static type from it          |
| Filtering/sorting by a field buried in JSONB                                          | Slow, unindexable                                | Promote it to a real column                                           |
| Floating point for money                                                              | Rounding errors                                  | Fixed-precision decimal, or integer minor units                       |
| `varchar` with no length                                                              | Behaviour varies by database                     | Always set an explicit length                                         |
| Arrays stored as comma-separated strings                                              | Can't query or constrain                         | A JSONB array, or a junction table                                    |
| Foreign-key column with no index                                                      | Slow lookups and joins                           | Index every foreign-key column                                        |
| Missing tenant-scope filter on a query                                                | Cross-tenant data leak                           | Filter by tenant scope on every query; enforce centrally              |
| Nullable when the row is meaningless without it (or required when "unknown" is valid) | Integrity bugs                                   | Required for must-have fields, nullable + `null` default for optional |
| Sentinel values (`""`, `0`, epoch) for "absent"                                       | Corrupts aggregates, hides bugs                  | Use `null` and a nullable column                                      |
| Renaming/dropping a column in one release                                             | Breaks in-flight deploys and existing data       | Add → backfill → switch → drop across releases                        |
| Enum for an open-ended value set                                                      | Schema migration on every new value              | Plain string or lookup table                                          |

## Rules

- **MUST** give every entity a stable primary key (a surrogate key by default).
- **MUST** index every foreign-key column, and every tenant-scope column.
- **MUST**, if the project is multi-tenant, include the tenant-scope column(s) on every
  tenant-scoped entity (including junction tables) and filter by them in every query.
- **MUST** set an explicit length on bounded string columns.
- **MUST** use a fixed-precision decimal (or integer minor units) for money — never floating point.
- **MUST** use `null` + a nullable column for optional/"unknown" data — never a sentinel value.
- **MUST NOT** create ORM relations across a module/service boundary — reference by id and fetch
  related data explicitly.
- **MUST NOT** rename or drop a column in a single release — stage it across releases.
- **MUST** keep one logical change per migration and review the diff before applying (see
  `migrate-orm`).
- Use a junction table for many-to-many relationships.
- Use `jsonb` for flexible/nested data read as a whole; use real columns for anything you query,
  sort, join, or constrain.
- Derive static types from a validation schema; never hand-duplicate type definitions.
