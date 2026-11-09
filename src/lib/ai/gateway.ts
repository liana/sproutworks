// The only module that talks to the Anthropic API. Registered tasks only, budget-checked, logged, bounded.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";
import { db } from "@/lib/db";
import { AI_TASKS, PRICES, FALLBACK_PRICE, WEEKLY_BUDGET_USD, REQUEST_TIMEOUT_MS, type AiTaskName } from "@/config/models";

export type AiResult<T> =
  | { ok: true; data: T; aiCallId: string }
  | { ok: false; error: "BUDGET" | "AUTH" | "UNAVAILABLE" | "INVALID"; message: string; aiCallId?: string };

const price = (model: string) => PRICES[model] ?? FALLBACK_PRICE;
const micro = (usd: number) => Math.ceil(usd * 1e6);

export async function weeklySpendMicroUsd(): Promise<number> {
  const since = new Date(Date.now() - 7 * 864e5);
  const r = await db.aiCall.aggregate({ _sum: { costMicroUsd: true }, where: { createdAt: { gte: since } } });
  return r._sum.costMicroUsd ?? 0;
}

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic({ timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 }));

import { fakeOutput } from "@/lib/ai/fake";

export async function runTask<T>(task: AiTaskName, input: { system: string; user: string; promptVersion: string }, schema: ZodType<T>): Promise<AiResult<T>> {
  const cfg = AI_TASKS[task];
  const p = price(cfg.model);
  // Worst case before calling: a conservative token estimate for the input plus every allowed output token.
  const estInput = Math.ceil((input.system.length + input.user.length) / 3);
  const worst = micro((estInput * p.input + cfg.maxTokens * p.output) / 1e6);
  const spent = await weeklySpendMicroUsd();
  if (spent + worst > micro(WEEKLY_BUDGET_USD)) {
    await db.appEvent.create({ data: { type: "BUDGET_REFUSED" } });
    const resets = await db.aiCall.findFirst({ where: { createdAt: { gte: new Date(Date.now() - 7 * 864e5) } }, orderBy: { createdAt: "asc" } });
    const when = resets ? new Date(resets.createdAt.getTime() + 7 * 864e5).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "soon";
    return { ok: false, error: "BUDGET", message: `Weekly AI budget reached: $${(spent / 1e6).toFixed(2)} of $${WEEKLY_BUDGET_USD.toFixed(2)}. Resets ${when}.` };
  }

  const started = Date.now();
  const log = (outcome: "OK" | "SCHEMA_FAIL" | "REFUSAL" | "MAX_TOKENS" | "API_ERROR", usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null }) =>
    db.aiCall.create({
      data: {
        task, model: cfg.model, effort: cfg.effort, promptVersion: input.promptVersion,
        inputTokens: usage?.input_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0, cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
        costMicroUsd: usage ? micro((usage.input_tokens * p.input + usage.output_tokens * p.output) / 1e6) : 0,
        latencyMs: Date.now() - started, outcome,
      },
    });

  // SPROUT_FAKE_AI=1 returns canned output so the UI can be tried without an API key. Never set in real use.
  if (process.env.SPROUT_FAKE_AI === "1") {
    const parsed = schema.safeParse(fakeOutput(task, input.system.includes("Code adds the greeting")));
    const call = await log(parsed.success ? "OK" : "SCHEMA_FAIL", { input_tokens: estInput, output_tokens: 300 });
    return parsed.success ? { ok: true, data: parsed.data, aiCallId: call.id } : { ok: false, error: "INVALID", message: "The draft didn't come back in the expected shape. Try again.", aiCallId: call.id };
  }

  try {
    const res = await getClient().messages.parse({
      model: cfg.model,
      max_tokens: cfg.maxTokens,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
      output_config: { effort: cfg.effort, format: zodOutputFormat(schema as never) },
    });
    if (res.stop_reason === "refusal") { const c = await log("REFUSAL", res.usage); return { ok: false, error: "UNAVAILABLE", message: "The model declined this one. Try again or edit the job text.", aiCallId: c.id }; }
    if (res.stop_reason === "max_tokens") { const c = await log("MAX_TOKENS", res.usage); return { ok: false, error: "INVALID", message: "The answer was cut off. Try again.", aiCallId: c.id }; }
    const parsed = schema.safeParse(res.parsed_output);
    if (!parsed.success) { const c = await log("SCHEMA_FAIL", res.usage); return { ok: false, error: "INVALID", message: "The answer didn't come back in the expected shape. Try again.", aiCallId: c.id }; }
    const c = await log("OK", res.usage);
    return { ok: true, data: parsed.data, aiCallId: c.id };
  } catch (e) {
    await log("API_ERROR");
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, error: "AUTH", message: "AI is unavailable: check the API key in .env.local." };
    if (e instanceof Anthropic.APIError || e instanceof Anthropic.APIConnectionError) return { ok: false, error: "UNAVAILABLE", message: "Couldn't reach the AI service. Try again." };
    // No credentials at all: the SDK throws before any request is made.
    if (e instanceof Anthropic.AnthropicError || (e instanceof Error && /authentication method|api.?key/i.test(e.message)))
      return { ok: false, error: "AUTH", message: "AI is unavailable: add ANTHROPIC_API_KEY to .env.local and restart." };
    throw e;
  }
}
