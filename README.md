# Sproutworks

A local morning dashboard that turns a senior product leader's LinkedIn network into a daily lead list. It checks the public job boards of companies where first-degree connections work, surfaces senior product roles alongside the people the user knows there, tracks applications through interviews, and pairs it all with health tech and AI news in a sweep that takes under 10 minutes.

## Run it on your computer

You need git and Node 26 (`nvm install 26` if you use nvm).

1. **Get the code and install:**
   ```
   git clone https://github.com/liana/sproutworks.git && cd sproutworks
   nvm use && npm install
   ```
2. **Add your settings:** copy the example file, then open `.env.local` and set `SPROUT_CONTACT_EMAIL` (job boards see it in the User-Agent) and `ANTHROPIC_API_KEY` (from console.anthropic.com; used only by **Check fit** and **Cover letter**, capped at $3 a week).
   ```
   cp .env.example .env.local
   ```
3. **Create the database and start the app:**
   ```
   npx prisma migrate deploy
   npm run dev
   ```
   Open http://127.0.0.1:3000.
4. **Load your LinkedIn data:** on **Admin**, click **Request new export** (or go to https://www.linkedin.com/mypreferences/d/download-my-data) and choose **Download larger data archive**. When LinkedIn emails you the ZIP (within 1–2 days; the link expires after 72 hours), upload it with **Import archive**.
5. **Confirm your job boards:** still on Admin, confirm each match under **Board links to confirm**. Then open **Today**.

From then on, run `npm run dev` and open Today each morning. The job-board check runs once a day on its own.

6. **Tune the AI once (optional, a few cents):** with the app running, `npm run eval` runs the fit check and a cover letter on three sample jobs and prints pass or fail. Try other models with `SPROUT_FIT_MODEL` or `SPROUT_LETTER_MODEL` in `.env.local`, and note what you keep in `DECISIONS.md`. The eval adds sample jobs to Today; exclude them afterward.

**Try it with invented data first:** run `SPROUT_FIXTURE_BOARDS=1 SPROUT_FAKE_AI=1 npm run dev` (`SPROUT_FAKE_AI=1` uses a stand-in model, so no key is needed), then `npm run seed:fixtures` in a second terminal. Nothing leaves your machine. Before your real import, delete `prisma/sproutworks.db` and run `npx prisma migrate deploy` again.

> Built so far: Today (horoscope, fit check, cover letters, + Add a job), Industry, Pipeline, and Admin. Watchlist and Metrics come in the last slice. The clickable design prototype for every page is at `design/mockups/today.html`.

## Why it's built this way

- **LinkedIn is never touched.** Connections and profile come only from LinkedIn's official data export, uploaded by the user. No scraping, no automation, no unofficial APIs.
- **Leads are deterministic.** Jobs come from the public Greenhouse, Lever, and Ashby APIs and from RSS feeds whose terms allow reading. Company matching, filters, warm-intro tiers, and the "show again only on a new role" rule are plain code.
- **AI is on demand, and there are only two uses.** A fit check and a cover letter, both user-triggered and schema-validated. Quotes are verified against the job description, and spend is capped at $3.00 per rolling week.
- **Nothing stale.** Feeds with no new items in 30 days are refused or flagged. Link-only sources get a 30-day "still useful?" check.
- **Polite by design.** One request at a time per host, each board fetched at most once a day, and a hard request ceiling per run.
- **Local-first.** One SQLite file, localhost only, with backups before every write-heavy step.

## Pages

**Today** (new leads, recent job changes, funding news at companies you know) · **Industry** (AI, digital health, Market Pulse) · **Watchlist** (companies whose careers pages can't be read) · **Pipeline** (Applied → Interviewing → Closed / Won) · **Metrics** (applications, interview rate, jobs won, then app health) · **Admin** (LinkedIn data, sources, board links, backups)

## Known limits

- Companies on Workday or custom career sites can't be read, so they go on the Watchlist.
- Fractional and advisory roles are rarely posted publicly, so expect that lane to be thin.
- Several news and job sites are link-only because of bot protection or their terms.

## Docs

`docs/PRD.md` (what and why) · `docs/build-plan.md` (decisions) · `docs/tech-stack.md` · `docs/ai-guidelines.md` · `design/mockups/` (clickable prototype)
