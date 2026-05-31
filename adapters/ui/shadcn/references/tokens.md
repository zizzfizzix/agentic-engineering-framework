**shadcn/ui** uses Tailwind CSS variables as semantic tokens:

| Token | Use for |
|-------|---------|
| `bg-background` / `text-foreground` | base surface + text |
| `bg-muted` / `text-muted-foreground` | secondary surfaces |
| `bg-destructive` | error/danger actions |
| `border-border` | dividers and outlines |

Never use raw Tailwind palette classes (`bg-red-500`); map to a semantic token instead.
