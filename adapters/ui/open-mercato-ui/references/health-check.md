## Health check (active design system)

**@open-mercato/ui** ships a DS health check:

```bash
.ai/scripts/ds-health-check.sh        # report hardcoded colors / arbitrary typography
.ai/scripts/ds-migrate-colors.sh      # codemod raw colors -> semantic tokens
```

Run the health check before opening a UI PR; fix every flagged violation.
