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
    4. The user confirms "I've checked this site's terms allow automated reading," and the confirmation is stored with a date. That saves the source as fetchable. Anything not detected, not confirmed, or disallowed by robots.txt saves as `link-out`.
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
- **Company matching:** names are normalized ("Acme", "Acme Inc." and "Acme Health (Acme)" become one company), and every raw name seen is kept as an alias of the company. The app guesses a board code and probes all three services. A hit stays pending until the user confirms it once on Admin, where any company can also take a provider + code typed by hand. Confirmed or hand-set links are locked: re-probing never overwrites them. Only the stale-token flag can prompt the user to change one.
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
  - Where I found it, from a list in config (e.g. Pavilion Slack, Lenny's Newsletter Slack).
- A link to a Greenhouse/Lever/Ashby posting is fetched through the public API and fills the fields automatically. Any other link is stored as-is, and the user pastes the text. linkedin.com links get stored, never fetched.
- Creates a `Posting` with `source: "manual"`. It shows on Today like any lead (with connections if any match, and marked "Added by you"), runs the same filters as a warning (not a block), and goes through the same Zod fit-check pipeline on **Check fit**.
- Slack communities are manual-paste only in v1. Reading them automatically would need each community's permission and a Slack app.

## Market Pulse, news, horoscope (zero AI)
- **Market Pulse:**
  - The headline is shown verbatim.
  - Rules in `src/config/pulse-rules.ts` tag the event type (funding / launch / leadership hire / expansion) and extract amount, round, and company. A failed extraction still shows the headline.
  - Events at companies with connections get "You know N people here," and funded companies are added to the board resolver.
  - Candidate feeds (MobiHealthNews, Fierce Healthcare, STAT Health Tech, Rock Health, TechCrunch Health) get verified in Phase 4.
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
A header with a menu dropdown (Today / Industry / Watchlist / Metrics / Admin), keyboard accessible and showing the current page name. No sidebar.
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
  - Each row: company, connection count with the best warm-intro tier ("3 people · Tier 1: VP Product"), a **Visit careers page** link (found or set by hand), and "Last checked by you: {date}".
  - Actions: **Checked** (stamps today's date), **Add a job** (opens manual entry pre-filled with the company), **Exclude company**.
  - Sorted by least recently checked, then best tier. Never shown on Today.
- **Metrics (`/metrics`, decided Nov 8):** the PRD Module B KPIs, each showing this week's value, the target, and an 8-week trend.
  - Operational: sweep time, posting-to-review time, warm leads per week, outreach actions per week.
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
  - Board links to confirm.
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

Draft tables: `Source`, `Person`, `ConnectionChange`, `CompanyAlias`, `Company`, `Posting`, `Review` (per company), `FitCheck`, `Profile`, `Import`, `NewsItem`, `PulseEvent`, `Horoscope`, `RefreshRun`, `AiCall`, `CoverLetter`, `AppEvent`.

## Out of scope (v1)
- Anything that logs into or automates LinkedIn.
- 2nd-degree connections.
- Outreach drafting or angles (cover letters are the one exception).
- Workday or custom career-site scraping.
- AI news summaries.
- Email alerts and inbox or Downloads watching.
- Automated Slack reading.
- Scheduled refresh.
- Multi-user and hosting.

## Open questions
1. Does the machine running the app use Time Machine? If yes, cut backups to the pre-migration copy only.
2. Single user only, confirmed for v1? (Assumed yes.)
3. Slack community names for the "where I found it" list.

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
  - Import, refresh, confirm a board link.
  - Review a company and confirm it hides. Simulate a new posting ID and confirm it returns.
  - Exclude a company, then include it again.
  - Check fit with a valid key, then with an invalid key: the failure state shows and the page still works.
  - A bad ZIP leaves the data intact.
- **Clean clone:** the README setup works on a fresh clone.
- **Browser check:** dropdown navigation by keyboard. Time a full sweep against the 10-minute target.
