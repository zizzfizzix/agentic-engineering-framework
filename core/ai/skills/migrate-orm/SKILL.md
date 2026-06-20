---
name: migrate-orm
description: Migrate and evolve the data layer for the project's configured ORM. Use when adding or changing entities and relations, generating or applying migrations, or fixing ORM-specific type and query errors.
---

# Migrate / evolve the data layer

This skill is ORM-agnostic. The concrete commands and idioms below are rendered for the ORM
configured in `aef.config.json` (`orm`). If no ORM is configured this skill is not
installed at all.

## When to use

- Adding or changing entities and their relations.
- Generating and applying schema migrations.
- Fixing ORM-specific type errors or query issues.

## Cheatsheet (active ORM)

<!-- SLOT:orm.cheatsheet -->

_(Filled at render time with the active ORM's entity/query cheatsheet.)_

<!-- /SLOT:orm.cheatsheet -->

## Migration workflow (active ORM)

<!-- SLOT:orm.migration -->

_(Filled at render time with the active ORM's migration commands.)_

<!-- /SLOT:orm.migration -->

## Generic rules (always apply)

- Never hand-edit generated migration files — change the schema and regenerate.
- Keep one logical schema change per migration.
- Review the SQL diff before applying to any shared environment.
- Run the project's verification gate (`validation` in `aef.config.json`) after migrating.
