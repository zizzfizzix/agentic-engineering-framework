**MikroORM migrations** use the CLI:

```bash
npx mikro-orm migration:create    # diff metadata -> migration class
npx mikro-orm migration:up        # apply pending migrations
```

- Migrations are TypeScript classes under the configured `migrations.path`.
- Commit the generated class + the updated schema snapshot; do not hand-edit applied migrations.
- Review the generated `up()` SQL before applying to shared environments.
