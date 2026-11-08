# Tech Stack

**Runtime:** Node 26 LTS, pinned in `.nvmrc` and `engines`. The dev server binds to 127.0.0.1 only.

## Core

| Package | Version | Why |
|---|---|---|
| Next.js (App Router) | 16.4 | One app serves both pages and API routes |
| React | 19.3 | Comes with Next |
| Tailwind CSS | 4.3 | Utility styling, with design tokens in `globals.css` |
| Prisma + `@prisma/adapter-libsql` | 7.10 (stable) | npm's "latest" tag currently points at a Prisma 8 release candidate, so pin 7.10 explicitly |
| SQLite (`@libsql/client`) | 0.18 | Local-first: one file, nothing to host |
| Zod | 4.6 | API route validation and AI output schemas |
| `@anthropic-ai/sdk` | 1.6 | Fit check and cover letter. Imported only in `src/lib/ai/` |

## Small helpers

Each one replaces code that's easy to get wrong.

| Package | Why not hand-written |
|---|---|
| `fast-xml-parser` 5.12 | RSS and Atom feeds vary a lot |
| `jszip` 3.10 | Node has no built-in ZIP reader, and the LinkedIn export arrives as a ZIP |
| `papaparse` 5.7 | LinkedIn's `Connections.csv` starts with notes lines before the header row, and quoted commas in titles break naive parsing |

## Deliberately not added

- **Concurrency library:** the per-host limiter is about 40 lines of our own code, and its rules are specific to this app.
- **Test framework:** Node's built-in `node --test` runs TypeScript directly.
- **Date library, state management, component library:** not needed.

## Structure

```
src/app/            pages: today, industry, watchlist, metrics, admin
src/app/api/        routes; Zod validation is the contract
src/components/     display only (ESLint blocks fetch, Prisma, and SDK imports)
src/services/       leads engine, import, refresh, board resolver, pulse rules
src/lib/db.ts       one Prisma client, cached on globalThis in dev
src/lib/ai/         the only importer of @anthropic-ai/sdk
src/lib/fetch/      polite fetcher (per-host limits, retries, conditional GET)
src/config/         source types, filters, tiers, pulse rules, models, kpis, fetch, backup
prisma/             schema and forward-only migrations
test/fixtures/      invented companies and people, recorded ATS responses
```

## Conventions

- Each service exports plain functions, not classes.
- Routes are thin: parse, call a service, return.
- Every business rule (filters, tiers, caps, budgets) lives in `src/config`.
- Migrations are forward-only and never edited.
- `.env.example` lists `ANTHROPIC_API_KEY`, `SPROUT_CONTACT_EMAIL`, and the model overrides, all with placeholder values.

## Commands

`npm run dev` · `npm test` · `npm run lint` · `npm run refresh` · `npm run eval` · `npm run restore -- <file>`
