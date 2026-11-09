// Every AI task the app may run. A new task needs an entry here and a line in docs/ai-guidelines.md.
export type AiTaskName = "FIT_CHECK" | "COVER_LETTER";
type Effort = "low" | "medium" | "high";

export const AI_TASKS: Record<AiTaskName, { model: string; effort: Effort; maxTokens: number }> = {
  FIT_CHECK: {
    model: process.env.SPROUT_FIT_MODEL ?? "claude-haiku-5-5",
    effort: (process.env.SPROUT_FIT_EFFORT as Effort) ?? "low",
    maxTokens: 2000,
  },
  COVER_LETTER: {
    model: process.env.SPROUT_LETTER_MODEL ?? "claude-sonnet-5-5",
    effort: (process.env.SPROUT_LETTER_EFFORT as Effort) ?? "medium",
    maxTokens: 2000,
  },
};

// USD per million tokens, first-party API rates. Used to estimate spend for the weekly cap; not the bill.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
export const FALLBACK_PRICE = { input: 10, output: 50 }; // unknown model: assume the most expensive tier

export const WEEKLY_BUDGET_USD = 3;
export const REQUEST_TIMEOUT_MS = 30_000;
export const LETTER_REGENERATIONS = 3;
