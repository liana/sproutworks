# Sproutworks

Single-user, local-first morning dashboard: warm job leads at companies where 1st-degree connections work, industry news, and Market Pulse. The daily sweep fits in under 10 minutes.

## Status

Phases 1–4 done. Phase 5 in progress: slice 1 (core loop).

## Where things live

- `docs/build-plan.md`: the approved design and execution sequence. Read it before changing anything.
- `docs/PRD.md`: product requirements.
- `docs/tech-stack.md`, `docs/ai-guidelines.md`: stack and AI rules.
- `design/mockups/`: clickable prototype; the UI is built from it.

## Commands

- `npm run dev` (127.0.0.1:3000) · `npm test` · `npm run lint` · `npx tsc --noEmit`
- `SPROUT_FIXTURE_BOARDS=1 npm run dev` + `npm run seed:fixtures`: invented data, no network
- After schema changes: `npx prisma migrate dev --name <change>` then `npx prisma generate`, and restart the dev server

## Code layout

- Pure logic with tests (relative `.ts` imports, no DB): `src/services/linkedin`, `companies`, `leads`, `boards`, `src/lib/fetch`
- DB services: `src/services/*.ts` · routes: `src/app/api` (Zod contracts in `src/contracts`) · pages: `src/app` · client UI: `src/components` (API calls only via `src/hooks/api.ts`)
- Rules and limits: `src/config`

## Hard rules

- Nothing may put the user's LinkedIn account at risk. No scraping, no browser automation, no unofficial APIs, and nothing is ever fetched from linkedin.com. LinkedIn data comes only from the user's official data export.
- No file in this repo (code, comments, fixtures, docs, commit messages) names the user's employer or where the app was developed. Fixtures use invented companies and people.
- Personal data (exports, the database, the API key) stays out of git. See `.gitignore`.
- AI is used only for the on-demand fit check and cover letter. Everything else is deterministic code.
- Phase 5 is built in slices (see `docs/build-plan.md`). The user approves a whole slice up front. Build it end to end (code, tests, working UI), then the user reviews the running result. Anything outside the approved slice still needs its own approval.
