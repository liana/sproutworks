# AI Guidelines

## Principle

AI handles only two on-demand tasks: the fit check and the cover letter. Everything else is deterministic code. A new AI task needs an entry in `src/config/models.ts` and a line in this document, and ESLint rejects SDK imports anywhere outside `src/lib/ai/`.

## Tasks

| | Fit check | Cover letter |
|---|---|---|
| Trigger | **Check fit** click | **Draft cover letter** click (full-time only) |
| Model (env override) | `claude-haiku-5-5` (`SPROUT_FIT_MODEL`) | `claude-sonnet-5-5` (`SPROUT_LETTER_MODEL`) |
| Effort | `low`, set explicitly (Haiku 5.5 defaults to `medium`) | `medium`, set explicitly |
| Input | Job description text + profile | Job description + profile + redacted examples + the user's form choices |
| Output | Zod: `fit`, 2–3 `matches` with quotes, `gaps` | Zod: letter parts, which code assembles |
| `max_tokens` | 2,000 | 2,000 |
| Cached | Per posting + profile version | Per posting |

Starting models are measured on fixtures before they're kept, and the results go in `DECISIONS.md`. Sampling parameters (`temperature` and similar) are never sent, since current API versions reject them.

## Prompts

Prompts are frozen constants in `src/lib/ai/prompts/`, each with a version string recorded on every call. A prompt only changes with a new version and a re-run of its eval. Untrusted text (job descriptions, pasted posts) goes in delimited blocks, after the instructions.

## Context assembly

Code builds the profile from export fields (headline, positions, skills, education). A model never summarizes it. Job descriptions are stripped to plain text and passed whole. If an input would exceed the budget check, the call is refused, never truncated.

## What AI is never allowed to do

- State facts about a connection, a company, or a referral.
- Produce numbers or names that code can't trace to the profile or job description. These get highlighted.
- Call tools, fetch URLs, or touch the database.
- Run in a loop or trigger another call.

## Verification gates (code, after every response)

1. Check `stop_reason`. `max_tokens` or `refusal` → failure state, no parsing.
2. Zod parse. A failure → failure state, no re-ask.
3. Quote check: every match quote and the cover letter hook must appear in the job description, or they're dropped.
4. Employer check: every cover letter employer must match a position in the profile, or it's dropped.
5. Length check (cover letter): over any cap → one automatic retry with the overage stated → still over: "Couldn't keep this within length. Regenerate."
6. Proper nouns and numbers not found in the inputs get highlighted for review.

## Error-handling contract

| Failure | Retry | User sees |
|---|---|---|
| Network error, 429, 5xx | SDK retries once (`maxRetries: 1`), 30-second timeout | "Couldn't check fit. Try again." / "Couldn't draft the letter. Try again." |
| Invalid API key (401) | None | "AI is unavailable: check the API key." Leads and every other page keep working |
| Schema, quote, or employer failure | None (length is the one exception) | The same message, plus whatever passed verification |
| Weekly budget reached | None | "Weekly AI budget reached: $2.94 of $3.00. Resets {date}." |

## Budget and logging

The budget is $3.00 per rolling 7 days, with each call's worst case checked before it runs. Every call writes an `AiCall` row: task, model, effort, prompt version, tokens, estimated cost, latency, and outcome. Metrics reads from it.

## Human-in-the-loop

Both tasks are user-triggered, so nothing runs unattended. Cover letters are always an editable draft with highlights, and nothing is sent or submitted. Fit results are advice: the app never hides or ranks leads by fit.

## Evals

`npm run eval` runs fixed fixtures (about 10 fit checks, about 5 cover letters). It scores schema validity, quote accuracy, length compliance, and agreement with hand-written expectations. It runs before any model, effort, or prompt change is kept.

## AI strategies

- **Applies:** structured output, inference policies (the never-list above), persistent state (`AiCall`, `FitCheck`, `CoverLetter`), and continuous evaluation.
- **Partly applies:** tiered routing. The cheap model handles fit and the stronger one handles letters.
- **Not in v1:** orchestration, multi-agent, reflection loops, and pruning. There are no conversations or loops.
- **Refusal fallback:** left out. It adds nothing for this use case and isn't available on Haiku.
