# Sproutworks

Single-user, local-first morning dashboard: warm job leads at companies where 1st-degree connections work, industry news, Market Pulse, and a horoscope. The daily sweep fits in under 10 minutes.

## Status

Phases 1–4 done. Phase 5 in progress: slice 1 (core loop).

## Where things live

- `docs/build-plan.md`: the approved design and execution sequence. Read it before changing anything.
- `docs/PRD.md`: product requirements.
- `docs/tech-stack.md`, `docs/ai-guidelines.md`: stack and AI rules.
- `design/mockups/`: clickable prototype; the UI is built from it.

## Hard rules

- Nothing may put the user's LinkedIn account at risk. No scraping, no browser automation, no unofficial APIs, and nothing is ever fetched from linkedin.com. LinkedIn data comes only from the user's official data export.
- No file in this repo (code, comments, fixtures, docs, commit messages) names the user's employer or where the app was developed. Fixtures use invented companies and people.
- Personal data (exports, the database, the API key) stays out of git. See `.gitignore`.
- AI is used only for the on-demand fit check and cover letter. Everything else is deterministic code.
- Phase 5 is built in slices (see `docs/build-plan.md`). The user approves a whole slice up front. Build it end to end (code, tests, working UI), then the user reviews the running result. Anything outside the approved slice still needs its own approval.
