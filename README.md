# Sproutworks

A local morning dashboard that turns a senior product leader's LinkedIn network into a daily lead list. It checks the public job boards of companies where first-degree connections work, surfaces senior product roles alongside the people the user knows there, tracks applications through interviews, and pairs it all with health tech and AI news in a sweep that takes under 10 minutes.

## Why it's built this way

- **LinkedIn is never touched.** Connections and profile come only from LinkedIn's official data export, uploaded by the user. No scraping, no automation, no unofficial APIs.
- **Leads are deterministic.** Jobs come from the public Greenhouse, Lever, and Ashby APIs and from RSS feeds whose terms allow reading. Company matching, filters, warm-intro tiers, and the "show again only on a new role" rule are plain code.
- **AI is on demand, and there are only two uses.** A fit check and a cover letter, both user-triggered and schema-validated. Quotes are verified against the job description, and spend is capped at $3.00 per rolling week.
- **Nothing stale.** Feeds with no new items in 30 days are refused or flagged. Link-only sources get a 30-day "still useful?" check.
- **Polite by design.** One request at a time per host, each board fetched at most once a day, and a hard request ceiling per run.
- **Local-first.** One SQLite file, localhost only, with backups before every write-heavy step.

## Pages

**Today** (new leads, recent job changes, funding news at companies you know) · **Industry** (AI, digital health, Market Pulse) · **Watchlist** (companies whose careers pages can't be read) · **Pipeline** (Applied → Interviewing → Closed / Won) · **Metrics** (applications, interview rate, jobs won, then app health) · **Admin** (LinkedIn data, sources, board links, backups)

## Setup

> Slice 1 (Today, Pipeline, Admin) is built. Industry, Watchlist, Metrics, fit check, and cover letters come in later slices.

```
git clone https://github.com/liana/sproutworks.git && cd sproutworks
nvm use && npm install
cp .env.example .env.local     # add ANTHROPIC_API_KEY and SPROUT_CONTACT_EMAIL
npx prisma migrate deploy
npm run dev                    # http://127.0.0.1:3000
```

Then on Admin, use **Request new export** to request your archive from LinkedIn, and upload the ZIP with **Import archive**.

**Try it without real data:** start with `SPROUT_FIXTURE_BOARDS=1 npm run dev`, then run `npm run seed:fixtures` in a second terminal. That imports an invented LinkedIn archive and serves recorded job-board responses, so nothing leaves your machine. Use a fresh database before your real import: delete `prisma/sproutworks.db` and run `npx prisma migrate deploy` again.

The full clickable design prototype is at `design/mockups/today.html`.

## Known limits

- Companies on Workday or custom career sites can't be read, so they go on the Watchlist.
- Fractional and advisory roles are rarely posted publicly, so expect that lane to be thin.
- Several news and job sites are link-only because of bot protection or their terms.

## Docs

`docs/PRD.md` (what and why) · `docs/build-plan.md` (decisions) · `docs/tech-stack.md` · `docs/ai-guidelines.md` · `design/mockups/` (clickable prototype)
