**Drizzle migrations** use `drizzle-kit`:

```bash
npx drizzle-kit generate   # diff schema -> SQL migration in ./drizzle
npx drizzle-kit migrate    # apply pending migrations
```

- Configure `drizzle.config.ts` with `schema`, `out`, and `dialect`.
- Commit the generated SQL files; never hand-edit them — change the schema and regenerate.
- For a destructive change, generate, inspect the SQL, then apply.
