**MikroORM** — entities are decorated classes under `src/entities/`.

```ts
import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity()
export class User {
  @PrimaryKey() id!: string
  @Property() @Unique() email!: string
  @Property() createdAt: Date = new Date()
}
```

- Relations: `@ManyToOne`, `@OneToMany`, `@ManyToMany` decorators.
- Queries: `em.find(User, { email })`; always use a forked `EntityManager` for fresh reads to
  avoid identity-map stale snapshots.
- Prefer `em.persistAndFlush` / `em.removeAndFlush` (v6) or repository equivalents.
