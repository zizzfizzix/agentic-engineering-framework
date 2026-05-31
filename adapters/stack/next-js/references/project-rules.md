## Project review rules

- **Server Components by default.** Add `"use client"` only for components that need state,
  effects, or browser APIs — and keep them as leaves of the tree.
- Fetch data on the server; never ship secrets or server-only env vars into a Client Component.
- Use `next/image`, `next/link`, and `next/font` instead of raw `<img>`/`<a>`/font tags.
- Route handlers (`app/**/route.ts`) validate input and return typed responses.
- Keep `app/` thin — push domain logic into modules/packages, import it into routes.
- In a monorepo, respect package boundaries: import via public entrypoints, not deep paths.
