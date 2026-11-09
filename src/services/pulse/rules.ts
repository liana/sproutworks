// Market Pulse: tag funding, launches, leadership hires, and expansions from headline wording. Pure, no AI.
export type PulseTag = { type: "FUNDING" | "LAUNCH" | "LEADERSHIP_HIRE" | "EXPANSION" | null; companyName: string | null; amount: string | null; round: string | null };

const AMOUNT = /\$\s?\d+(?:\.\d+)?\s?(?:[MBK]|million|billion)\b/i;
const ROUND = /\b(pre-seed|seed|series [a-h]\+?|growth round|bridge round)\b/i;

const RULES: { type: NonNullable<PulseTag["type"]>; verb: RegExp }[] = [
  { type: "FUNDING", verb: /\s(raises|raised|secures|lands|closes|nabs|bags|gets)\s/i },
  { type: "LEADERSHIP_HIRE", verb: /\s(names|appoints|hires|taps|adds)\s(?=.*\b(chief|ceo|cto|cpo|coo|president|vp|head of|officer)\b)/i },
  { type: "LAUNCH", verb: /\s(launches|unveils|debuts|introduces|rolls out|releases)\s/i },
  { type: "EXPANSION", verb: /\s(expands|acquires|buys|opens|enters)\s/i },
];

const ROUNDUP = /^(weekly rundown|roundup|round-up|briefs?|digest|the week|this week|newsletter)\b/i;
const NONE: PulseTag = { type: null, companyName: null, amount: null, round: null };

export function tagHeadline(headline: string): PulseTag {
  const h = headline.replace(/^STAT\+:\s*/i, "").trim();
  if (ROUNDUP.test(h)) return NONE; // multi-story roundups can't be tagged reliably
  for (const r of RULES) {
    const m = h.match(r.verb);
    if (!m || m.index === undefined || m.index > 60) continue; // the actor comes first in a real event headline
    if (r.type === "FUNDING" && !AMOUNT.test(h) && !ROUND.test(h)) continue;
    const company = h.slice(0, m.index).replace(/^.*?[:—–-]\s+/, "").replace(/[’']s$/, "").trim();
    const plausible = company && company.split(" ").length <= 5 && /^[A-Z0-9]/.test(company);
    return {
      type: r.type,
      companyName: plausible ? company : null,
      amount: r.type === "FUNDING" ? h.match(AMOUNT)?.[0].replace(/\s/g, "") ?? null : null,
      round: r.type === "FUNDING" ? h.match(ROUND)?.[0].replace(/^./, (c) => c.toUpperCase()) ?? null : null,
    };
  }
  return NONE;
}
