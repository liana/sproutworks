# Decisions

Choices where more than one reasonable option existed, and why this one was made.

## AI: two tasks, both on demand
Fit check and cover letter only. Everything else (leads, matching, Market Pulse, news, horoscope) is deterministic code, so nothing the app treats as fact comes from a model.

## Models (to be measured on the user's machine)
| Task | Starting model | Effort | Why | Measured? |
|---|---|---|---|---|
| Fit check | `claude-haiku-5-5` | low | Reading two documents and quoting one is extraction-shaped; the cheapest model may be enough | Not yet. Run `npm run eval` with a real key and compare `SPROUT_FIT_MODEL=claude-sonnet-5-5` |
| Cover letter | `claude-sonnet-5-5` | medium | Writing quality matters more than cost (about 1 to 2 cents a letter) | Not yet. Compare `SPROUT_LETTER_MODEL=claude-opus-5-5` on a few real jobs |

Record results here once measured: model, effort, cases passed, cost, and what the letters read like.

## Structure is enforced by code, not the prompt
The model returns parts through Zod schemas (one per opening type, so the model never picks the type). Code writes the greeting, positioning statement, referral sentence, sentence stems, and sign-off, then counts words per paragraph against caps taken from the user's own examples. Over a cap → one automatic retry stating the overage → still over → the draft is refused, never shown as finished.

## Verification after every response
Fit-check quotes must appear verbatim in the job description, or they're dropped. Cover-letter employers must match a LinkedIn position, and the hook must quote the job description. Names and numbers that appear in neither input are highlighted for review, never silently removed.

## No refusal fallback
Anthropic recommends a server-side fallback on Sonnet for refused requests. It's left out: refusals are unlikely for this content, Haiku has no fallback, and a refusal already shows a clear message.

## Budget: $3.00 per rolling 7 days
Checked before each call against the worst case (a conservative input estimate plus every allowed output token). Costs are estimated from token counts and the prices in `src/config/models.ts`. Treat them as close, not the Anthropic bill.

## Stand-in model for development
`SPROUT_FAKE_AI=1` returns canned output so the UI can be exercised without a key. Calls are still logged and budget-checked. Never set it in real use.
