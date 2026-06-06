**Drizzle** — schema is plain TypeScript under `src/db/schema/`.

```ts
import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

- Relations: declare with `relations(users, ({ many }) => ({ ... }))`.
- Queries: `db.select().from(users).where(eq(users.email, x))` or the `db.query.users.findMany`
  relational API.
- Types flow from the schema — no decorators, no separate entity classes.
