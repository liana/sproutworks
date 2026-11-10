# Sproutworks PRD

## Module A: Executive Summary and Problem Statement

### Executive Summary

Sproutworks is a local morning dashboard that turns a senior product leader's professional network into a daily lead list. It checks the public job boards of companies where first-degree connections work, surfaces senior product roles (full-time and fractional) alongside the people the user knows there, and pairs them with industry news and funding signals in a sweep that takes under 10 minutes.

### Problem Statement

Senior product roles inside the user's network go unseen until the network can no longer help. Openings sit on hundreds of separate careers pages, and no tool connects a posting to the connections who could make an introduction. The user checks pages by hand or relies on the LinkedIn feed, keeps no record of which companies were already reviewed, and rereads old postings while new ones slip past. Fractional and advisory work is harder still, since it rarely reaches a public board and surfaces first in community channels and funding news.

## Module B: Business Opportunity and KPIs

### Opportunity

The user's network already has warm paths into companies that are hiring, but there's no way to see them. Sproutworks makes those paths visible every morning, so outreach happens while a role is new and an introduction still carries weight.

### Outcome KPIs

These measure what the search produces, which is the reason the app exists. They lead the Metrics page.

| Metric | Baseline | Target | Measured by |
|---|---|---|---|
| Applications | 0 | Set after a 4-week baseline | Jobs marked Applied (total, and how many are active) |
| Interview rate | 0 | Set after a 4-week baseline | Applications that reached Interviewing out of all applications, counting collapsed closed ones. An application keeps counting after it moves on to Closed or Won |
| Jobs won | 0 | None | Count of applications marked Won |

### Operational KPIs

| Metric | Baseline | Target | Measured by |
|---|---|---|---|
| Daily sweep time | Not tracked | ≤ 10 minutes | Opening Today to reaching "All caught up" |
| Posting-to-review time | Not tracked | ≤ 2 days from first seen | Posting first seen vs. company marked Reviewed |
| Warm leads per week | 0 | Set after a 4-week baseline | New company cards surfaced |
| Outreach actions per week | 0 | Set after a 4-week baseline | Fit checks, cover letters, and jobs marked Applied |

### Platform Health KPIs

| Metric | Target |
|---|---|
| Morning refresh duration | ≤ 2 minutes on a normal day |
| False "new lead" resurfaces | 0 |
| Board fetch failures | < 5% of hosts per run, each one visible to the user |
| Cover letters within length caps | 100% |
| AI spend | ≤ $3.00 per rolling week, enforced: calls past the cap are refused |

Every KPI appears on the Metrics page with its current value, target, and 8-week trend.

## Module C: User Persona and Goals

### Persona: the senior product leader building their next chapter

A former software engineer turned senior product leader who has worked at both startups and large organizations. They're open to a full-time executive role and also want a fractional or advisory portfolio. Their network is their main asset: years of first-degree connections across health tech, AI, and enterprise software. They work in the Boston area or remotely.

**Their week:** a full-time job leaves about 10 minutes most mornings, over coffee, for career moves. Job searching happens in fragments: a feed scroll, a careers page they remember to check, a role someone shares in a community channel. They apply directly on company websites and lead with warm introductions whenever one exists.

**Where the friction hits:**

- Openings at companies where they know people surface late or never.
- No record of which companies they've already looked at, so they re-check the same pages.
- Every application needs a tailored cover letter, which takes time a fragmented week doesn't have.
- Fractional work circulates in communities and funding news, away from the boards they can monitor.

### Goals

1. See every new senior product role at a company where they know someone, within days of posting.
2. Know who to ask for an introduction, and how close that person is to the hiring decision.
3. Check fit and draft a cover letter in their own voice in minutes, without inventing anything.
4. Stay current on AI and digital health and spot funded companies before they post roles.
5. Finish the whole sweep in 10 minutes and enjoy it enough to come back every day.

## Module D: Requirements, User Stories, and Out of Scope

### Network data

1. As the user, I upload my LinkedIn data export, so my connections and profile load without the app ever touching my LinkedIn account.
2. As the user, I see when my data was last imported and get a nudge after 30 days, so my leads stay current.
3. As the user, I see which connections changed companies since my last import, so I can congratulate them and check their new company.

### Leads

4. As the user, I see a card for each company where I know someone and a senior product role is open in the Boston area or remotely, newest job first.
5. As the user, I see everyone I know at that company, ranked by how close they likely are to the hiring decision.
6. As the user, I see which roles are fractional or advisory, so I can track that portfolio separately from full-time roles.
7. As the user, I mark a company Reviewed, and it stays hidden until it posts a role I haven't seen.
8. As the user, I exclude a company, so it never appears again unless I include it.
9. As the user, I add a job I found elsewhere, such as in a community channel, so it gets the same fit check and cover letter.
10. As the user, I see companies the app can't check on a Watchlist, with a link to their careers page. When I mark one Reviewed, it stays away until there's news about it, a change in who I know there, or 30 days pass.
11. As the user, I confirm or correct the job board the app matched to a company, once, and it stays locked.

### Applying

12. As the user, I check a job's fit against my LinkedIn profile and see matches quoted from the job description, plus gaps.
13. As the user, I draft a cover letter for a full-time role that follows my own examples, never runs longer than them, and flags anything it couldn't verify.
14. As the user, I mark a job Applied, so it leaves Today and moves to my Pipeline.
15. As the user, I move each application through Applied, Interviewing, Closed, or Won, see how long it has been in its stage, and see closed applications collapse after 30 days.

### Industry

16. As the user, I skim AI, digital health, and Market Pulse headlines from sources I choose, with funding news at companies where I know people pulled to the front.
17. As the user, I add and remove news and lead gen sources myself.
18. As the user, I start the day with a horoscope from real sources, or no horoscope at all.

### Trust and measurement

19. As the user, I see the morning check's progress and results, including anything it skipped.
20. As the user, I see when a job board looks broken, instead of its company silently disappearing.
21. As the user, I can restore my review history if the database is lost.
22. As the user, I see my KPIs and weekly AI spend, and the app stops AI calls at $3.00 a week.

### Out of Scope

- Logging into or automating LinkedIn
- Second-degree connections
- Outreach messages or suggested angles
- Reading Workday or custom career sites
- AI news summaries
- Email alerts, and watching inboxes or folders
- Reading Slack automatically
- Scheduled refreshes
- Multiple users and hosting
