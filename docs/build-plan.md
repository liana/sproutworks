# Sproutworks: daily career-intelligence dashboard

## Context
Sproutworks is a single-user morning dashboard for a senior product leader. It does three jobs: surface warm leads (senior PM roles, full-time and fractional/advisory, at companies where 1st-degree connections work), show AI, digital-health, and Market Pulse news, and add a horoscope. The daily sweep has to fit in under 10 minutes.

Content rule: no repo file (code, comments, fixtures, CLAUDE.md, PRD, README, DECISIONS, commit messages) mentions the user's employer or where it was developed. Fixtures use invented companies and people.

Hard constraint: nothing may put the user's LinkedIn account at risk. No scraping, no browser automation, no unofficial APIs, and nothing ever fetched from linkedin.com.

Repo: `~/Claude/Sproutworks` (branch `main`, no commits yet). Pushed to a private `liana/sproutworks` and run locally with personal accounts. Development uses synthetic fixtures only. The real export, leads, and API key live only on the machine that runs the app.

## Data in
- **LinkedIn data export (the only LinkedIn source):** `Connections.csv` for leads. `Profile.csv`, `Positions.csv`, `Skills.csv`, and `Education.csv` build the user's profile for the fit check, which judges what recruiters see on LinkedIn. Connection email addresses are dropped at import and never stored.
- **Jobs:** the public, keyless Greenhouse, Lever, and Ashby job-board APIs, per company. Plus VentureFizz `sitemap.rss`.
  - VentureFizz rules: feed only, no detail pages, robots.txt `Crawl-delay: 10`, personal use, company taken from the URL slug. Its ToS §4(f) bans crawling. The user accepted the gray area, and switching to `link-out` is a one-line change.
- **News and Market Pulse:** RSS feeds (AI, digital health, funding/launch).
- **Horoscope:** astrology.com and horoscope.com, each attributed. The section is omitted if neither source's terms permit automated reads. No fallback content.
- **Sources (managed on Admin, decided Nov 8):** two separate lists, **Industry news sources** and **Lead gen sources**, each with Add URL / Remove. Code in `src/config/source-types.ts` defines the supported adapter types (`ats-board`, `job-aggregator-rss`, `news-rss`, `horoscope`, `link-out`) and seeds the defaults. The source rows themselves live in the DB.
  - **Add URL flow (deterministic, one request at most per check):**
    1. Detect the type: a Greenhouse/Lever/Ashby board URL, a direct RSS/Atom feed, or a page advertising a feed through `<link rel="alternate">`.
    2. Check robots.txt.
    3. Show a preview ("RSS feed found · 20 items · robots.txt allows").
    4. **Freshness gate (decided Nov 8):** a feed whose newest item is older than `staleFeedDays` (config, default 30) is refused with "This feed hasn't posted since Aug 2021," never saved. A saved source that stops posting for `staleFeedDays` is flagged **Stale feed?** on Admin, with Remove.
    5. The user confirms "I've checked this site's terms allow automated reading," and the confirmation is stored with a date.
  - **Link-only freshness (decided Nov 8):** the app can't read link-only sites, so the user judges them. Admin shows **Last visited by you** (stamped on click). After 30 days since the source was added or last confirmed, Admin asks **Still useful?** with Keep or Remove. A link-only source the user hasn't clicked in 30 days is flagged **Unused for 30 days**. That saves the source as fetchable. Anything not detected, not confirmed, or disallowed by robots.txt saves as `link-out`.
  - linkedin.com URLs are rejected outright.
  - **Remove** keeps already-stored postings and articles but stops fetching. The display metadata (name, color, logo) comes from the site, and the user can edit it.
- **Health Tech Nerds (added Nov 8, both lists):**
  - News: beehiiv publication (`/p/{slug}` articles, HTN Daily Brief, Weekly Health Tech Reads). No feed at `/feed`. Phase 4 checks for a beehiiv RSS feed.
  - Jobs: `jobs.healthtechnerds.com`, client-rendered, provider not identified, no published feed or API.
  - Both default to `link-out` until Phase 4 finds an official feed. Undocumented JSON endpoints behind the board don't get reverse-engineered.

## Leads (zero AI)
- **Filters (config):**
  - PM title keywords.
  - Seniority: Senior PM, Group/Principal PM, Director, VP, Head of Product, CPO.
  - Location: Boston area + remote (US).
  - Title exclusions: Product Marketing Manager, Project Manager, Program Manager.
  - Type tag: full-time or fractional ("fractional", "advisor", "interim", "contract"). Caveat: most fractional work is never posted, so this lane will be thin.
- **Company matching:** names are normalized ("Acme", "Acme Inc." and "Acme Health (Acme)" become one company), and every raw name seen is kept as an alias of the company. The app guesses a board code and probes all three services. A hit is used right away, with no confirmation (user decision Nov 10), and read in the same morning check. A guess shorter than the full name ("atlas" for Atlas Health) counts only if the board's page title or job links show the full name. Automatic matches show **Matched automatically · Wrong company?** on their Today card; Wrong company closes their jobs and locks the company so the guess is never retried. Hand-set links are locked: re-probing never overwrites them. Only the stale-token flag can prompt the user to change one.
- **Can't check automatically:** companies whose careers page runs on Workday or a custom site.
- **Review is per company:** one **Reviewed** on the company card records the posting IDs open at that moment. The card returns only when a qualifying posting ID appears that isn't in that set, and the new job is highlighted "New since you reviewed."
- **Card contents:**
  - Every connection at the company is listed as a warm intro.
  - **Exclude company** stops fetching the company and hides it. It's undoable from Admin. The current employer is proposed as an exclusion on first run.
- **Order:** newest qualifying job first (the ATS posted date, else first-seen). Jobs inside a card are newest first.
- **Facts line (code-composed):**
  - Connection's title and seniority ("likely near the hiring manager" for product leaders at VP/Director/Head level).
  - Years connected.
  - Number of connections at the company.
  - Role type.
  - Recent Market Pulse event.
  - Posting age.
- **Job changes:** see Connection transitions.
- **Apply** opens the company's own posting.

## ATS adapter rules (verified against each provider's docs, Nov 8)
- **Greenhouse:** the daily fetch is `GET boards-api.greenhouse.io/v1/boards/{token}/jobs` without `content=true` (small payload; `updated_at`, title, location). On **Check fit**, fetch the single job (`/jobs/{id}`): it returns `content`, which is HTML-entity-encoded (decode, then strip to text), and `first_published`, which becomes the posted date. The list's `meta.total` must equal the jobs returned, or the fetch counts as partial.
- **Lever:** `api.lever.co/v0/postings/{site}?mode=json`. The docs don't state a default page size, so the adapter always paginates with `limit=100` and an increasing `skip` until a page comes back short. It uses `descriptionPlain` + `lists` for the job description and `salaryDescriptionPlain` for pay. There's no posted-date field, so ordering uses first-seen.
- **Ashby:** `api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true`. Returns all published postings, with `descriptionPlain` and `publishedAt` (the posted date). `workplaceType` feeds the location filter, `employmentType: Contract` tags the role fractional, and compensation goes in the facts line.
- **Closure safety:** a posting is only marked closed after a complete, successful fetch. A failed or partial fetch, or one returning less than 50% of the previous count, closes nothing that day and gets logged on Admin. A posting ID that reappears is the same posting, never a "new lead."
- Adapter tests use recorded fixture responses for each provider, including a two-page Lever case.

## Warm-intro tiers (decided Nov 8)
Title rules in config sort every connection on a card:
- **Tier 1 · Direct influence:** VP, Director, Head of, C-suite.
- **Tier 2 · Peer/adjacent:** Senior/Principal/Group PM, Product Designer, Engineering Manager.
- **Tier 3 · Insider:** everyone else.

The tier shows as a text label plus a colored dot, never color alone. People are ordered by tier, then most recently connected. The facts line shows "Connected 2 months ago" or "Connected 6 years ago" from `Connected On`.

## Connection transitions (decided Nov 8)
- Each import diffs every connection's company (and title) against the previous import and writes `ConnectionChange` rows: person, previous company and title, new company and title, the previous and current import dates.
- A new company goes straight into the board resolution queue.
- Today shows **Recently switched** (up to 5, dismissible, visible for 14 days after the import). Example: "Jane Doe: HubSpot → Toast · changed between your Oct 9 and Nov 8 imports." The export has no change date, so the app never claims one. The first import produces no changes.

## Board health (decided Nov 8)
- Each company board tracks `consecutiveEmptyOrMissingDays` (a 404 or an empty job array).
- At `staleBoardDays` (config, default 3) the board is flagged **Stale board token?** on Admin. It keeps being fetched and doesn't silently drop out.
- Admin actions: **Re-probe** (try a new code derived from the current name), **Set code by hand**, **Mark can't check automatically**, or **Dismiss** (the company really has no openings).
- Any successful non-empty fetch clears the counter.

## Manual job entry (decided Nov 8)
- An **Add a job** shortcut on Today opens a small form:
  - Company (autocomplete from companies in the connections DB; free text is allowed for companies where the user knows no one).
  - Title.
  - Link (optional).
  - Job description text (paste).
  - Where I found it, from a list in config (VentureFizz, Health Tech Nerds, Other).
- A link to a Greenhouse/Lever/Ashby posting is fetched through the public API and fills the fields automatically. Any other link is stored as-is, and the user pastes the text. linkedin.com links get stored, never fetched.
- Creates a `Posting` with `source: "manual"`. It shows on Today like any lead (with connections if any match, and marked "Added by you"), runs the same filters as a warning (not a block), and goes through the same Zod fit-check pipeline on **Check fit**.
- Slack communities are manual-paste only in v1. Reading them automatically would need each community's permission and a Slack app.

## Market Pulse, news, horoscope (zero AI)
- **Market Pulse:**
  - The headline is shown verbatim.
  - Rules in `src/config/pulse-rules.ts` tag the event type (funding / launch / leadership hire / expansion) and extract amount, round, and company. A failed extraction still shows the headline.
  - Events at companies with connections get "You know N people here," and funded companies are added to the board resolver.
  - Feeds: see Starter news sources below.
- **News:** feed title, the feed's own summary if it has one, source, and link.

## AI: the lead fit check is the only model call
- **On demand:** a **Check fit** button per job.
  - Inputs: the job description from the ATS API, plus the user's profile.
  - Output via Zod structured output:
    - `fit`: strong / partial / weak.
    - 2–3 `matches`, each with a verbatim job-description quote. Code checks each quote as a substring and drops any that fail.
    - `gaps`.
  - The model never states facts about the connection or the company.
  - Stored per posting and profile version. A profile change marks old results as based on the old profile and allows a re-run.
  - No description available (VentureFizz) → no fit check.
- **Harness (tribe-intake-triage pattern):**
  - `@anthropic-ai/sdk` server-side only. `ANTHROPIC_API_KEY` in `.env.local`, gitignored.
  - `src/lib/ai/` is the only module allowed to import the SDK (ESLint `no-restricted-imports`). It runs only tasks registered in `src/config/models.ts`.
  - Model and effort are env-overridable (`SPROUT_FIT_MODEL`, `SPROUT_FIT_EFFORT`). Proposed start: `claude-haiku-5-5` at `low`, measured against `claude-sonnet-5-5` on fixtures, with results recorded in `DECISIONS.md`.
  - Single-shot calls with no tools, so no loops are possible. Explicit timeout, `maxRetries: 1`, no re-ask on schema failure.
  - Check `stop_reason` (`max_tokens`, `refusal`) before parsing. Failure shows "Couldn't check fit. Try again." and the rest of the page is unaffected.
  - **Weekly AI budget: $3.00 (rolling 7 days, decided Nov 8).** Cost per call = `AiCall` tokens × the per-model prices in `src/config/models.ts`. Before each call, the gateway adds the worst case (the counted input tokens plus `max_tokens` output) to the 7-day total. If that would pass $3.00, the call is refused: "Weekly AI budget reached: $2.94 of $3.00. Resets {date}." The spend shows on Metrics. This is an estimate from token counts, not the Anthropic bill.
  - `AiCall` log: task, model, effort, tokens, latency, outcome.
  - Feed and job text is untrusted input, so the worst a prompt injection can produce is a bad fit summary.
- **Evals:** about 10 fixtures plus `npm run eval`.
- **Deferred:** Batch API and prompt caching.

## Cover letter generator (decided Nov 8)
- **Where:** a **Draft cover letter** button on full-time jobs only. On demand, and the second and last AI task in the app.
- **Model:** `claude-sonnet-5-5`, measured against `claude-opus-5-5` on a few real jobs. The user picks the model, recorded in `DECISIONS.md`.
- **Examples in the repo, redacted:** `src/config/cover-letter/examples.ts` holds the user's three letters with every organization, product, person, and URL replaced by `XXX` (`XXX` for the target, employers, referrer, product name, and site). They're used as few-shot examples. Real values only ever come from the local DB at runtime.
- **Opening type, chosen per letter:** **Standard** (examples 1–2) or **Mission-driven** (example 3).
- **Mirror the examples (code-enforced structure):** the model returns parts through a Zod schema, and code assembles them.
  - **Standard:**
    1. `Dear {Company},`
    2. The positioning statement verbatim (code): "I am a software engineer turned product manager. My focus is on turning complex data and system architecture into scalable product infrastructure while building hands-on alongside engineering teams." Plus the referral sentence (code) only if the user picks a referrer: "{Name} recommended I reach out regarding this role, and I was eager to connect."
    3. Evidence: 3 sentences. Two `At {Employer}, I …` sentences, then one `Earlier in my career, I …` or `Previously, I …` sentence covering two employers. Each employer must match a `Positions.csv` company.
    4. Close: fixed stem "I build with AI tools daily, and I bring deep experience in {2–3 capabilities}." Then either "I would welcome the chance to discuss how my {strengths} can support {hook}." or "I look forward to discussing how my {strengths} can support {hook}." The hook is backed by a verified job-description quote.
    5. `Best,` + full name from the profile.
  - **Mission-driven:**
    1. `Dear {Company} team!`
    2. Three paragraphs: a personal connection and motivation paragraph, a deep dive on one role, and the organization's mission plus a "I'd love to chat more about…" close.
    3. `Best,` + full name. The full name is always used, including here.
- **Never longer than the examples (hard cap, counted by code):**

  | Type | Opening | Evidence / middle | Close | Total body |
  |---|---|---|---|---|
  | Standard | fixed (28, or 43 with referral) | ≤ 81 | ≤ 40 | ≤ 164 |
  | Mission-driven | ≤ 79 | ≤ 53 | ≤ 64 | ≤ 196 |

  Caps come from the longest example of each type. If a draft exceeds any cap, the app automatically retries once with the overage stated (the only automatic retry in the app, and bounded). If it's still over, it shows "Couldn't keep this within length. Regenerate." and never displays the over-length draft as finished.
- **Checks:** employers and the hook quote are verified. Numbers and proper nouns not in the profile or the job description get highlighted for review. No em dashes.
- **UX:**
  1. Modal with opening type, referrer (optional, from this company's connections), and an optional "why this company" note.
  2. Generate.
  3. Editable draft with highlights and per-paragraph word counts.
  4. Copy.
  Stored per posting. User-initiated regenerations are capped at 3 per posting.

## Pages
A header with a menu dropdown (Today / Industry / Watchlist / Pipeline / Metrics / Admin), keyboard accessible and showing the current page name. No sidebar.
```
┌──────────────────────────────────────────────────────────────────┐
│ Sproutworks   Today ▾        Updated 7:42 AM · 3 new leads       │
├──────────────────────────────────────────────────────────────────┤
│ [stale nudge, only when LinkedIn data > 30 days]                 │
│ Horoscope strip (dark banner): astrology.com | horoscope.com     │
│ New leads (3)                              newest job first      │
│  [company card] [company card] [company card]                    │
│ Worth a look: Market Pulse at companies you know (max 3)         │
│ All caught up → Industry review                                  │
└──────────────────────────────────────────────────────────────────┘
```
- **Today:**
  - Horoscope strip (hidden if unavailable).
  - New leads.
  - Up to 3 Pulse events at connections' companies.
  - Empty states: "No new openings at companies you know. Last checked 7:42 AM." First run → the LinkedIn import steps.
- **Industry:** rebuilt from scratch with the structure of daily-digest `NewsView.tsx`.
  - Hero card, image-paired magazine grid, compact cards with source-colored top rule and two-line summary.
  - "How I pick these" popover generated from config.
  - Sections: AI, Digital health, Market Pulse (all events). A plain section header replaces the dark banner, since the horoscope moved to Today.
- **Watchlist (`/watchlist`, decided Nov 8):** companies where the user has connections but whose careers page the app can't read (Workday or custom).
  - **Two panes (decided Nov 10):** the company list on the left (name, industry, people count, why it's back, a quick ✓ Reviewed), the selected company on the right. On narrow screens the details replace the list, with a way back. The selection persists in localStorage.
  - Details: industry, a description, **Your way in** (best contact first with initials, tier, and years connected; the rest expand), **Careers page**, recent Market Pulse news, **Reviewed**, and **Exclude**.
  - **Description, deterministic, no AI:** the company's own homepage meta description, else the Wikipedia summary; industry and website from Wikidata. Looked up when a company is first opened, and for up to 25 Watchlist companies per morning check on their own request budget (`COMPANY_INFO` in `src/config/fetch.ts`), refreshed every 90 days. Robots.txt is respected. Fixture mode never looks up invented names.
  - **Careers page:** the user pastes the link once. The app looks for a Greenhouse, Lever, or Ashby board in the link or the page's HTML (links, iframes, embed scripts). If one answers, the board is set and locked and the company's jobs join Today on the next check. Otherwise the link is kept (locked) and the row offers **Visit careers page ↗**. With no link, **Find their careers page ↗** runs a web search.
  - Profile photos aren't shown: the export has none and nothing is fetched from LinkedIn.
  - **Careers pages, every morning (decided Nov 10):** each saved careers page is read on its own budget (`CAREERS` in `src/config/fetch.ts`), in order of trust: a Greenhouse, Lever, or Ashby board behind it (confirmed; read as a board from then on), a Workday site behind it, schema.org JobPosting listings, then job titles in the page's links and headings. Senior product roles go to Today as `WORKDAY` or `CAREERS_PAGE` postings; a missing location shows as "Location not listed." A page that shows nothing readable is marked unreadable and stays on the Watchlist with a note. A readable page takes the company off the Watchlist.
  - **Workday (user decision Nov 10):** Workday publishes no job feed. The app reads the JSON endpoint its career sites use (`/wday/cxs/{tenant}/{site}/jobs`), searching "product manager" (relevance-ranked; checked on a large live site), up to 3 pages, once a day per company. Titles without "manager" ("Head of Product") can rank lower at very large companies. If Workday changes it, the company shows as unreadable.
  - **Finding careers pages:** up to 25 Watchlist companies with a known website per morning check: the homepage's Careers or Jobs link, followed to a Workday site or board when the careers page links to one. A find is used right away and read in the same check, with no confirmation. **Wrong company?** on Today (or **Wrong page? Change it** on the Watchlist) clears it, and the homepage isn't searched again.
  - Fit check and cover letter don't read Workday or careers-page job descriptions yet; they ask the user to add the description.
  - **Reviewed** hides the row (with Undo) until something the app can detect happens: a Market Pulse event for the company, a change in who the user knows there after an import (joined, left, promoted), or `watchlistReturnDays` (config, default 30) passing. A returning row states why: "Back because: raised a $12M seed."
  - Visiting the careers page doesn't hide the row. Sorted with returned rows first, then by best tier. Never shown on Today.
  - **Board matching (fixed Nov 10):** a board that exists but has no open jobs counts as found (a board with jobs still wins). An empty board counts toward "stale" only if it once had jobs. Wrong and Can't check lock the decision.
- **Pipeline (`/pipeline`, decided Nov 8):** every job the user marked **Applied**, in four columns: Applied → Interviewing → Closed / Won.
  - Each card shows company, role, applied date, time in the current stage, and the best warm intro. A **Move to** menu changes the stage (keyboard accessible).
  - Closed applications older than 30 days collapse under "N closed more than 30 days ago." They still count in Metrics.
  - **Applied** is a button on each job row on Today (Apply ↗ · Check fit · Cover letter · Applied). It creates the application, and the job leaves Today. The company card leaves Today when none of its jobs are left unapplied or unseen.
- **Metrics (`/metrics`, decided Nov 8):** the PRD Module B KPIs. An **outcomes band** leads the page in the morning-sky treatment with large numerals: **Applications** (total, active, links to Pipeline), **Interview rate** (reached Interviewing out of all applications), and **Jobs won** (count). Below it, the other KPIs each show this week's value, the target, and an 8-week trend.
  - Operational: sweep time, posting-to-review time, warm leads per week, outreach actions per week (including jobs marked Applied).
  - Platform health: refresh duration, false resurfaces, board fetch failures, cover letters within length, AI spend vs. budget.
  - Computed from existing tables (`Posting`, `Review`, `FitCheck`, `CoverLetter`, `RefreshRun`, `AiCall`) plus an `AppEvent` table for things only the UI knows: Today opened, "All caught up" reached, Apply clicked.
  - KPI definitions and targets live in `src/config/kpis.ts`. Warm leads and outreach actions have no target yet: they show "Baseline · week N of 4" for the first 4 weeks, and then the user sets a target.
- **Admin (`/admin`):**
  - **LinkedIn data:**
    - Header: "Last imported {date} · {n} connections · profile updated".
    - **Request new export:** always enabled. Opens LinkedIn's "Download your data" page in a new tab and records the date.
    - **Import archive:** always enabled, ZIP upload. Validates the expected CSVs, then imports connections and profile in a single transaction. A bad ZIP changes nothing.
    - Informational status line. Nothing is ever greyed out.
    - Stale nudge on Today after `staleAfterDays` (30).
  - Excluded companies (Include again).
  - What the app reads each morning (boards, careers pages, Watchlist), with matches found automatically in the last two weeks.
  - Refresh status and history.
  - Manual refresh.
  - Backups list.
  - Sources (two lists, Add/Remove), and stale board tokens.
  - Filters and fetch numbers stay in config.

## Daily refresh (no schedule)
Runs on the first app open of the day, or from Admin's Refresh.
- One batched job queues every confirmed, non-excluded company not fetched in 20h, plus the feeds.
- Today renders yesterday's results immediately, with "Checking job boards · 34 of 112" in the header. Results land once at the end: "Updated 7:42 AM · 3 new leads."
- Failures go to Admin. A re-run touches only what's due or what failed.
- Duration: about 1–2 minutes normally. The first run is about 750 requests and 10–15 minutes, with progress shown.

**Politeness (`src/config/fetch.ts`):**

| Param | Default |
|---|---|
| `maxConcurrent` | 4 |
| `perHostConcurrent` | 1 |
| `perHostDelayMs` | 1000 (VentureFizz 10000) |
| `requestTimeoutMs` | 10000 |
| `maxRetries` | 1, honoring `Retry-After`; a second 429 pauses that host until tomorrow |
| `minHoursBetweenFetches` | 20 |
| `resolverRetryDays` | 7 |
| `maxRequestsPerRefresh` | 1000; stops and reports what it skipped |
| `userAgent` | `Sproutworks/0.1 (personal job tracker; <contact email from .env.local>)` |
| conditional GET | ETag / If-Modified-Since where supported |

**Backups (`src/config/backup.ts`):**
- SQLite `VACUUM INTO` copies to `~/Sproutworks-backups` (outside the repo), taken before each refresh, each import, and each migration. Keeps the last 14.
- Restore with `npm run restore -- <file>`. Review and exclusion history is never deleted from the live DB.

## Stack and structure
Next.js App Router, Prisma, SQLite (libsql), Tailwind, Zod. The dev server binds to 127.0.0.1 only.
- **DB client:** `src/lib/db.ts` exports one Prisma client cached on `globalThis` outside production (the standard `globalForPrisma` pattern). Hot reload in `next dev` reuses it rather than opening a new connection pool on every edit. It's only imported by `src/services` and API routes; components can't import it (ESLint).

Layering follows daily-digest:
- `src/app/api`: validation is the contract.
- `src/components`: display only, enforced by ESLint.
- `src/lib` / `src/services`.
- `src/config`: sources, filters, pulse rules, models, fetch, backup.

Draft tables: `Source`, `Person`, `ConnectionChange`, `CompanyAlias`, `Company`, `Posting`, `Review` (per company), `FitCheck`, `Profile`, `Import`, `NewsItem`, `PulseEvent`, `Horoscope`, `RefreshRun`, `AiCall`, `CoverLetter`, `AppEvent`, `Application`, `ApplicationStageChange`.

## Out of scope (v1)
- Anything that logs into or automates LinkedIn.
- 2nd-degree connections.
- Outreach drafting or angles (cover letters are the one exception).
- Careers pages that load their jobs in the browser: marked unreadable, never driven with a browser.
- AI news summaries.
- Email alerts and inbox or Downloads watching.
- Automated Slack reading.
- Scheduled refresh.
- Multi-user and hosting.

## Status
Phases 1–5 complete (all four slices built Nov 8). Earlier: PRD, tech stack, AI guidelines, schema, contracts, source review, README, and a clickable design prototype (`design/mockups/`). Next: Phase 5, the build. Board coverage gets measured on the first real run.

## Phase 5 slices (decided Nov 8, approved per slice)
1. **Core loop (built Nov 8):** LinkedIn import, company matching, Greenhouse/Lever/Ashby connectors, leads engine (Reviewed / Exclude / Applied), Today, Pipeline, Admin (LinkedIn data, board links). **Approved Nov 8.**
2. **Reading:** feeds, freshness gates, Market Pulse rules, Industry page, source management, Astrostyle horoscope. **Approved Nov 8, built before Applying because it's testable without an API key.**
3. **Applying:** AI gateway, $3 weekly budget, fit check, cover letter, + Add a job, evals. **Built Nov 8 with a stand-in model; tuned on the user's machine with their key.**
4. **The rest:** Watchlist, Metrics, VentureFizz, backups, remaining Admin panels. **Built Nov 8.** VentureFizz's feed holds only its newest 50 postings, so its postings close after 30 days unseen instead of on absence.

Each slice is built end to end and reviewed as a running app.

## Resolved (Nov 8)
1. **No Time Machine:** the full backup feature stays (copies before each refresh, import, and migration; keep 14). The backup folder lives on the same disk as the database, so it doesn't protect against disk loss.
2. **Single user** for v1, confirmed.
3. **"Where I found it" list:** VentureFizz, Health Tech Nerds, Other.
4. **Fractional and advisory sources:** VentureFizz and Health Tech Nerds, both already in the source lists.

## Starter news sources (verified Nov 8)
These were suggested by the assistant, not the user, and the user chose to keep them. All are removable on Admin.

| Source | Feed | Access |
|---|---|---|
| STAT health tech | `statnews.com/category/health-tech/feed/` | Fetch. The terms list RSS as an offered feature, for personal noncommercial use. Many items are paywalled (STAT+), so show the title and link only. |
| TechCrunch biotech & health | `techcrunch.com/category/biotech-health/feed/` | Fetch. Its RSS terms allow news-reader display, unmodified, with attribution and a link. |
| Fierce Healthcare | `fiercehealthcare.com/rss/xml` (all-site; health-tech section feeds are empty) | Fetch (user decision Nov 8, gray: the terms page blocks automated visitors). Keep items whose link path contains `/health-tech/` or `/digital-health/`. |
| MobiHealthNews | behind a bot challenge | Link only |
| astrology.com, horoscope.com | no feeds, terms ban scraping | Not used |
| Astrostyle (The AstroTwins) | `astrostyle.com/feed/`, filtered to the Virgo daily text | Fetch (user decision Nov 8, gray: terms allow personal non-commercial use and are silent on automation). Show only the Virgo paragraph, credited, with a link. No fallback: no Virgo item that day means no horoscope. |

**AI newsletters the user chose (checked Nov 8):**
- **Fetched:** Import AI, Ben's Bites, 100 School, and Zapier (whole-blog feed, AI stories only). Substack and beehiiv platform terms ban crawling the platform, but these are the publications' own published feeds, read once a day.
- **Link only:** The Rundown AI (it has a feed, but its terms bar "robotic automation to access or extract information"), The Batch (no feed), Superhuman AI (no feed found), and The Neuron (bot-walled).
- **Excluded:** The AI Optimist, with no posts since May 15, 2026.

**Job boards on these sites (checked Nov 8):** none offers an official job feed or API. STAT's and Rock Health's careers pages list no openings, and TechCrunch has no board, so none of the three is added. Fierce Jobs (`jobs.fiercehealthcare.com`) and the HIMSS board sit behind bot challenges with unreadable terms. **Fierce Jobs is added as a link-only Lead gen source (user decision Nov 8).** Rock Health was dropped entirely, since its feed has been stale since 2021.

## Known limits accepted (Nov 8)
- Connections removed on LinkedIn stay listed: an import adds and updates people but never marks missing ones as disconnected. The user judged it not worth building.

## Phase 4 checks still to run
- A Health Tech Nerds RSS feed (beehiiv), plus whether its job board has an official feed.

## Execution sequence (each step gated on approval)
0. **Workspace:** first commit is `.gitignore` (`.env*`, `*.db`, `*.csv`, `*.zip`, `private-context/`), `CLAUDE.md`, and `docs/`.
1. **Phase 1:** PRD Modules A–D, locked one at a time, in `docs/PRD.md`. Module A draft comes first in chat.
2. **Phase 2:** tech stack doc and AI guidelines doc.
3. **Phase 3:** Prisma schema, API/UI types, fit-check output schema.
4. **Phase 4:** dependency review (feed and horoscope terms, board coverage) and the README.
5. **Phase 5:** import and normalization → board resolver and fetcher → leads engine → fit-check utility against its schema → API routes → UI.
   - **UI follows the frontend design process (decided Nov 8):** before any component code, brainstorm a compact token system (4–6 named colors, display/body/utility typefaces, layout with ASCII wireframes, one signature element), critique it against generic defaults, and get the user's approval. Then build, screenshot, and critique again.
   - Quality floor: responsive to mobile, visible keyboard focus, reduced motion respected.
   - The Industry page keeps the NewsView structure the user asked for. The brief wins on that page, and the token system styles it.

## Verification
- **Unit tests:**
  - CSV import (emails dropped).
  - Company normalization.
  - Filters and type tags.
  - Pulse headline rules.
  - Company-level resurfacing, including a closed-then-reopened posting with the same ID that doesn't resurface the card.
  - Job-change surfacing.
  - Quote verification.
  - Politeness limiter.
- **Smoke test (synthetic fixtures during development, real export at first run):**
  - Import, refresh, mark an automatic match Wrong company.
  - Review a company and confirm it hides. Simulate a new posting ID and confirm it returns.
  - Exclude a company, then include it again.
  - Check fit with a valid key, then with an invalid key: the failure state shows and the page still works.
  - A bad ZIP leaves the data intact.
- **Clean clone:** the README setup works on a fresh clone.
- **Browser check:** dropdown navigation by keyboard. Time a full sweep against the 10-minute target.
